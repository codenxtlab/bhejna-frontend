/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// SvelteKit builds and auto-registers this file in production builds.
//
// Deliberately no offline caching: this is a live inbox, and a cached shell
// showing yesterday's conversations is worse than an honest network error.
// The only job here is delivering push notifications when no tab is open.

const sw = self as unknown as ServiceWorkerGlobalScope;

// Take over immediately instead of waiting for every tab to close, so a fixed
// push handler ships on the next load rather than the next browser restart.
sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(sw.clients.claim());
});

// Browsers want a fetch listener present before they treat the app as
// installable. This one deliberately never calls respondWith(), so requests go
// straight to the network at no cost — there is no offline mode here by design.
sw.addEventListener('fetch', () => {});

interface PushPayload {
	title?: string;
	body?: string;
	url?: string;
	tag?: string;
}

sw.addEventListener('push', (event: PushEvent) => {
	let payload: PushPayload;
	try {
		payload = event.data?.json() ?? {};
	} catch {
		payload = { body: event.data?.text() };
	}

	const title = payload.title || 'New message';
	const url = payload.url || '/dashboard/inbox';

	// Always show, even when a tab is focused: Chrome's userVisibleOnly
	// contract penalizes pushes that render nothing.
	event.waitUntil(
		sw.registration.showNotification(title, {
			body: payload.body || '',
			icon: '/icon-192.png',
			badge: '/icon-badge.png',
			// One notification per conversation — a burst from one person
			// replaces itself instead of stacking.
			tag: payload.tag,
			data: { url }
		})
	);
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();
	const url: string = event.notification.data?.url || '/dashboard/inbox';

	event.waitUntil(
		(async () => {
			const clientList = await sw.clients.matchAll({
				type: 'window',
				includeUncontrolled: true
			});

			// Prefer an open tab over spawning another one.
			for (const client of clientList) {
				if ('focus' in client) {
					await client.focus();
					if ('navigate' in client && !client.url.endsWith(url)) {
						await client.navigate(url).catch(() => {});
					}
					return;
				}
			}
			await sw.clients.openWindow(url);
		})()
	);
});
