import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { sendMessage } from '$lib/api/generated/client'; 
import { SendMessageBody } from '$lib/api/generated/zod';
import crypto from 'crypto';

export const POST = async ({ request, locals }: RequestEvent): Promise<Response> => {
    try {
        const payload = await request.json();

        if (!payload.recipient_target) {
            return json({ message: 'Missing recipient_target' }, { status: 400 });
        }

        if (payload.type !== 'text' && payload.type !== 'template') {
            return json({ message: 'Invalid payload type. Must be "text" or "template".' }, { status: 400 });
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
        const cleanTarget = payload.recipient_target.replace(/^\+|^00/, '') || "";
        const flatPayload: any = {
            to: cleanTarget,
            from_business_phone: tenant.phone_number_id || "",
            idempotency_key: "playground_" + crypto.randomUUID(),
            type: payload.type,
        };

        if (payload.type === "template") {
            flatPayload.template = {
                template_code: payload.template_code || "hello_world",
                language: payload.language || "en_US",
                components: []
            };
            flatPayload.text = undefined;
        } else if (payload.type === "text") {
            flatPayload.text = {
                body: payload.text_body || "Hello from Bhejna Uniform Target!"
            };
            flatPayload.template = undefined;
        }

        // 4. Validate through Zod schema
        const parsedPayload = SendMessageBody.parse(flatPayload);

        // 5. Proxy request using the Orval-generated client
        const response = await sendMessage(
            parsedPayload as any,
            {
                headers: {
                    Authorization: `Bearer ${tenant.api_key}`
                }
            }
        );

        return json(response);
    } catch (error: any) {
        console.error('Test message proxy error:', error);
        return json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
};
