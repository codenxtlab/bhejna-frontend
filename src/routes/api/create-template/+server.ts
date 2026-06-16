import { json, type RequestEvent } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

// Helper to get an authenticated Supabase client on the server
function getSupabase(cookies: any) {
    const token = cookies.get('sb-access-token');
    
    return createClient(publicEnv.PUBLIC_SUPABASE_URL, publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false },
        global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
    });
}

export const POST = async ({ request, cookies }: RequestEvent): Promise<Response> => {
	try {
		const supabase = getSupabase(cookies);
		const { data: { user }, error: userError } = await supabase.auth.getUser();

		if (userError || !user) {
			return json({ message: 'Unauthorized' }, { status: 401 });
		}

		// Fetch the tenant record to get the waba_id
		const { data: tenant, error: tenantError } = await supabase
			.from('tenants')
			.select('waba_id')
			.eq('user_id', user.id)
			.single();

		if (tenantError || !tenant || !tenant.waba_id) {
			return json({ message: 'Tenant configuration not found or WABA ID is missing' }, { status: 404 });
		}

		// Make a POST request directly to the Meta Graph API (v25.0)
		const metaUrl = `https://graph.facebook.com/v25.0/${tenant.waba_id}/message_templates`;
		const payload = {
			name: "test_review_template_01",
			language: "en_US",
			category: "MARKETING",
			components: [
				{
					type: "BODY",
					text: "Hello, this is a test template for Meta App Review."
				}
			]
		};

		const response = await fetch(metaUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${privateEnv.META_SYSTEM_USER_TOKEN}`
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('Meta API error:', errorData);
			return json(
				{ message: errorData.error?.message || 'Failed to create template via Meta API' },
				{ status: response.status }
			);
		}

		const data = await response.json();
		
		// Return the new Template ID to the frontend
		return json({ id: data.id, status: data.status, category: data.category });
	} catch (error: any) {
		console.error('Create template proxy error:', error);
		return json({ message: 'Internal Server Error' }, { status: 500 });
	}
};
