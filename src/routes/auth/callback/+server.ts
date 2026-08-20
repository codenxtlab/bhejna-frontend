import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeNext } from '$lib/server/redirects';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	// Validated: an unchecked ?next= here would let anyone use our own OAuth
	// callback to bounce a visitor to an off-origin URL.
	const next = safeNext(url.searchParams.get('next'));

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			throw redirect(303, next);
		}
	}

	// return the user to an error page with instructions
	throw redirect(303, '/login?error=auth_failed');
};
