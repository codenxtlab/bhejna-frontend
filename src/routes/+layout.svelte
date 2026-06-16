<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';

	let { data, children } = $props();
	let { supabase, session } = $derived(data);

	onMount(() => {
		/**
		 * Auth State Listener:
		 * This listener monitors when the user logs in or out on the client.
		 * When the session changes, it calls 'invalidate', which re-runs the 
		 * +layout.ts load function and forces the cookies to sync with the server.
		 */
		if (!supabase) return;

		const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.access_token !== session?.access_token) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>


<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
	{/each}
</div>

{@render children()}
