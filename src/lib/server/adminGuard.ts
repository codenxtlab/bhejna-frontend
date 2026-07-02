import { error } from '@sveltejs/kit';
import { INBOX_ADMIN_EMAIL } from '$env/static/private';

// Restricts a route/action to a single hardcoded operator account.
// Returns a 404, not 403 — a 403 confirms the route exists and is
// "forbidden," which leaks that something's there to probe. 404 makes
// it indistinguishable from a route that doesn't exist at all.
export function requireAdmin(userEmail: string | undefined | null) {
	if (!userEmail || userEmail.toLowerCase() !== INBOX_ADMIN_EMAIL.toLowerCase()) {
		throw error(404, 'Not found');
	}
}
