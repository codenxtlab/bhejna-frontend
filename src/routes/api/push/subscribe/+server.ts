import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { requireAdmin } from '$lib/server/adminGuard';

// Resolves the caller to their tenant, refusing anyone who isn't the operator.
async function authorize(locals: RequestEvent['locals']) {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return { error: json({ error: 'unauthorized' }, { status: 401 }) };
	}
	requireAdmin(user.email);

	const { data: tenant, error: tenantError } = await locals.supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (tenantError || !tenant) {
		return {
			error: json({ message: 'Tenant record not found. Please provision first.' }, { status: 404 })
		};
	}
	return { tenantId: tenant.id as string };
}

function backendUrl(path: string): string | null {
	const baseUrl = (env.BHEJNA_GO_BACKEND_URL || '').replace(/\/$/, '');
	return baseUrl ? `${baseUrl}${path}` : null;
}

// Registers this browser/PWA to receive Web Push for the operator's inbox.
export const POST = async ({ locals, request }: RequestEvent): Promise<Response> => {
	const auth = await authorize(locals);
	if (auth.error) return auth.error;

	const body = await request.text();
	const url = backendUrl(
		`/v1/internal/push/subscribe?tenant_id=${encodeURIComponent(auth.tenantId!)}`
	);
	if (!url) return json({ message: 'BHEJNA_GO_BACKEND_URL is not set' }, { status: 500 });

	const upstream = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}`,
			'Content-Type': 'application/json'
		},
		body
	});

	if (!upstream.ok) {
		return json({ message: 'Failed to register push subscription' }, { status: upstream.status });
	}
	return new Response(null, { status: 204 });
};

// Drops this browser's subscription.
export const DELETE = async ({ locals, request }: RequestEvent): Promise<Response> => {
	const auth = await authorize(locals);
	if (auth.error) return auth.error;

	const body = await request.text();
	const url = backendUrl('/v1/internal/push/subscribe');
	if (!url) return json({ message: 'BHEJNA_GO_BACKEND_URL is not set' }, { status: 500 });

	const upstream = await fetch(url, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}`,
			'Content-Type': 'application/json'
		},
		body
	});

	if (!upstream.ok) {
		return json({ message: 'Failed to remove push subscription' }, { status: upstream.status });
	}
	return new Response(null, { status: 204 });
};
