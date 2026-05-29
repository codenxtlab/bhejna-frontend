<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { Sparkles, Loader2, CheckCircle2 } from 'lucide-svelte';

	// Svelte 5 reactive Runes states fields declarations
	let syncState = $state<'UNCONNECTED' | 'PENDING_ONBOARDING' | 'ACTIVE'>('PENDING_ONBOARDING');
	let connectivityFault = $state('');
	let dots = $state('...');
	let showResetHatch = $state(false);
	
	let evaluationInterval: any;
	let dotsIntervalId: any;
	let resetHatchTimeoutId: any;

	const pullRegistrationStatus = async () => {
		try {
			const fetchRequest = await fetch('/api/tenant/status');
			if (!fetchRequest.ok) throw new Error('Network proxy tracking drop');
			
			const schemaData = await fetchRequest.json();
			syncState = schemaData.whatsapp_status;
		} catch (err: any) {
			connectivityFault = err.message || 'State verification connection drop';
		}
	};

	onMount(() => {
		pullRegistrationStatus();
		// Setup standard tracking polling loops ticks every 3000ms
		evaluationInterval = setInterval(pullRegistrationStatus, 3000);

		// Animate loading dots (...) for a premium native feel
		dotsIntervalId = setInterval(() => {
			if (dots === '...') dots = '.';
			else if (dots === '.') dots = '..';
			else if (dots === '..') dots = '...';
		}, 600);

		// Set a 15-second timeout to display the escape hatch link
		resetHatchTimeoutId = setTimeout(() => {
			showResetHatch = true;
		}, 15000);
	});

	onDestroy(() => {
		if (evaluationInterval) clearInterval(evaluationInterval);
		if (dotsIntervalId) clearInterval(dotsIntervalId);
		if (resetHatchTimeoutId) clearTimeout(resetHatchTimeoutId);
	});

	// Svelte 5 $effect rune intercepts state transitions reactively
	$effect(() => {
		if (syncState === 'ACTIVE') {
			if (evaluationInterval) clearInterval(evaluationInterval);
			if (dotsIntervalId) clearInterval(dotsIntervalId);
			if (resetHatchTimeoutId) clearTimeout(resetHatchTimeoutId);
			
			// Allow success animations to finish playing smoothly
			const timer = setTimeout(() => {
				goto('/dashboard');
			}, 1500);

			return () => clearTimeout(timer);
		}
	});
</script>

<svelte:head>
	<title>Activating WhatsApp | Bhejna</title>
</svelte:head>

<div class="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 font-sans select-none relative overflow-hidden">
	<!-- High Premium Ambient Gradients -->
	<div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none"></div>
	<div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-600/10 rounded-full blur-[140px] pointer-events-none"></div>

	<div class="w-full max-w-md border border-slate-800/80 bg-slate-900/40 backdrop-blur-2xl rounded-2xl p-8 shadow-2xl relative z-10 text-center space-y-8">
		
		<!-- Icon & State Display -->
		<div class="flex justify-center">
			{#if syncState === 'ACTIVE'}
				<div class="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-1 scale-105 transition-transform duration-300">
					<CheckCircle2 size={32} class="animate-bounce" />
				</div>
			{:else}
				<div class="relative h-14 w-14 mb-1">
					<div class="absolute inset-0 rounded-full border-4 border-slate-800"></div>
					<div class="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-amber-500/40 animate-spin"></div>
				</div>
			{/if}
		</div>

		<!-- Headers -->
		<div class="space-y-3">
			{#if syncState === 'ACTIVE'}
				<h2 class="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
					Configuration Locked! <Sparkles class="text-yellow-400 animate-pulse" size={20} />
				</h2>
				<p class="text-sm text-slate-400 leading-relaxed px-4">
					Meta ingestion pipeline verified. Opening control cluster panels...
				</p>
			{:else}
				<h2 class="text-xl font-bold text-white tracking-tight">
					Connecting with Meta{dots}
				</h2>
				<p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
					We've launched the secure **Meta WhatsApp Onboarding Portal** in a new tab. Please complete the setup there, and then **come back to this page** to watch your assets sync.
				</p>
			{/if}
		</div>

		<!-- Visual Step Guide -->
		{#if syncState !== 'ACTIVE'}
			<div class="bg-blue-950/20 border border-blue-800/30 p-4 rounded-xl text-left space-y-2 animate-in fade-in duration-500">
				<span class="text-[9px] uppercase tracking-widest font-black text-blue-400">Onboarding Steps</span>
				<ol class="text-[11px] text-slate-400 list-decimal list-inside space-y-1 leading-relaxed">
					<li>Follow the instructions in the newly opened Meta tab.</li>
					<li>Confirm your business profile and phone number.</li>
					<li>Once completed, **return to this tab** to watch activation lock.</li>
				</ol>
			</div>
		{/if}

		<!-- Modern Onboarding Progress Tracker Card -->
		<div class="w-full space-y-3 border-t border-slate-800/80 pt-5 text-left">
			<div class="flex items-center gap-3 text-xs">
				<div class="h-4 w-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center font-bold">✓</div>
				<span class="text-slate-300 font-medium">Meta Profile Authentication Verified</span>
			</div>
			
			<div class="flex items-center gap-3 text-xs">
				<div class="h-4 w-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center font-bold">✓</div>
				<span class="text-slate-300 font-medium">WABA Client Workspace Handshake Received</span>
			</div>

			<div class="flex items-center gap-3 text-xs">
				{#if syncState === 'ACTIVE'}
					<div class="h-4 w-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center font-bold">✓</div>
					<span class="text-slate-300 font-medium">Approved Phone Ingress Active</span>
				{:else}
					<div class="h-4 w-4 border border-slate-700 rounded-full flex items-center justify-center">
						<div class="h-1.5 w-1.5 bg-blue-500 rounded-full animate-ping"></div>
					</div>
					<span class="text-slate-400 animate-pulse font-medium">Intercepting Approved Phone Ingress Webhook...</span>
				{/if}
			</div>
		</div>

		{#if connectivityFault}
			<div class="mt-5 w-full rounded-lg bg-rose-950/20 border border-rose-900/50 p-3 text-xs text-rose-400 font-medium font-mono">
				{connectivityFault}
			</div>
		{/if}

		{#if showResetHatch}
			<div class="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
				<a 
					href="/dashboard" 
					class="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4 font-medium"
				>
					← Back to dashboard to restart setup
				</a>
			</div>
		{/if}

		<!-- Footer Info -->
		<div class="pt-4 border-t border-white/5 flex items-center justify-center gap-2 opacity-50">
			<svg class="w-4 h-4 text-cyan-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
			</svg>
			<span class="text-[9px] uppercase tracking-widest font-bold text-slate-400">Asynchronous Webhook Sync Engine</span>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: #020617;
	}
</style>
