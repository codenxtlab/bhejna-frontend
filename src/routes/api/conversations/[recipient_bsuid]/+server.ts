import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { getConversationThread } from '$lib/api/generated/client';
import { requireAdmin } from '$lib/server/adminGuard';

export const GET = async (event: RequestEvent): Promise<Response> => {
	const { locals, params } = event;

	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return json({ error: 'unauthorized' }, { status: 401 });
	}
	requireAdmin(user.email);

	try {
		const { data: tenant, error: tenantError } = await locals.supabase
			.from('tenants')
			.select('id')
			.eq('user_id', user.id)
			.maybeSingle();

		if (tenantError || !tenant) {
			return json({ message: 'Tenant record not found. Please provision first.' }, { status: 404 });
		}

		const response = await getConversationThread(
			params.recipient_bsuid!,
			{ tenant_id: tenant.id },
			{ headers: { Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}` } }
		);

		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Error fetching conversation thread:', err);
		return json({ message: err.message || 'Internal Server Error' }, { status: 500 });
	}
};
