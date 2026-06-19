import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.safeGetSession();
	if (!session || !session.user) {
		throw error(401, 'Session unauthorized');
	}

	// Read the tracking status directly using the user session context
	const { data: tenant, error: sbError } = await locals.supabase
		.from('tenants')
		.select('whatsapp_status')
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (sbError) {
		throw error(500, `Tenant verification state failed: ${sbError.message}`);
	}

	return json({ whatsapp_status: tenant?.whatsapp_status || 'UNCONNECTED' });
};
