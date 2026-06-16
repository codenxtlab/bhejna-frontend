import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';
import { syncTenant } from '$lib/api/generated/client';
import { SyncTenantBody } from '$lib/api/generated/zod';
import crypto from 'crypto';

export const POST = async ({ request, locals }: RequestEvent): Promise<Response> => {
    // 1. Auth Guard: Use the pre-verified session from our hooks
    const { session, user } = await locals.safeGetSession();

    if (!session || !user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Parse Request: Extract waba_id and phone_number_id
        const { waba_id, phone_number_id } = await request.json();

        if (!waba_id || !phone_number_id) {
            return json({ message: 'Missing WABA ID or Phone Number ID' }, { status: 400 });
        }

        // 3. Generate Key: Secure key prefixed with nxt_live_
        const apiKey = 'nxt_live_' + crypto.randomUUID().replace(/-/g, '');

        // 4. Strict RLS Database Insert
        // CRITICAL: We MUST include user_id to satisfy the Supabase INSERT policy.
        const { data: newTenant, error: insertError } = await locals.supabase
            .from('tenants')
            .insert({
                user_id: user.id,
                waba_id,
                phone_number_id,
                api_key: apiKey
            })
            .select()
            .single();

        if (insertError || !newTenant) {
            console.error('Manual Provisioning Database Error:', JSON.stringify(insertError, null, 2));
            return json({ message: 'Failed to create tenant record' }, { status: 500 });
        }

        // 5. Go Backend Hydration (The 500 Fix)
        // Aggressively trim all string fields to prevent Go validation errors (e.g. leading spaces)
        // Spread newTenant to satisfy Go's requirement for a complete schema
        const goPayload = {
            id: newTenant.id,
            waba_id: newTenant.waba_id?.trim() || "",
            phone_number_id: newTenant.phone_number_id?.trim() || "",
            api_key: newTenant.api_key?.trim() || "", // CRITICAL: Use api_key, NOT access_token
            messaging_limit: Number(newTenant.messaging_limit) || 250, // Must be integer
            quality_rating: newTenant.quality_rating || "GREEN",
            is_paused: Boolean(newTenant.is_paused), // Must be boolean
            webhook_url: newTenant.webhook_url?.trim() || "",
            webhook_secret: newTenant.webhook_secret?.trim() || "",
            created_at: newTenant.created_at || new Date().toISOString()
        };

        try {
            const parsedPayload = SyncTenantBody.parse(goPayload);
            await syncTenant(parsedPayload, {
                headers: {
                    Authorization: `Bearer ${env.BHEJNA_INTERNAL_SECRET}`
                }
            });
        } catch (fetchError) {
            console.error('Data Plane Connection Error:', fetchError);
            // Soft success: Connection failed, but the data exists in Supabase.
            return json({ 
                tenant: newTenant, 
                message: 'Infrastructure connection failure. Edge sync pending.' 
            });
        }

        // 6. Return Success
        return json({ 
            tenant: newTenant,
            message: 'Tenant provisioned and synchronized successfully.'
        });

    } catch (err: any) {
        console.error('Provisioning internal error:', err);
        return json({ message: 'Internal Server Error' }, { status: 500 });
    }
};
