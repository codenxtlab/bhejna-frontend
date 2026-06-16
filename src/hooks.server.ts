import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/public';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { getTextDirection } from '$lib/paraglide/runtime';

const handleSupabase: Handle = async ({ event, resolve }) => {
	// 0. Safeguard: Check that the required configuration env vars are present
	if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
		console.error("CRITICAL CONFIGURATION ERROR: PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY is not defined in the environment variables.");
		return new Response(
			"Configuration Error: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables are required. Please configure them in the Cloudflare Pages Dashboard settings.",
			{ status: 500 }
		);
	}

	// 1. Initialize Supabase Server Client
	event.locals.supabase = createServerClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll() {
				return event.cookies.getAll();
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			},
		},
	});

	// 2. Define the safe session fetcher
	event.locals.safeGetSession = async () => {
		const { data: { session } } = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const { data: { user }, error } = await event.locals.supabase.auth.getUser();
		if (error) {
			// Stale refresh token — purge cookies so the loop stops
			await event.locals.supabase.auth.signOut();
			return { session: null, user: null };
		}

		return { session, user };
	};

	// 3. Populate session & user in locals for downstream use
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	// 4. Run authguard logic: if pathname starts with /dashboard and safeGetSession returns no session, redirect to /login
	if (event.url.pathname.startsWith('/dashboard') && !session) {
		throw redirect(303, '/login');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		},
	});
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

export const handle: Handle = sequence(handleSupabase, handleParaglide);
