import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { listConversations, replyToConversation } from '$lib/api/generated/client';
import { requireAdmin } from '$lib/server/adminGuard';
import { loginUrlFor } from '$lib/server/redirects';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, loginUrlFor(url.pathname + url.search));
	}
	requireAdmin(user.email);

	const { data: tenant } = await locals.supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.maybeSingle();

	if (!tenant) {
		return { tenantId: null, conversations: [] };
	}

	const response = await listConversations(
		{ tenant_id: tenant.id },
		{ headers: { Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}` } }
	);

	return {
		tenantId: tenant.id,
		conversations: response.status === 200 ? (response.data ?? []) : []
	};
};

export const actions: Actions = {
	reply: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'Unauthorized' });
		}
		requireAdmin(user.email);

		const formData = await request.formData();
		const recipientBsuid = formData.get('recipient_bsuid')?.toString() || '';
		const body = formData.get('body')?.toString() || '';

		if (!recipientBsuid || !body.trim()) {
			return fail(400, { message: 'Message body is required' });
		}

		const { data: tenant } = await locals.supabase
			.from('tenants')
			.select('id')
			.eq('user_id', user.id)
			.maybeSingle();

		if (!tenant) {
			return fail(404, { message: 'Tenant record not found' });
		}

		// Widened: the generated union only declares 202/409, but the backend
		// can return any ErrorResponse status (400/500/...) that we surface below.
		const response = (await replyToConversation(
			recipientBsuid,
			{ body },
			{ tenant_id: tenant.id },
			{ headers: { Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}` } }
		)) as { status: number; data?: unknown };

		if (response.status === 409) {
			return fail(409, {
				message: 'Session expired. Send a template to reopen this conversation.',
				sessionClosed: true
			});
		}

		if (response.status !== 202) {
			// Surface the backend's real ErrorResponse code/message (same pattern
			// as the Playground) — a bare "Failed to send reply" hides the cause.
			const err = (response.data as any)?.error;
			const status = response.status >= 400 && response.status <= 599 ? response.status : 500;
			return fail(status, {
				message: err?.code ? `${err.code}: ${err.message}` : 'Failed to send reply'
			});
		}

		return { success: true };
	}
};
