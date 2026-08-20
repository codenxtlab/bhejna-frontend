// Where to send a logged-in user when no specific destination was requested.
export const DEFAULT_LANDING = '/dashboard';

/**
 * Validates a `?next=` destination before redirecting to it.
 *
 * `next` comes from the query string, so it is attacker-controllable: without
 * this guard, `/login?next=https://evil.example` would turn our own login page
 * into an open redirect that phishers can borrow our domain for. Only
 * same-origin absolute paths are allowed through.
 */
export function safeNext(next: string | null | undefined, fallback = DEFAULT_LANDING): string {
	if (!next) return fallback;

	// Must be an absolute path on this origin.
	if (!next.startsWith('/')) return fallback;

	// "//evil.example" and "/\evil.example" are protocol-relative URLs: they
	// start with a slash but navigate off-origin.
	if (next.startsWith('//') || next.startsWith('/\\')) return fallback;

	// Control characters can be used to smuggle a second header or confuse
	// the URL parser. The rule below guards against *accidental* control
	// characters in a pattern; matching them is this check's entire purpose.
	// eslint-disable-next-line no-control-regex
	if (/[\x00-\x1f\x7f]/.test(next)) return fallback;

	return next;
}

/** Builds the login URL that remembers where the user was headed. */
export function loginUrlFor(pathWithQuery: string): string {
	return `/login?next=${encodeURIComponent(pathWithQuery)}`;
}
