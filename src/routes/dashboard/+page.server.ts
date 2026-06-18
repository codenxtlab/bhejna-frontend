import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { syncTenant } from '$lib/api/generated/client';
import { SyncTenantBody } from '$lib/api/generated/zod';
import { randomBytes, createHmac } from 'crypto';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Fetch the active tenant metadata mapping for the current authenticated user using maybeSingle to prevent PGRST116 errors
	const { data: tenant, error } = await locals.supabase
		.from('tenants')
		.select('*')
		.eq('user_id', user.id)
		.maybeSingle();

	return {
		tenant: tenant || null
	};
};

export const actions: Actions = {
	signout: async ({ locals: { supabase } }) => {
		await supabase.auth.signOut();
		throw redirect(303, '/login');
	},
	updateWebhook: async ({ request, locals }) => {
		// 1. Auth Guard
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'Unauthorized. Please sign in.' });
		}

		const formData = await request.formData();
		const webhook_url = formData.get('webhook_url')?.toString() || '';

		// Validation: Basic HTTPS check
		if (!webhook_url || !webhook_url.startsWith('https://')) {
			return fail(400, { message: 'A valid https:// Webhook URL is required' });
		}

		const supabase = locals.supabase;

		// Fetch tenant row
		const { data: existingTenant, error: fetchError } = await supabase
			.from('tenants')
			.select('*')
			.eq('user_id', user.id)
			.maybeSingle();

		if (fetchError || !existingTenant) {
			console.error('Supabase Tenant Lookup Failed:', JSON.stringify(fetchError, null, 2));
			return fail(404, {
				message: 'Tenant record not found. Please provision your account first.'
			});
		}

		let webhook_secret = existingTenant.webhook_secret;
		if (!webhook_secret || webhook_secret.trim() === '') {
			webhook_secret = randomBytes(16).toString('hex');
		}

		// Update the tenant row
		const { data: updatedTenant, error: updateError } = await supabase
			.from('tenants')
			.update({ webhook_url, webhook_secret })
			.eq('id', existingTenant.id)
			.select()
			.single();

		if (updateError || !updatedTenant) {
			console.error('CRITICAL: Database Save Failed', JSON.stringify(updateError, null, 2));
			return fail(500, { message: 'Database Save Failed' });
		}

		// Sync with Go backend
		const goPayload = {
			id: updatedTenant.id,
			waba_id: updatedTenant.waba_id?.trim() || undefined,
			phone_number_id: updatedTenant.phone_number_id?.trim() || undefined,
			api_key: updatedTenant.api_key?.trim() || undefined,
			whatsapp_status: updatedTenant.whatsapp_status || 'UNCONNECTED',
			messaging_limit: Number(updatedTenant.messaging_limit) || 250,
			quality_rating: updatedTenant.quality_rating || 'GREEN',
			is_paused: Boolean(updatedTenant.is_paused),
			webhook_url: updatedTenant.webhook_url?.trim() || '',
			webhook_secret: updatedTenant.webhook_secret?.trim() || '',
			created_at: updatedTenant.created_at || new Date().toISOString()
		};

		try {
			const parsedPayload = SyncTenantBody.parse(goPayload);
			await syncTenant(parsedPayload, {
				headers: {
					Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}`
				}
			});
		} catch (syncErr: any) {
			console.error('Data Plane Communication Error:', syncErr);
			return {
				success: true,
				message: 'Webhook saved. Infrastructure sync pending.',
				webhook_url: updatedTenant.webhook_url,
				webhook_secret: updatedTenant.webhook_secret
			};
		}

		return {
			success: true,
			message: 'Webhook saved and synchronized.',
			webhook_url: updatedTenant.webhook_url,
			webhook_secret: updatedTenant.webhook_secret
		};
	},
	rotateSecret: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { message: 'Unauthorized' });

		const newSecret = randomBytes(16).toString('hex');
		const { data: updatedTenant, error: updateError } = await locals.supabase
			.from('tenants')
			.update({ webhook_secret: newSecret })
			.eq('user_id', user.id)
			.select()
			.single();

		if (updateError || !updatedTenant) {
			return fail(500, { message: 'Failed to rotate secret' });
		}

		const goPayload = {
			id: updatedTenant.id,
			waba_id: updatedTenant.waba_id?.trim() || undefined,
			phone_number_id: updatedTenant.phone_number_id?.trim() || undefined,
			api_key: updatedTenant.api_key?.trim() || undefined,
			whatsapp_status: updatedTenant.whatsapp_status || 'UNCONNECTED',
			messaging_limit: Number(updatedTenant.messaging_limit) || 250,
			quality_rating: updatedTenant.quality_rating || 'GREEN',
			is_paused: Boolean(updatedTenant.is_paused),
			webhook_url: updatedTenant.webhook_url?.trim() || '',
			webhook_secret: updatedTenant.webhook_secret?.trim() || '',
			created_at: updatedTenant.created_at || new Date().toISOString()
		};

		try {
			const parsedPayload = SyncTenantBody.parse(goPayload);
			await syncTenant(parsedPayload, {
				headers: {
					Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}`
				}
			});
		} catch (err) {
			console.error('Go Sync Error during rotation:', err);
		}

		return { success: true, message: 'Webhook secret rotated successfully.' };
	},
	initializeOnboarding: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'Unauthorized session bounds' });
		}

		const userId = user.id;
		const internalSecret = env.BHEJNA_INTERNAL_SECRET;

		if (!internalSecret) {
			return fail(500, { message: 'System configuration drop: Missing BHEJNA_INTERNAL_SECRET' });
		}

		try {
			// 1. Query Supabase RLS row instance context safely
			const { data: currentTenant, error: fetchError } = await locals.supabase
				.from('tenants')
				.select('*')
				.eq('user_id', userId)
				.maybeSingle();

			if (fetchError) {
				return fail(500, { message: `Database evaluation failed: ${fetchError.message}` });
			}

			let tenantId: string;
			let tenantData: any;

			if (currentTenant) {
				tenantId = currentTenant.id;
				// Transition state tracking column locally
				const { data: updatedTenant, error: updateError } = await locals.supabase
					.from('tenants')
					.update({ whatsapp_status: 'PENDING_ONBOARDING' })
					.eq('id', tenantId)
					.select()
					.single();

				if (updateError || !updatedTenant)
					return fail(500, { message: updateError?.message || 'Update failed' });
				tenantData = updatedTenant;
			} else {
				// Initialize clean multi-tenant record entry matching RLS constraints
				const { data: newTenant, error: insertError } = await locals.supabase
					.from('tenants')
					.insert({
						user_id: userId,
						whatsapp_status: 'PENDING_ONBOARDING'
					})
					.select()
					.single();

				if (insertError || !newTenant)
					return fail(500, { message: insertError?.message || 'Insert failed' });
				tenantId = newTenant.id;
				tenantData = newTenant;
			}

			// 2. Fire internal POST routing request to sync state with the Go Engine Plane control boundary
			const goPayload = {
				id: tenantId,
				waba_id: tenantData.waba_id?.trim() || undefined,
				phone_number_id: tenantData.phone_number_id?.trim() || undefined,
				api_key: tenantData.api_key?.trim() || undefined,
				whatsapp_status: 'PENDING_ONBOARDING',
				messaging_limit: Number(tenantData.messaging_limit) || 250,
				quality_rating: tenantData.quality_rating || 'GREEN',
				is_paused: Boolean(tenantData.is_paused),
				webhook_url: tenantData.webhook_url?.trim() || '',
				webhook_secret: tenantData.webhook_secret?.trim() || '',
				created_at: tenantData.created_at || new Date().toISOString()
			};

			const parsedPayload = SyncTenantBody.parse(goPayload);
			await syncTenant(parsedPayload, {
				headers: {
					Authorization: `Bearer ${internalSecret}`
				}
			});

			// 3. Mint a STATELESS SIGNED STATE for OAuth redirect correlation
			const expiry = Date.now() + 600000; // 10 minutes from now
			const payload = `${tenantId}.${expiry}`;
			const sig = createHmac('sha256', internalSecret).update(payload).digest('hex');
			const state = Buffer.from(payload).toString('base64url') + '.' + sig;

			// 4. Construct the dynamic Meta Login-for-Business OAuth URL
			const metaAppId = env.META_APP_ID || env.PUBLIC_META_APP_ID || '1594349876023947';
			const redirectUri = env.META_OAUTH_REDIRECT_URI;
			if (!redirectUri) {
				return fail(500, { message: 'Missing META_OAUTH_REDIRECT_URI environment configuration' });
			}

			const onboardingUrl =
				`https://www.facebook.com/v23.0/dialog/oauth` +
				`?client_id=${metaAppId}` +
				`&config_id=1298428131650108` +
				`&response_type=code` +
				`&redirect_uri=${encodeURIComponent(redirectUri)}` +
				`&state=${state}`;

			return { success: true, onboardingUrl };
		} catch (err: any) {
			return fail(500, {
				message: err.message || 'An unexpected internal routing exception occurred'
			});
		}
	},
	cancelOnboarding: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'Unauthorized session bounds' });
		}

		const userId = user.id;
		const internalSecret = env.BHEJNA_INTERNAL_SECRET;

		if (!internalSecret) {
			return fail(500, { message: 'System configuration drop: Missing BHEJNA_INTERNAL_SECRET' });
		}

		try {
			// 1. Fetch current tenant record
			const { data: currentTenant, error: fetchError } = await locals.supabase
				.from('tenants')
				.select('*')
				.eq('user_id', userId)
				.maybeSingle();

			if (fetchError || !currentTenant) {
				return fail(404, { message: 'Tenant profile not found' });
			}

			// 2. Reset status in database
			const { data: updatedTenant, error: updateError } = await locals.supabase
				.from('tenants')
				.update({
					whatsapp_status: 'UNCONNECTED',
					waba_id: null,
					phone_number_id: null
				})
				.eq('id', currentTenant.id)
				.select()
				.single();

			if (updateError || !updatedTenant) {
				return fail(500, { message: updateError?.message || 'Reset failed in database' });
			}

			// 3. Sync state with Go Backend
			const goPayload = {
				id: updatedTenant.id,
				waba_id: '',
				phone_number_id: '',
				api_key: updatedTenant.api_key?.trim() || '',
				whatsapp_status: 'UNCONNECTED',
				messaging_limit: Number(updatedTenant.messaging_limit) || 250,
				quality_rating: updatedTenant.quality_rating || 'GREEN',
				is_paused: Boolean(updatedTenant.is_paused),
				webhook_url: updatedTenant.webhook_url?.trim() || '',
				webhook_secret: updatedTenant.webhook_secret?.trim() || '',
				created_at: updatedTenant.created_at || new Date().toISOString()
			};

			const parsedPayload = SyncTenantBody.parse(goPayload);
			await syncTenant(parsedPayload, {
				headers: {
					Authorization: `Bearer ${internalSecret}`
				}
			});

			return { success: true, message: 'Onboarding progress reset successfully.' };
		} catch (err: any) {
			return fail(500, {
				message: err.message || 'An unexpected internal routing exception occurred'
			});
		}
	},
	retryWabaSubscription: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) {
			return fail(401, { message: 'Unauthorized session bounds' });
		}

		const internalSecret = env.BHEJNA_INTERNAL_SECRET;
		if (!internalSecret) {
			return fail(500, { message: 'System configuration drop: Missing BHEJNA_INTERNAL_SECRET' });
		}

		try {
			const { data: tenant, error: fetchError } = await locals.supabase
				.from('tenants')
				.select('*')
				.eq('user_id', user.id)
				.maybeSingle();

			if (fetchError || !tenant) {
				return fail(404, {
					message: 'Tenant record not found. Please provision your account first.'
				});
			}

			if (!tenant.waba_id || tenant.waba_id.trim() === '') {
				return fail(400, {
					message: 'Cannot retry sync: Configuration missing valid WABA ID parameters.'
				});
			}

			const goPayload = {
				id: tenant.id,
				waba_id: tenant.waba_id?.trim() || undefined,
				phone_number_id: tenant.phone_number_id?.trim() || undefined,
				api_key: tenant.api_key?.trim() || undefined,
				whatsapp_status: tenant.whatsapp_status || 'UNCONNECTED',
				messaging_limit: Number(tenant.messaging_limit) || 250,
				quality_rating: tenant.quality_rating || 'GREEN',
				is_paused: Boolean(tenant.is_paused),
				webhook_url: tenant.webhook_url?.trim() || '',
				webhook_secret: tenant.webhook_secret?.trim() || '',
				created_at: tenant.created_at || new Date().toISOString()
			};

			const parsedPayload = SyncTenantBody.parse(goPayload);
			await syncTenant(parsedPayload, {
				headers: {
					Authorization: `Bearer ${internalSecret}`
				}
			});

			return { success: true, message: 'Event stream sync completed successfully.' };
		} catch (err: any) {
			return fail(500, {
				message: err.message || 'An unexpected internal sync routing exception occurred'
			});
		}
	}
};
