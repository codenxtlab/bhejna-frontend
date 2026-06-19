<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let { data } = $props();

	onMount(async () => {
		if (!data.supabase) return;
		const {
			data: { user }
		} = await data.supabase.auth.getUser();
		if (user) {
			goto('/dashboard');
		} else {
			goto('/login');
		}
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950">
	<img src="/favicon.svg" alt="Bhejna Logo" class="mb-6 h-16 w-16 animate-pulse" />
	<div class="animate-pulse text-xl font-bold text-cyan-500">Loading Bhejna...</div>
</div>
