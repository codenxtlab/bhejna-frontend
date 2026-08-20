import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/server/adminGuard';

// Meta media ids are decimal. Reject anything else before it reaches the
// backend URL.
const MEDIA_ID = /^[0-9]{1,32}$/;

// Streams one inbound WhatsApp media file to the browser.
//
// The bytes cannot be linked to directly: Meta's media URL expires in minutes
// and needs the tenant's access token, which must never reach the client. So
// this proxies through the Go backend, which holds the token.
export const GET = async (event: RequestEvent): Promise<Response> => {
	const { locals, params } = event;

	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	requireAdmin(user.email);

	if (!params.id || !MEDIA_ID.test(params.id)) {
		throw error(400, 'Invalid media id');
	}

	const { data: tenant, error: tenantError } = await locals.supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (tenantError || !tenant) {
		return json({ message: 'Tenant record not found. Please provision first.' }, { status: 404 });
	}

	const baseUrl = (env.BHEJNA_GO_BACKEND_URL || '').replace(/\/$/, '');
	if (!baseUrl) {
		return json({ message: 'BHEJNA_GO_BACKEND_URL is not set' }, { status: 500 });
	}

	const upstream = await fetch(
		`${baseUrl}/v1/internal/media/${params.id}?tenant_id=${encodeURIComponent(tenant.id)}`,
		{ headers: { Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}` } }
	);

	if (!upstream.ok || !upstream.body) {
		return json({ message: 'Media unavailable' }, { status: upstream.status || 502 });
	}

	// Pass the body through as a stream rather than buffering it — a video can
	// be tens of megabytes and this runs on a Worker.
	return new Response(upstream.body, {
		status: 200,
		headers: {
			'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
			// A media id always resolves to the same bytes.
			'Cache-Control': 'private, max-age=86400',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
