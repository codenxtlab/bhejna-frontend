import { browser } from '$app/environment';

// Chrome's install event isn't in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const install = $state({
	/** The browser has offered an install prompt we can trigger. */
	available: false,
	/** Already running as an installed app. */
	installed: false
});

if (browser) {
	// Captured at module scope, not in onMount: Chrome can fire this as soon as
	// the manifest qualifies, which may be before the page component mounts.
	// Calling preventDefault() suppresses the browser's own mini-infobar so the
	// button below is the single way in.
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		deferredPrompt = event as BeforeInstallPromptEvent;
		install.available = true;
	});

	window.addEventListener('appinstalled', () => {
		deferredPrompt = null;
		install.available = false;
		install.installed = true;
	});

	// Launched from the home screen rather than a browser tab.
	install.installed =
		window.matchMedia('(display-mode: standalone)').matches ||
		// iOS Safari reports standalone here instead.
		(navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Shows the browser's install dialog. The saved event is single-use — once
 * prompted, the browser will fire a fresh beforeinstallprompt if the user
 * dismisses and remains eligible.
 */
export async function promptInstall(): Promise<void> {
	if (!deferredPrompt) return;

	await deferredPrompt.prompt();
	const { outcome } = await deferredPrompt.userChoice;

	deferredPrompt = null;
	install.available = false;
	if (outcome === 'accepted') install.installed = true;
}
