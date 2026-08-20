import { dev } from '$app/environment';
import { base } from '$app/paths';
import { env } from '$env/dynamic/public';

export type PushState = 'unsupported' | 'off' | 'on' | 'blocked';

// VAPID keys travel as base64url; PushManager wants raw bytes.
function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(normalized);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
}

// Registers the push service worker. Manual because auto-registration is off:
// this worker is only for the inbox, not for visitors to the public pages.
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
	if (!pushSupported()) return undefined;
	const existing = await navigator.serviceWorker.getRegistration();
	if (existing) return existing;
	return navigator.serviceWorker.register(`${base}/service-worker.js`, {
		type: dev ? 'module' : 'classic'
	});
}

export function pushSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

// Called once when the inbox mounts: registers the push worker for this
// operator and reports whether they've already opted in. This is the only
// place the worker is ever installed — public pages never touch it.
export async function initPush(): Promise<PushState> {
	if (!pushSupported()) return 'unsupported';
	await ensureServiceWorker().catch((err) =>
		console.error('Service worker registration failed:', err)
	);
	return currentPushState();
}

// Reads the current state without prompting, so the button renders correctly
// for a device that already subscribed.
export async function currentPushState(): Promise<PushState> {
	if (!pushSupported()) return 'unsupported';
	if (Notification.permission === 'denied') return 'blocked';
	if (Notification.permission !== 'granted') return 'off';

	const reg = await navigator.serviceWorker.getRegistration();
	const sub = await reg?.pushManager.getSubscription();
	return sub ? 'on' : 'off';
}

// Must be called from a click handler — browsers reject a permission prompt
// that isn't tied to a user gesture.
export async function enablePush(): Promise<PushState> {
	if (!pushSupported()) return 'unsupported';

	const vapidKey = env.PUBLIC_VAPID_PUBLIC_KEY;
	if (!vapidKey) {
		console.error('PUBLIC_VAPID_PUBLIC_KEY is not set — push cannot be enabled');
		return 'off';
	}

	const permission = await Notification.requestPermission();
	if (permission === 'denied') return 'blocked';
	if (permission !== 'granted') return 'off';

	await ensureServiceWorker();
	const reg = await navigator.serviceWorker.ready;
	// Reuse an existing subscription if the browser already has one; calling
	// subscribe() again with the same key returns it anyway, but re-POSTing
	// keeps the server row alive after a DB reset.
	const sub =
		(await reg.pushManager.getSubscription()) ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
		}));

	const res = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(sub.toJSON())
	});
	if (!res.ok) {
		console.error('Failed to register push subscription:', res.status);
		return 'off';
	}
	return 'on';
}

export async function disablePush(): Promise<PushState> {
	if (!pushSupported()) return 'unsupported';

	const reg = await navigator.serviceWorker.getRegistration();
	const sub = await reg?.pushManager.getSubscription();
	if (!sub) return 'off';

	// Tell the server first: if unsubscribing locally succeeded but the DELETE
	// didn't, the server would keep pushing to a dead endpoint until it 410s.
	await fetch('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: sub.endpoint })
	}).catch((err) => console.error('Failed to remove push subscription:', err));

	await sub.unsubscribe();
	return 'off';
}
