import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte'],
	preprocess: [vitePreprocess()],
	kit: {
		adapter: adapter(),
		// The service worker is push-only and exists for the single-operator
		// inbox. Registering it site-wide would install it for every visitor to
		// the landing page and docs, so the inbox registers it itself.
		serviceWorker: { register: false }
	}
};

export default config;
