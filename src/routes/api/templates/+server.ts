import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { listTemplates } from '$lib/api/generated/client';

export const GET = async (event: RequestEvent): Promise<Response> => {
	const { locals, url } = event;

	// 1. Validate session
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		return json({ message: 'Unauthorized' }, { status: 401 });
	}

	try {
		// 2. Fetch the tenant record to get the stored api_key
		const { data: tenant, error: tenantError } = await locals.supabase
			.from('tenants')
			.select('api_key')
			.eq('user_id', user.id)
			.maybeSingle();

		if (tenantError || !tenant || !tenant.api_key) {
			return json({ message: 'Tenant API key not found. Please provision first.' }, { status: 404 });
		}

		// 3. Forward optional status filter
		const status = url.searchParams.get('status');
		const params = status ? { status: status as any } : undefined;

		// 4. Call Go backend listTemplates with X-API-Key header
		const response = await listTemplates(params, {
			headers: {
				'X-API-Key': tenant.api_key
			}
		});

		// 5. Returns the JSON response directly as a transparent proxy
		return json(response.data, { status: response.status });
	} catch (err: any) {
		console.error('Error fetching templates:', err);
		return json({ message: err.message || 'Internal Server Error' }, { status: 500 });
	}
};
