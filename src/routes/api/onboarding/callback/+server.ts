import { redirect, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { syncTenant } from '$lib/api/generated/client';
import { SyncTenantBody } from '$lib/api/generated/zod';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	const metaError = url.searchParams.get('error') || url.searchParams.get('error_reason');

	if (metaError || !code || !state) {
		console.error('Meta OAuth callback error parameters:', { metaError, code, state });
		throw redirect(302, '/dashboard?onboarding=error');
	}

	const internalSecret = env.BHEJNA_INTERNAL_SECRET;
	if (!internalSecret) {
		console.error('System config error: BHEJNA_INTERNAL_SECRET is missing');
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 1. Verify Signed State Cryptographically
	let tenantId = '';
	try {
		const parts = state.split('.');
		if (parts.length !== 2) {
			throw new Error('Invalid state token format');
		}

		const [payloadB64, sig] = parts;
		const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');

		const expectedSig = createHmac('sha256', internalSecret).update(payloadStr).digest('hex');

		const expectedBuf = Buffer.from(expectedSig);
		const actualBuf = Buffer.from(sig);

		if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
			throw new Error('HMAC signature mismatch');
		}

		const payloadParts = payloadStr.split('.');
		if (payloadParts.length !== 2) {
			throw new Error('Invalid payload structure');
		}

		const [extractedTenantId, expiryStr] = payloadParts;
		const expiry = parseInt(expiryStr, 10);

		if (Date.now() > expiry) {
			throw new Error('State token expired');
		}

		tenantId = extractedTenantId;
	} catch (stateErr: any) {
		console.error('OAuth state token verification failed:', stateErr.message);
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 2. Validate Session Ownership (Defense-in-depth, only if session is present)
	const sessionData = await locals.safeGetSession();
	if (sessionData && sessionData.session && sessionData.user) {
		const { data: tenant, error: tenantErr } = await locals.supabase
			.from('tenants')
			.select('*')
			.eq('id', tenantId)
			.maybeSingle();

		if (tenantErr || !tenant || tenant.user_id !== sessionData.user.id) {
			console.error('Tenant owner verification failed:', {
				tenantErr,
				tenantUserId: tenant?.user_id,
				sessionUserId: sessionData.user.id
			});
			throw redirect(302, '/dashboard?onboarding=error');
		}
	}

	let businessToken = '';
	let wabaId = '';
	let phoneNumberId: string | null = null;
	let qualityRating = 'GREEN';

	const metaAppId = env.META_APP_ID || env.PUBLIC_META_APP_ID || '1594349876023947';
	const metaAppSecret = env.META_APP_SECRET;
	const oauthRedirectUri = env.META_OAUTH_REDIRECT_URI;

	if (!metaAppSecret || !oauthRedirectUri) {
		console.error('System configuration error: Missing META_APP_SECRET or META_OAUTH_REDIRECT_URI');
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 3. Exchange OAuth code for Customer's Business Access Token
	try {
		const tokenUrl =
			`https://graph.facebook.com/v23.0/oauth/access_token` +
			`?client_id=${metaAppId}` +
			`&client_secret=${metaAppSecret}` +
			`&redirect_uri=${encodeURIComponent(oauthRedirectUri)}` +
			`&code=${code}`;

		const tokenRes = await fetch(tokenUrl);
		if (!tokenRes.ok) {
			const errBody = await tokenRes.text();
			throw new Error(
				`Token exchange graph call failed: status ${tokenRes.status} | body: ${errBody}`
			);
		}

		const tokenData = await tokenRes.json();
		businessToken = tokenData.access_token;
		if (!businessToken) {
			throw new Error('Access token not found in token exchange response');
		}
	} catch (tokenErr: any) {
		console.error('Meta access_token exchange failed:', tokenErr.message);
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 4. Discover WABA ID using Debug Token API
	try {
		const debugUrl =
			`https://graph.facebook.com/v23.0/debug_token` +
			`?input_token=${businessToken}` +
			`&access_token=${metaAppId}|${metaAppSecret}`;

		const debugRes = await fetch(debugUrl);
		if (!debugRes.ok) {
			const errBody = await debugRes.text();
			throw new Error(
				`Debug token graph call failed: status ${debugRes.status} | body: ${errBody}`
			);
		}

		const debugData = await debugRes.json();
		const scopes = debugData.data?.granular_scopes || [];

		let matchedWabaId = '';
		for (const scope of scopes) {
			if (
				scope.scope === 'whatsapp_business_management' &&
				scope.target_ids &&
				scope.target_ids.length > 0
			) {
				matchedWabaId = scope.target_ids[0];
				break;
			}
		}

		if (!matchedWabaId) {
			throw new Error('WABA ID not found under whatsapp_business_management scope target_ids');
		}

		wabaId = matchedWabaId;
	} catch (debugErr: any) {
		console.error('Meta debug_token validation failed:', debugErr.message);
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 5. Query WABA Phone Numbers
	try {
		const phoneUrl =
			`https://graph.facebook.com/v23.0/${wabaId}/phone_numbers` + `?access_token=${businessToken}`;

		const phoneRes = await fetch(phoneUrl);
		if (!phoneRes.ok) {
			const errBody = await phoneRes.text();
			throw new Error(
				`Phone numbers graph call failed: status ${phoneRes.status} | body: ${errBody}`
			);
		}

		const phoneData = await phoneRes.json();
		const phoneList = phoneData.data || [];

		if (phoneList.length > 0) {
			// Find the newest onboarded number by sorting last_onboarded_time (fallback to first entry if time is missing)
			const sortedList = [...phoneList].sort((a, b) => {
				const timeA = a.last_onboarded_time ? (typeof a.last_onboarded_time === 'number' ? a.last_onboarded_time * 1000 : new Date(a.last_onboarded_time).getTime()) : 0;
				const timeB = b.last_onboarded_time ? (typeof b.last_onboarded_time === 'number' ? b.last_onboarded_time * 1000 : new Date(b.last_onboarded_time).getTime()) : 0;
				return timeB - timeA;
			});

			const newestPhone = sortedList[0];
			phoneNumberId = newestPhone.id;
			qualityRating = newestPhone.quality_rating || 'GREEN';
		} else {
			console.warn('WABA returned empty phone numbers list at onboarding callback time.');
		}
	} catch (phoneErr: any) {
		// Log and fallback gracefully instead of returning a hard 500 error
		console.error('Graceful fallback: Meta phone numbers discovery failed:', phoneErr.message);
	}

	// 6. Generate secure Bhejna API key
	const apiKey = 'nxt_live_' + randomBytes(32).toString('hex');

	// 7. Update Supabase tenants table by exact tenantId from the validated state token
	let updatedTenant: any;
	try {
		const { data, error: updateError } = await locals.supabase
			.from('tenants')
			.update({
				waba_id: wabaId,
				phone_number_id: phoneNumberId || null,
				api_key: apiKey,
				quality_rating: qualityRating,
				whatsapp_status: 'PENDING_ONBOARDING'
			})
			.eq('id', tenantId)
			.select()
			.single();

		if (updateError || !data) {
			throw new Error(updateError?.message || 'Failed to update tenant row');
		}
		updatedTenant = data;
	} catch (dbErr: any) {
		console.error('Database update failed in callback handler:', dbErr.message);
		throw redirect(302, '/dashboard?onboarding=error');
	}

	// 8. Sync details with Go Edge Plane (Data Plane)
	try {
		const goPayload = {
			id: tenantId,
			waba_id: wabaId,
			phone_number_id: phoneNumberId || undefined,
			api_key: apiKey,
			whatsapp_status: 'PENDING_ONBOARDING',
			messaging_limit: Number(updatedTenant.messaging_limit) || 250,
			quality_rating: updatedTenant.quality_rating || 'GREEN',
			is_paused: Boolean(updatedTenant.is_paused),
			webhook_url: updatedTenant.webhook_url?.trim() || '',
			webhook_secret: updatedTenant.webhook_secret?.trim() || '',
			created_at: updatedTenant.created_at || new Date().toISOString()
		};

		const parsedPayload = SyncTenantBody.parse(goPayload);

		// SvelteKit calls the generated API client internally
		const goBackendUrl = env.BHEJNA_GO_BACKEND_URL;
		if (!goBackendUrl) {
			throw new Error('System configuration error: Missing BHEJNA_GO_BACKEND_URL');
		}

		await syncTenant(parsedPayload, {
			headers: {
				Authorization: `Bearer ${internalSecret}`
			}
		});
		console.log(`Successfully synced tenant ${tenantId} credentials to Go Edge Plane`);
	} catch (syncErr: any) {
		// Log and proceed — Go sync failure requires manual retry by user (via Sync Event Stream on dashboard)
		console.error('Control plane Go backend synchronization failed:', syncErr.message);
	}

	// 9. Redirect browser to onboarding success poller page
	throw redirect(302, '/onboarding-success');
};
