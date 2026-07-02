import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { sendMessage } from '$lib/api/generated/client';
import { SendMessageBody } from '$lib/api/generated/zod';
import crypto from 'crypto';

const MEDIA_TYPES = ['image', 'document', 'audio', 'video', 'sticker'] as const;
const BLOCK_TYPES = ['interactive', 'location', 'contacts', 'reaction'] as const;

export const POST = async (event: RequestEvent): Promise<Response> => {
	const { request, locals } = event;
	try {
		const payload = await request.json();

		if (!payload.recipient_target) {
			return json({ message: 'Missing recipient_target' }, { status: 400 });
		}

		const validTypes = ['text', 'template', ...MEDIA_TYPES, ...BLOCK_TYPES];
		if (!validTypes.includes(payload.type)) {
			return json(
				{ message: `Invalid payload type. Must be one of: ${validTypes.join(', ')}.` },
				{ status: 400 }
			);
		}

		// 1. Enterprise Auth Guard
		const { user } = await locals.safeGetSession();
		if (!user) {
			return json({ message: 'Unauthorized' }, { status: 401 });
		}

		// 2. Fetch the tenant record
		const { data: tenant, error: tenantError } = await locals.supabase
			.from('tenants')
			.select('api_key, phone_number_id')
			.eq('user_id', user.id)
			.single();

		if (tenantError || !tenant) {
			return json({ message: 'Tenant configuration not found' }, { status: 404 });
		}

		// 3. Map client-side message envelope footprint to Go Backend dynamic spec
		const cleanTarget = payload.recipient_target.replace(/^\+|^00/, '') || '';
		const flatPayload: any = {
			to: cleanTarget,
			from_business_phone: tenant.phone_number_id || '',
			idempotency_key: 'playground_' + crypto.randomUUID(),
			type: payload.type
		};

		if (payload.type === 'template') {
			flatPayload.template = {
				template_code: payload.template?.template_code || payload.template_code || 'hello_world',
				language: payload.template?.language || payload.language || 'en_US',
				components: payload.template?.components || []
			};
			flatPayload.text = undefined;
		} else if (payload.type === 'text') {
			flatPayload.text = {
				body: payload.text_body || 'Hello from Bhejna Uniform Target!'
			};
			flatPayload.template = undefined;
		} else if (MEDIA_TYPES.includes(payload.type)) {
			// Media block: { id | link, caption?, filename? } — passthrough to the backend
			const block = payload[payload.type] || payload.media;
			if (!block || (!block.id && !block.link)) {
				return json(
					{ message: `Media type '${payload.type}' requires an object with 'id' or 'link'.` },
					{ status: 400 }
				);
			}
			flatPayload[payload.type] = block;
		} else if (BLOCK_TYPES.includes(payload.type)) {
			// interactive/location/contacts/reaction: verbatim block passthrough
			const block = payload[payload.type];
			if (!block) {
				return json(
					{ message: `Type '${payload.type}' requires a '${payload.type}' object.` },
					{ status: 400 }
				);
			}
			flatPayload[payload.type] = block;
		}

		// 4. Validate through Zod schema
		const parsedPayload = SendMessageBody.parse(flatPayload);

		// 5. Proxy request using the Orval-generated client. customFetch returns
		// { data, status, headers } for ALL statuses — propagate the backend's
		// real status and body so 4xx errors (TEMPLATE_NOT_FOUND,
		// AUTH_TEMPLATE_REQUIRES_PHONE, ...) don't masquerade as 200 successes.
		const response: any = await sendMessage(parsedPayload as any, {
			headers: {
				Authorization: `Bearer ${tenant.api_key}`
			}
		});

		return json(response.data ?? response, { status: response.status ?? 200 });
	} catch (error: any) {
		console.error('Test message proxy error:', error);
		return json({ message: error.message || 'Internal Server Error' }, { status: 500 });
	}
};
