<script lang="ts">
	import { goto } from '$app/navigation';
	import { Sparkles, CheckCircle2 } from 'lucide-svelte';

	// Svelte 5 Runes States
	let status = $state<'PENDING_ONBOARDING' | 'ACTIVE' | 'UNCONNECTED'>('PENDING_ONBOARDING');
	let polling = $state(true);
	let elapsed = $state(0);
	let showRescue = $state(false);
	let connectivityFault = $state('');

	// Derived stepIndex (0=creating, 1=waiting for Meta, 2=activating, 3=done)
	const stepIndex = $derived(
		status === 'ACTIVE' ? 3 :
		status === 'UNCONNECTED' ? 0 :
		elapsed < 5 ? 0 :
		elapsed < 15 ? 1 : 2
	);

	// Derived animated dots (...) derived off elapsed
	const dots = $derived('.'.repeat((elapsed % 3) + 1));

	const steps = [
		{ label: 'Creating configuration' },
		{ label: 'Waiting for Meta profile handshake' },
		{ label: 'Activating event streams' },
		{ label: 'Workspace active' }
	];

	let activeController: AbortController | null = null;
	let timerId: any = null;

	async function doPoll() {
		if (!polling || status === 'ACTIVE' || elapsed >= 300) return;

		// Abort in-flight request
		if (activeController) {
			activeController.abort();
		}
		activeController = new AbortController();

		try {
			const res = await fetch('/api/tenant/status', {
				signal: activeController.signal
			});
			if (!res.ok) throw new Error('Status check failed');
			const data = await res.json();
			status = data.whatsapp_status;
			connectivityFault = '';
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				connectivityFault = err.message || 'State verification connection drop';
			}
		} finally {
			if (status !== 'ACTIVE' && polling && elapsed < 300) {
				// Interval backoff: 3s for first 30s, 8s thereafter
				const delay = elapsed <= 30 ? 3000 : 8000;
				timerId = setTimeout(doPoll, delay);
			}
		}
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') {
			if (status !== 'ACTIVE' && elapsed < 300) {
				polling = true;
				if (timerId) clearTimeout(timerId);
				doPoll();
			}
		} else {
			polling = false;
			if (timerId) {
				clearTimeout(timerId);
				timerId = null;
			}
			if (activeController) {
				activeController.abort();
				activeController = null;
			}
		}
	}

	// 1-second interval to tick elapsed time
	$effect(() => {
		if (polling && status !== 'ACTIVE' && elapsed < 300) {
			const interval = setInterval(() => {
				elapsed += 1;
				if (elapsed >= 15) {
					showRescue = true;
				}
				if (elapsed >= 300) {
					polling = false;
				}
			}, 1000);
			return () => clearInterval(interval);
		}
	});

	// Visibilitychange listener and initial poll trigger
	$effect(() => {
		if (typeof document === 'undefined') return;

		if (document.visibilityState === 'visible') {
			polling = true;
			doPoll();
		} else {
			polling = false;
		}

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			if (timerId) clearTimeout(timerId);
			if (activeController) activeController.abort();
		};
	});

	// Auto-redirect effect when status turns ACTIVE
	$effect(() => {
		if (status === 'ACTIVE') {
			polling = false;
			if (timerId) clearTimeout(timerId);
			if (activeController) activeController.abort();

			const redirectTimer = setTimeout(() => {
				goto('/dashboard');
			}, 1500);

			return () => clearTimeout(redirectTimer);
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

	<div class="w-full max-w-md border border-slate-800/80 bg-slate-900/40 backdrop-blur-2xl rounded-2xl p-8 shadow-2xl relative z-10 text-center space-y-8 animate-in fade-in duration-300">
		
		<!-- Icon & State Display -->
		<div class="flex justify-center">
			{#if status === 'ACTIVE'}
				<!-- Green Checkmark Scale-in Success View -->
				<div class="h-16 w-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mb-1 scale-105 transition-transform duration-500 ease-out animate-in zoom-in-50">
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
			{#if status === 'ACTIVE'}
				<h2 class="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
					Connected! <Sparkles class="text-yellow-400 animate-pulse" size={20} />
				</h2>
				<p class="text-sm text-slate-400 leading-relaxed px-4">
					Meta ingestion pipeline verified. Redirecting to your dashboard...
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

		<!-- Visual Step Guide (only when not active) -->
		{#if status !== 'ACTIVE'}
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
		{#if status !== 'ACTIVE'}
			<div class="w-full space-y-6 border-t border-slate-800/80 pt-6 text-left">
				{#each steps as step, i}
					<div class="flex items-start gap-4 relative">
						<!-- Left column: Icon and Connector Line -->
						<div class="flex flex-col items-center shrink-0 w-5 relative">
							<!-- Step Dot / Checkmark -->
							{#if i < stepIndex}
								<!-- Blue check mark (completed step) -->
								<div class="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold text-xs relative z-10">
									✓
								</div>
							{:else if i === stepIndex}
								<!-- Animated blue pulse dot (current step) -->
								<div class="h-5 w-5 rounded-full bg-blue-950 border border-blue-500 flex items-center justify-center relative z-10">
									<span class="h-3 w-3 rounded-full bg-blue-500/50 animate-ping absolute"></span>
									<span class="h-2 w-2 rounded-full bg-blue-500 relative"></span>
								</div>
							{:else}
								<!-- Dim slate circle (pending step) -->
								<div class="h-5 w-5 rounded-full bg-slate-900 border border-slate-800/80 relative z-10"></div>
							{/if}

							<!-- Connector line to next step -->
							{#if i < steps.length - 1}
								<div class="absolute top-5 bottom-[-24px] w-0.5 bg-slate-800"></div>
							{/if}
						</div>

						<!-- Right column: Text Label -->
						<div class="pt-0.5 flex flex-col">
							<span class="text-xs font-semibold {i <= stepIndex ? 'text-slate-200' : 'text-slate-500'}">
								{step.label}{i === stepIndex ? dots : ''}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if connectivityFault}
			<div class="mt-5 w-full rounded-lg bg-rose-950/20 border border-rose-900/50 p-3 text-xs text-rose-400 font-medium font-mono">
				{connectivityFault}
			</div>
		{/if}

		<!-- Polling Timeout Manual Fallback -->
		{#if !polling && status !== 'ACTIVE'}
			<div class="mt-4 p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs text-left animate-in fade-in duration-300">
				<p class="font-semibold text-slate-200 mb-2">Sync Taking Longer Than Expected</p>
				<p class="mb-3 leading-relaxed">
					We haven't received confirmation from Meta yet. If you have finished the setup in the other tab, check status manually below:
				</p>
				<button
					onclick={() => {
						elapsed = 0;
						polling = true;
						showRescue = false;
						doPoll();
					}}
					class="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98] shadow-md shadow-blue-950/30"
				>
					Check Status Now
				</button>
			</div>
		{/if}

		<!-- Rescue Escape Hatch (after 15s) -->
		{#if showRescue && status !== 'ACTIVE'}
			<div class="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
				<a 
					href="/dashboard" 
					class="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4 font-medium"
				>
					Taking longer than expected? Return to dashboard
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
