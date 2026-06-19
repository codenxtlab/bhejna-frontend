<script lang="ts">
	import { goto } from '$app/navigation';
	import { Sparkles, CheckCircle2 } from 'lucide-svelte';

	// Svelte 5 Runes States
	let status = $state<'PENDING_ONBOARDING' | 'ACTIVE' | 'UNCONNECTED' | 'ACTION_REQUIRED'>('PENDING_ONBOARDING');
	let polling = $state(true);
	let elapsed = $state(0);
	let showRescue = $state(false);
	let connectivityFault = $state('');

	// Derived stepIndex (0=creating, 1=waiting for Meta, 2=activating, 3=done)
	const stepIndex = $derived(
		status === 'ACTIVE' ? 3 : status === 'UNCONNECTED' ? 0 : elapsed < 5 ? 0 : elapsed < 15 ? 1 : 2
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
		if (!polling || status === 'ACTIVE' || status === 'ACTION_REQUIRED' || elapsed >= 300) return;

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
			if (status === 'ACTION_REQUIRED') {
				polling = false;
				if (timerId) clearTimeout(timerId);
				if (activeController) activeController.abort();
			}
			connectivityFault = '';
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				connectivityFault = err.message || 'State verification connection drop';
			}
		} finally {
			if (status !== 'ACTIVE' && status !== 'ACTION_REQUIRED' && polling && elapsed < 300) {
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

	// 1-second interval to tick elapsed time (visibility-gated)
	$effect(() => {
		if (
			polling &&
			status !== 'ACTIVE' &&
			status !== 'ACTION_REQUIRED' &&
			elapsed < 300 &&
			(typeof document === 'undefined' || document.visibilityState === 'visible')
		) {
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
			if (status !== 'ACTIVE' && status !== 'ACTION_REQUIRED') {
				polling = true;
				doPoll();
			}
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

<div
	class="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 p-4 font-sans select-none"
>
	<!-- High Premium Ambient Gradients -->
	<div
		class="pointer-events-none absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-blue-600/10 blur-[140px]"
	></div>
	<div
		class="pointer-events-none absolute right-[-10%] bottom-[-10%] h-[50%] w-[50%] rounded-full bg-amber-600/10 blur-[140px]"
	></div>

	<div
		class="animate-in fade-in relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center shadow-2xl backdrop-blur-2xl duration-300"
	>
		<!-- Icon & State Display -->
		<div class="flex justify-center">
			{#if status === 'ACTIVE'}
				<!-- Green Checkmark Scale-in Success View -->
				<div
					class="animate-zoom-in mb-1 flex h-16 w-16 scale-105 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
				>
					<CheckCircle2 size={32} class="animate-bounce" />
				</div>
			{:else if status === 'ACTION_REQUIRED'}
				<!-- Warning Triangle / Alert Icon -->
				<div
					class="animate-zoom-in mb-1 flex h-16 w-16 scale-105 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				</div>
			{:else}
				<div class="relative mb-1 h-14 w-14">
					<div class="absolute inset-0 rounded-full border-4 border-slate-800"></div>
					<div
						class="absolute inset-0 animate-spin rounded-full border-4 border-t-blue-500 border-r-amber-500/40"
					></div>
				</div>
			{/if}
		</div>

		<!-- Headers -->
		<div class="space-y-3">
			{#if status === 'ACTIVE'}
				<h2
					class="flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-white"
				>
					Connected! <Sparkles class="animate-pulse text-yellow-400" size={20} />
				</h2>
				<p class="px-4 text-sm leading-relaxed text-slate-400">
					Meta ingestion pipeline verified. Redirecting to your dashboard...
				</p>
			{:else if status === 'ACTION_REQUIRED'}
				<h2 class="text-xl font-bold tracking-tight text-white">
					Action Required
				</h2>
				<p class="px-4 text-sm leading-relaxed text-slate-300">
					We've connected your WhatsApp account but need one more step — our team will reach out.
				</p>
				<div class="pt-2">
					<a
						href="mailto:support@codenxtlab.tech"
						class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 transition-colors"
					>
						Contact Support
					</a>
				</div>
			{:else}
				<h2 class="text-xl font-bold tracking-tight text-white">
					Connecting with Meta{dots}
				</h2>
				<p class="mx-auto max-w-sm text-xs leading-relaxed text-slate-400">
					We've launched the secure **Meta WhatsApp Onboarding Portal** in a new tab. Please
					complete the setup there, and then **come back to this page** to watch your assets sync.
				</p>
			{/if}
		</div>

		<!-- Visual Step Guide (only when not active and not action_required) -->
		{#if status !== 'ACTIVE' && status !== 'ACTION_REQUIRED'}
			<div
				class="animate-in fade-in space-y-2 rounded-xl border border-blue-800/30 bg-blue-950/20 p-4 text-left duration-500"
			>
				<span class="text-[9px] font-black tracking-widest text-blue-400 uppercase"
					>Onboarding Steps</span
				>
				<ol class="list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-slate-400">
					<li>Follow the instructions in the newly opened Meta tab.</li>
					<li>Confirm your business profile and phone number.</li>
					<li>Once completed, **return to this tab** to watch activation lock.</li>
				</ol>
			</div>
		{/if}

		<!-- Modern Onboarding Progress Tracker Card -->
		{#if status !== 'ACTIVE' && status !== 'ACTION_REQUIRED'}
			<div class="w-full space-y-6 border-t border-slate-800/80 pt-6 text-left">
				{#each steps as step, i}
					<div class="relative flex items-start gap-4">
						<!-- Left column: Icon and Connector Line -->
						<div class="relative flex w-5 shrink-0 flex-col items-center">
							<!-- Step Dot / Checkmark -->
							{#if i < stepIndex}
								<!-- Blue check mark (completed step) -->
								<div
									class="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/20 text-xs font-bold text-blue-400"
								>
									✓
								</div>
							{:else if i === stepIndex}
								<!-- Animated blue pulse dot (current step) -->
								<div
									class="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-blue-500 bg-blue-950"
								>
									<span class="absolute h-3 w-3 animate-ping rounded-full bg-blue-500/50"></span>
									<span class="relative h-2 w-2 rounded-full bg-blue-500"></span>
								</div>
							{:else}
								<!-- Dim slate circle (pending step) -->
								<div
									class="relative z-10 h-5 w-5 rounded-full border border-slate-800/80 bg-slate-900"
								></div>
							{/if}

							<!-- Connector line to next step -->
							{#if i < steps.length - 1}
								<div class="absolute top-5 bottom-[-24px] w-0.5 bg-slate-800"></div>
							{/if}
						</div>

						<!-- Right column: Text Label -->
						<div class="flex flex-col pt-0.5">
							<span
								class="text-xs font-semibold {i <= stepIndex ? 'text-slate-200' : 'text-slate-500'}"
							>
								{step.label}{i === stepIndex ? dots : ''}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if connectivityFault}
			<div
				class="mt-5 w-full rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 font-mono text-xs font-medium text-rose-400"
			>
				{connectivityFault}
			</div>
		{/if}

		<!-- Polling Timeout Manual Fallback -->
		{#if !polling && status !== 'ACTIVE' && status !== 'ACTION_REQUIRED'}
			<div
				class="animate-in fade-in mt-4 rounded-xl border border-slate-700/60 bg-slate-800/80 p-4 text-left text-xs text-slate-400 duration-300"
			>
				<p class="mb-2 font-semibold text-slate-200">Sync Taking Longer Than Expected</p>
				<p class="mb-3 leading-relaxed">
					We haven't received confirmation from Meta yet. If you have finished the setup in the
					other tab, check status manually below:
				</p>
				<button
					onclick={() => {
						elapsed = 0;
						polling = true;
						showRescue = false;
						doPoll();
					}}
					class="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-blue-950/30 transition hover:bg-blue-500 active:scale-[0.98]"
				>
					Check Status Now
				</button>
			</div>
		{/if}

		<!-- Rescue Escape Hatch (after 15s) -->
		{#if showRescue && status !== 'ACTIVE' && status !== 'ACTION_REQUIRED'}
			<div class="animate-in fade-in slide-in-from-bottom-2 pt-2 duration-500">
				<a
					href="/dashboard"
					class="text-xs font-medium text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-300"
				>
					Taking longer than expected? Return to dashboard
				</a>
			</div>
		{/if}

		<!-- Rescue link for ACTION_REQUIRED -->
		{#if status === 'ACTION_REQUIRED'}
			<div class="pt-4 border-t border-white/5">
				<a
					href="/dashboard"
					class="text-xs font-medium text-slate-400 underline underline-offset-4 transition-colors hover:text-slate-200"
				>
					Return to dashboard
				</a>
			</div>
		{/if}

		<!-- Footer Info -->
		<div class="flex items-center justify-center gap-2 border-t border-white/5 pt-4 opacity-50">
			<svg
				class="h-4 w-4 animate-pulse text-cyan-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
				></path>
			</svg>
			<span class="text-[9px] font-bold tracking-widest text-slate-400 uppercase"
				>Asynchronous Webhook Sync Engine</span
			>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background-color: #020617;
	}

	@keyframes zoomIn {
		from {
			transform: scale(0.5);
			opacity: 0;
		}
		to {
			transform: scale(1.05);
			opacity: 1;
		}
	}
	.animate-zoom-in {
		animation: zoomIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}
</style>
