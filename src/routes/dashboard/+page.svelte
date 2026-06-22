<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance, deserialize } from '$app/forms';
	import { env } from '$env/dynamic/public';
	import { 
		CheckCircle2, 
		AlertCircle, 
		ExternalLink, 
		Copy, 
		ChevronRight, 
		ChevronDown, 
		Loader2, 
		LogOut,
		Key,
		Terminal,
		RefreshCw
	} from 'lucide-svelte';
	import type { MessageTemplate } from '$lib/api/generated/models';

	let { data, form } = $props();

	// Read directly from SvelteKit Load return as the Single Source of Truth
	let whatsappStatus = $derived(data.tenant?.whatsapp_status ?? 'UNCONNECTED');
	let userEmail = $derived(data.user?.email || '');

	// Local states for forms
	let waba_id = $state('');
	let phone_number_id = $state('');
	let error = $state('');
	let apiKey = $state('');
	let provisioning = $state(false);

	// Collapsible & visibility states
	let showManual = $state(false);
	let showApiKey = $state(false);
	let showSecret = $state(false);

	// API Playground state
	let recipientTarget = $state('');
	let playgroundType = $state<'text' | 'template'>('text');
	let testMessageBody = $state(
		'Hi there! 👋\n\nThis is a custom test message from the Bhejna uniform gateway.\nEverything is connected and working perfectly!'
	);
	let templateCode = $state('hello_world');
	let templateLanguage = $state('en_US');
	let testingPlayground = $state(false);

	// Response Panel state
	let playgroundResponse = $state<{
		success: boolean;
		jobId?: string;
		status?: string;
		roundTripMs?: number;
		code?: number;
		message?: string;
	} | null>(null);

	// Message Templates State
	let templates = $state<MessageTemplate[]>([]);
	let templatesLoading = $state(false);
	let templatesError = $state<string | null>(null);

	// Playground template configuration
	let selectedTemplateName = $state<string>('');
	let bodyParams = $state<string[]>([]);

	// Derived values for dynamic parameters
	const selectedTemplate = $derived(
		templates.find(t => t.name === selectedTemplateName && t.status === 'APPROVED') ?? null
	);

	const parsedBodySlots = $derived(
		parseBodySlots(selectedTemplate?.components ?? null)
	);

	const hasNamedParameters = $derived(
		parsedBodySlots.some(slot => {
			const content = slot.replace(/^\{\{|\}\}$/g, '').trim();
			return !/^\d+$/.test(content);
		})
	);

	$effect(() => {
		bodyParams = Array(parsedBodySlots.length).fill('');
	});

	function parseBodySlots(componentsInput: any): string[] {
		if (!componentsInput) return [];
		try {
			const comps = typeof componentsInput === 'string'
				? JSON.parse(componentsInput)
				: componentsInput;
			if (!Array.isArray(comps)) return [];
			const bodyComp = comps.find(
				(c) => c && c.type && c.type.toUpperCase() === 'BODY'
			);
			if (!bodyComp || typeof bodyComp.text !== 'string') return [];
			const matches = bodyComp.text.match(/\{\{([^}]+)\}\}/g);
			if (!matches) return [];
			
			const uniqueMatches = Array.from(new Set(matches)) as string[];

			// Check if all matched placeholders are numeric (like {{1}}, {{2}})
			const isAllNumeric = uniqueMatches.every(m => {
				const content = m.replace(/^\{\{|\}\}$/g, '').trim();
				return /^\d+$/.test(content);
			});

			if (isAllNumeric) {
				// Sort numerically based on the number inside the braces
				return uniqueMatches.sort((a, b) => {
					const numA = parseInt(a.replace(/^\{\{|\}\}$/g, '').trim(), 10);
					const numB = parseInt(b.replace(/^\{\{|\}\}$/g, '').trim(), 10);
					return numA - numB;
				});
			}

			return uniqueMatches;
		} catch (e) {
			return [];
		}
	}

	async function fetchTemplates() {
		templatesLoading = true;
		templatesError = null;
		try {
			const res = await fetch('/api/templates');
			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.message || 'Could not load templates');
			}
			const resData = await res.json();
			templates = resData.data || [];
		} catch (err: any) {
			console.error('Error fetching templates:', err);
			templatesError = err.message || 'Could not load templates. Check your connection.';
		} finally {
			templatesLoading = false;
		}
	}

	$effect(() => {
		fetchTemplates();
	});

	// Form Action states
	let updatingWebhook = $state(false);
	let rotatingSecret = $state(false);
	let resettingOnboarding = $state(false);
	let syncingEventStream = $state(false);

	let metaOnboardUrl = $derived(
		`https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${env.PUBLIC_META_APP_ID || '1594349876023947'}&config_id=${env.PUBLIC_META_CONFIG_ID || '1298428131650108'}`
	);

	// Inline validation states
	let webhookUrlValue = $state('');
	$effect(() => {
		webhookUrlValue = data.tenant?.webhook_url || '';
	});
	let webhookUrlDirty = $state(false);
	let isWebhookUrlValid = $derived(!webhookUrlDirty || webhookUrlValue.startsWith('https://'));

	// Timer / Onboarding pulse details
	let elapsed = $state(0);
	let activeController: AbortController | null = null;
	let pollTimeoutId: any = null;

	// Svelte 5 Toast Notifications
	let toasts = $state<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

	function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
		const id = Math.random().toString(36).substring(2, 9);
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 3000);
	}

	// Dynamic config generation
	async function handleCopyIntegrationConfig() {
		if (whatsappStatus !== 'ACTIVE') return;
		const config = {
			bhejna_config_version: '1',
			waba_id: data.tenant?.waba_id || '',
			phone_number: data.tenant?.phone_number || '',
			phone_number_id: data.tenant?.phone_number_id || '',
			api_key: data.tenant?.api_key || '',
			webhook_secret: data.tenant?.webhook_secret || '',
			whatsapp_status: data.tenant?.whatsapp_status || '',
			display_name: data.tenant?.display_name || data.tenant?.business_name || '',
			quality_rating: data.tenant?.quality_rating || '',
			messaging_limit: data.tenant?.messaging_limit ? Number(data.tenant.messaging_limit) : 250
		};
		await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
		showToast('Integration configuration copied to clipboard!', 'success');
	}

	// Trigger background onboarding sync
	async function fireProvision() {
		try {
			fetch('?/initializeOnboarding', {
				method: 'POST',
				body: new FormData()
			}).then(async (response) => {
				const result = deserialize(await response.text());
				if (result.type === 'success') {
					await invalidateAll();
					showToast('Onboarding process initialized', 'info');
				} else {
					console.error('Background onboarding initialization failed:', result);
					showToast('Onboarding initialization failed', 'error');
				}
			});
		} catch (err) {
			console.error('Failed to trigger background onboarding:', err);
		}
	}

	// Manual provision route fetch
	async function handleProvision(e: SubmitEvent) {
		e.preventDefault();
		provisioning = true;
		error = '';
		apiKey = '';

		try {
			const response = await fetch('/api/provision', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ waba_id, phone_number_id })
			});

			const resData = await response.json();

			if (!response.ok) throw new Error(resData.message || 'Provisioning failed');

			apiKey = resData.api_key;
			waba_id = '';
			phone_number_id = '';
			showToast('Bhejna API Key generated!', 'success');
			await invalidateAll();
		} catch (err: any) {
			error = err.message;
			showToast('Provisioning failed', 'error');
		} finally {
			provisioning = false;
		}
	}

	// API Playground trigger
	async function handleTestMessage() {
		testingPlayground = true;
		playgroundResponse = null;

		if (!recipientTarget) {
			playgroundResponse = { success: false, message: 'Recipient target is required for sending messages.' };
			testingPlayground = false;
			return;
		}

		const startTime = performance.now();
		try {
			const reqBody: any = {
				recipient_target: recipientTarget,
				type: playgroundType
			};

			if (playgroundType === 'template') {
				reqBody.template = {
					template_code: selectedTemplateName || templateCode || 'hello_world',
					language: selectedTemplate?.language || templateLanguage || 'en_US',
					components: parsedBodySlots.length > 0 ? [{
						type: 'body',
						parameters: bodyParams.map(p => ({ type: 'text', text: p }))
					}] : []
				};
			} else {
				reqBody.text_body = testMessageBody || 'This is a live test from the Bhejna uniform gateway!';
			}

			const res = await fetch('/api/test-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(reqBody)
			});

			const endTime = performance.now();
			const roundTripMs = Math.round(endTime - startTime);
			const resData = await res.json();

			if (!res.ok) throw new Error(resData.message || 'Failed to send test message');

			const jobId = resData.data?.job_id || resData.job_id || resData.id || 'Success';
			const status = resData.data?.status || resData.status || 'queued';
			
			playgroundResponse = {
				success: true,
				jobId,
				status,
				roundTripMs
			};
			showToast('Playground test message sent!', 'success');
		} catch (err: any) {
			const endTime = performance.now();
			const roundTripMs = Math.round(endTime - startTime);
			playgroundResponse = {
				success: false,
				message: err.message || 'An unexpected error occurred.',
				roundTripMs
			};
			showToast('Failed to send test message', 'error');
		} finally {
			testingPlayground = false;
		}
	}

	// Derived step index for onboarding tracking
	const stepIndex = $derived(
		whatsappStatus === 'ACTIVE' ? 3 : elapsed < 10 ? 0 : elapsed < 25 ? 1 : 2
	);

	// Polling task execution
	async function runStatusPoll() {
		if (whatsappStatus !== 'PENDING_ONBOARDING') return;

		if (activeController) {
			activeController.abort();
		}
		activeController = new AbortController();

		try {
			const res = await fetch('/api/tenant/status', {
				signal: activeController.signal
			});
			if (!res.ok) throw new Error('Status check failed');
			const resData = await res.json();

			if (resData.whatsapp_status && resData.whatsapp_status !== 'PENDING_ONBOARDING') {
				await invalidateAll();
				showToast(`Connection status updated: ${resData.whatsapp_status}`, 'success');
			}
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				console.error('Handshake verification failed:', err);
			}
		} finally {
			if (whatsappStatus === 'PENDING_ONBOARDING') {
				pollTimeoutId = setTimeout(runStatusPoll, 3000);
			}
		}
	}

	// Onboarding timer
	$effect(() => {
		if (whatsappStatus === 'PENDING_ONBOARDING') {
			const interval = setInterval(() => {
				elapsed += 1;
			}, 1000);
			return () => clearInterval(interval);
		} else {
			elapsed = 0;
		}
	});

	// Polling effect management
	$effect(() => {
		if (whatsappStatus === 'PENDING_ONBOARDING') {
			runStatusPoll();
			return () => {
				if (pollTimeoutId) clearTimeout(pollTimeoutId);
				if (activeController) activeController.abort();
			};
		}
	});

	// Dynamic form feedback handler
	$effect(() => {
		if (form?.message) {
			if (form.success) {
				showToast(form.message, 'success');
			} else {
				showToast(form.message, 'error');
			}
		}
	});
</script>

<svelte:head>
	<title>Dashboard | Bhejna</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-blue-500/30 selection:text-blue-200">
	<!-- Sticky Top Bar -->
	<nav class="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
			<div class="flex items-center space-x-2.5">
				<img src="/favicon.svg" alt="Bhejna Logo" class="h-6 w-6" />
				<span class="text-lg font-bold tracking-tight text-white">Bhejna</span>
			</div>
			
			<div class="flex items-center space-x-6">
				<a
					href="/docs"
					class="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
				>
					Documentation
				</a>
				
				<!-- Connection Status Pill -->
				<div class="hidden sm:flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-1.5 border border-slate-800 text-xs">
					{#if whatsappStatus === 'ACTIVE'}
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
						<span class="font-medium text-emerald-400">Gateway Active</span>
					{:else if whatsappStatus === 'PENDING_ONBOARDING'}
						<span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
						<span class="font-medium text-amber-400">Awaiting Meta Sync</span>
					{:else if whatsappStatus === 'ACTION_REQUIRED'}
						<span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
						<span class="font-medium text-red-400">Action Required</span>
					{:else}
						<span class="h-1.5 w-1.5 rounded-full bg-slate-600"></span>
						<span class="font-medium text-slate-400 font-mono">UNCONNECTED</span>
					{/if}
				</div>

				<span class="text-xs text-slate-400 font-mono hidden md:inline">{userEmail}</span>
				
				<form method="POST" action="/dashboard?/signout" use:enhance>
					<button
						type="submit"
						class="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white px-3.5 py-2 text-xs font-semibold text-slate-400 transition-all active:scale-[0.98]"
					>
						<LogOut size={12} />
						Sign Out
					</button>
				</form>
			</div>
		</div>
	</nav>

	<!-- Main Body Layout -->
	<main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-8 border-b border-slate-800 pb-5">
			<h1 class="text-xl font-bold tracking-tight text-white font-sans">API & Gateway Settings</h1>
			<p class="mt-1 text-xs text-slate-400">
				Manage your WhatsApp Business Account connection, webhook streams, and security credentials.
			</p>
		</div>

		<!-- Desktop Two-Column Grid -->
		<div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
			
			<!-- Left Column: Connections & Configuration -->
			<div class="flex flex-col gap-6 lg:col-span-8">
				
				<!-- CONNECTION HERO: State branches -->
				
				{#if whatsappStatus === 'UNCONNECTED'}
					<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6">
						<div class="flex items-center gap-2.5">
							<span class="relative flex h-3 w-3">
								<span class="relative inline-flex rounded-full h-3 w-3 bg-slate-600"></span>
							</span>
							<h3 class="text-sm font-semibold text-slate-100">WhatsApp Workspace Connection</h3>
						</div>

						<div class="rounded-xl border border-blue-500/10 bg-blue-500/5 p-5 space-y-4">
							<div>
								<h4 class="text-xs font-bold text-blue-400 tracking-wide uppercase">Embedded Signup (Recommended)</h4>
								<p class="mt-1 text-xs text-slate-400 leading-relaxed">
									Instantly register and connect your WhatsApp Business profile via Meta's secure onboarding workflow.
								</p>
							</div>
							
							<a
								href={metaOnboardUrl}
								target="_blank"
								rel="noopener"
								onclick={fireProvision}
								class="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] py-2.5 text-sm font-semibold text-white transition-all shadow-md"
							>
								<ExternalLink size={14} />
								Connect WhatsApp Workspace
							</a>
						</div>

						<!-- Collapsible Manual Provisioning -->
						<div class="mt-4 border-t border-slate-800 pt-4">
							<button
								type="button"
								onclick={() => (showManual = !showManual)}
								class="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-400 select-none transition-colors"
							>
								<span>Or Manual Provisioning</span>
								<ChevronRight size={14} class="transition-transform duration-150 {showManual ? 'rotate-90' : ''}" />
							</button>

							{#if showManual}
								<form onsubmit={handleProvision} class="mt-4 space-y-4 animate-in fade-in duration-200">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div class="space-y-1.5">
											<label for="waba_id" class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">WABA ID</label>
											<input
												type="text"
												id="waba_id"
												bind:value={waba_id}
												required
												placeholder="e.g. 1029384756..."
												class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
											/>
										</div>
										<div class="space-y-1.5">
											<label for="phone_number_id" class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Phone Number ID</label>
											<input
												type="text"
												id="phone_number_id"
												bind:value={phone_number_id}
												required
												placeholder="e.g. 987654321..."
												class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
											/>
										</div>
									</div>

									<button
										type="submit"
										disabled={provisioning || !waba_id.trim() || !phone_number_id.trim()}
										class="w-full rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
									>
										{#if provisioning}
											<Loader2 size={16} class="animate-spin" />
											Provisioning...
										{:else}
											Provision Bhejna API Key
										{/if}
									</button>

									{#if error}
										<div class="rounded-xl border border-red-500/20 bg-red-950/10 p-3 text-xs text-red-400 font-mono">
											❌ {error}
										</div>
									{/if}

									{#if apiKey}
										<div class="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
											<span class="block text-xs font-semibold text-emerald-400 tracking-wide uppercase">API Key Generated</span>
											<div class="flex items-center gap-2">
												<span class="font-mono text-xs text-slate-300 break-all bg-slate-950/50 px-2 py-1.5 rounded-lg border border-slate-800 flex-1">{apiKey}</span>
												<button
													type="button"
													onclick={() => {
														navigator.clipboard.writeText(apiKey);
														showToast('Generated API Key copied', 'success');
													}}
													class="rounded-lg bg-slate-950/60 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-950 transition-all border border-slate-800"
												>
													<Copy size={14} />
												</button>
											</div>
											<span class="block text-[9px] text-slate-500 italic">Save this key securely. It will not be shown again.</span>
										</div>
									{/if}
								</form>
							{/if}
						</div>
					</div>
				{/if}

				{#if whatsappStatus === 'PENDING_ONBOARDING'}
					<div class="rounded-2xl border border-amber-500/20 bg-slate-900 p-6 space-y-6">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="relative flex h-3 w-3">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
								</span>
								<h3 class="text-sm font-semibold text-slate-100 font-sans">Awaiting Meta Handshake</h3>
							</div>
							<span class="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/25">Pending</span>
						</div>

						<p class="text-xs text-slate-400 leading-relaxed font-sans">
							Your WhatsApp Business Account setup is initiated. We are listening for activation callbacks from Meta.
						</p>

						<!-- 3-Step Progress Tracker -->
						<div class="space-y-4">
							<div class="flex items-center justify-between text-xs text-slate-400">
								<span class="flex items-center gap-1.5 font-medium">
									<span class="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
									listening for Meta...
								</span>
								<span class="font-mono text-slate-500">elapsed: {elapsed}s</span>
							</div>
							
							<div class="grid grid-cols-3 gap-2 relative">
								<div class="absolute top-4 left-0 right-0 h-0.5 bg-slate-800 -z-10"></div>
								
								<div class="flex flex-col items-center text-center">
									<div class="h-8 w-8 rounded-full flex items-center justify-center border text-xs font-semibold z-10 transition-colors duration-300
										{stepIndex >= 1 ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold' : 'bg-slate-900 border-amber-500/50 text-amber-400 animate-pulse'}"
									>
										{#if stepIndex >= 1}✓{:else}1{/if}
									</div>
									<span class="mt-2 text-xs font-medium {stepIndex >= 0 ? 'text-amber-300' : 'text-slate-500'}">Shared</span>
								</div>

								<div class="flex flex-col items-center text-center">
									<div class="h-8 w-8 rounded-full flex items-center justify-center border text-xs font-semibold z-10 transition-colors duration-300
										{stepIndex >= 2 ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold' : 
										 stepIndex === 1 ? 'bg-slate-900 border-amber-500/50 text-amber-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'}"
									>
										{#if stepIndex >= 2}✓{:else}2{/if}
									</div>
									<span class="mt-2 text-xs font-medium {stepIndex >= 1 ? 'text-amber-300' : 'text-slate-500'}">Subscribed</span>
								</div>

								<div class="flex flex-col items-center text-center">
									<div class="h-8 w-8 rounded-full flex items-center justify-center border text-xs font-semibold z-10 transition-colors duration-300
										{stepIndex >= 3 ? 'bg-emerald-500 border-emerald-600 text-slate-950 font-bold' : 
										 stepIndex === 2 ? 'bg-slate-900 border-amber-500/50 text-amber-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'}"
									>
										{#if stepIndex >= 3}✓{:else}3{/if}
									</div>
									<span class="mt-2 text-xs font-medium {stepIndex >= 2 ? 'text-amber-300' : 'text-slate-500'}">Active</span>
								</div>
							</div>
						</div>

						<form method="POST" action="?/cancelOnboarding" use:enhance={() => {
							resettingOnboarding = true;
							return async ({ update }) => {
								resettingOnboarding = false;
								await update();
							};
						}} class="mt-4">
							<button
								type="submit"
								disabled={resettingOnboarding}
								class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-950/20 hover:border-red-500/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if resettingOnboarding}
									<Loader2 size={16} class="animate-spin" />
									Resetting...
								{:else}
									Reset & Start Over
								{/if}
							</button>
						</form>
					</div>
				{/if}

				{#if whatsappStatus === 'ACTIVE'}
					<div class="rounded-2xl border border-emerald-500/20 bg-slate-900 p-6 shadow-[0_0_30px_-5px_rgba(16,185,129,0.06)] relative overflow-hidden space-y-6">
						<div class="absolute top-0 right-0 h-[120px] w-[120px] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none"></div>

						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="relative flex h-2.5 w-2.5">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
								</span>
								<h3 class="text-sm font-semibold text-slate-100 font-sans">Gateway Active & Operational</h3>
							</div>
							<span class="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">Connected</span>
						</div>

						<!-- Metadata Grid -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="space-y-1.5">
								<span class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">WABA ID</span>
								<button
									type="button"
									onclick={() => {
										navigator.clipboard.writeText(data.tenant?.waba_id || '');
										showToast('WABA ID copied to clipboard', 'success');
									}}
									class="w-full flex items-center justify-between rounded-xl bg-slate-950 px-3.5 py-2.5 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-950/80 hover:shadow-md transition-all font-mono text-xs text-slate-300 text-left group"
								>
									<span class="truncate">{data.tenant?.waba_id || 'N/A'}</span>
									<Copy size={12} class="text-slate-500 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
								</button>
							</div>

							<div class="space-y-1.5">
								<span class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Phone Number ID</span>
								<button
									type="button"
									onclick={() => {
										navigator.clipboard.writeText(data.tenant?.phone_number_id || '');
										showToast('Phone Number ID copied to clipboard', 'success');
									}}
									class="w-full flex items-center justify-between rounded-xl bg-slate-950 px-3.5 py-2.5 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-950/80 hover:shadow-md transition-all font-mono text-xs text-slate-300 text-left group"
								>
									<span class="truncate">{data.tenant?.phone_number_id || 'N/A'}</span>
									<Copy size={12} class="text-slate-500 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
								</button>
							</div>

							<div class="space-y-1.5">
								<span class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Quality Rating</span>
								<div class="flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 border border-slate-800 text-xs font-mono">
									{#if data.tenant?.quality_rating === 'GREEN'}
										<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
										<span class="text-emerald-400">GREEN (HIGH)</span>
									{:else if data.tenant?.quality_rating === 'YELLOW'}
										<span class="h-2 w-2 rounded-full bg-amber-500"></span>
										<span class="text-amber-400">YELLOW (MEDIUM)</span>
									{:else if data.tenant?.quality_rating === 'RED'}
										<span class="h-2 w-2 rounded-full bg-red-500"></span>
										<span class="text-red-400">RED (LOW)</span>
									{:else}
										<span class="h-2 w-2 rounded-full bg-slate-600"></span>
										<span class="text-slate-400">{data.tenant?.quality_rating || 'GREEN'}</span>
									{/if}
								</div>
							</div>

							<div class="space-y-1.5">
								<span class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Messaging Limit</span>
								<button
									type="button"
									onclick={() => {
										navigator.clipboard.writeText(String(data.tenant?.messaging_limit || 250));
										showToast('Messaging limit copied', 'success');
									}}
									class="w-full flex items-center justify-between rounded-xl bg-slate-950 px-3.5 py-2.5 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-950/80 hover:shadow-md transition-all font-mono text-xs text-slate-300 text-left group"
								>
									<span>{data.tenant?.messaging_limit || 250} / day</span>
									<Copy size={12} class="text-slate-500 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
								</button>
							</div>
						</div>

						<details class="group border-t border-slate-800 pt-5">
							<summary class="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-500 select-none hover:text-slate-400 transition-colors">
								<span>Advanced Diagnostics & Recovery</span>
								<ChevronDown size={14} class="text-slate-500 transition-transform group-open:rotate-180" />
							</summary>

							<div class="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4 space-y-3">
								<p class="text-[11px] leading-relaxed text-amber-400/90 font-medium">
									<strong>Integration Rescue Hatch:</strong> If incoming messages or status checkmarks are not delivering, the Meta App stream registration may have encountered a network timeout. Click below to synchronize your event stream.
								</p>

								<form
									method="POST"
									action="?/retryWabaSubscription"
									use:enhance={() => {
										syncingEventStream = true;
										return async ({ update }) => {
											syncingEventStream = false;
											await update();
										};
									}}
								>
									<button
										type="submit"
										disabled={syncingEventStream}
										class="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all active:scale-[0.98]"
									>
										{#if syncingEventStream}
											<Loader2 size={12} class="animate-spin" />
											Syncing...
										{:else}
											Sync Event Stream Allocation
										{/if}
									</button>
								</form>
							</div>
						</details>
					</div>
				{/if}

				{#if whatsappStatus === 'ACTION_REQUIRED'}
					<div class="rounded-2xl border border-red-500/20 bg-slate-900 p-6 space-y-6">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="relative flex h-3 w-3">
									<span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
								</span>
								<h3 class="text-sm font-semibold text-slate-100 font-sans">Action Required</h3>
							</div>
							<span class="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 border border-red-500/25">Paused</span>
						</div>

						<div class="rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs text-red-300 leading-relaxed font-mono">
							{data.tenant?.pause_reason || 'There was a problem registering this phone number. Please check your Meta Business Suite configuration.'}
						</div>

						<a
							href="mailto:support@codenxtlab.tech"
							class="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] py-2.5 text-sm font-semibold text-white transition-all shadow-md"
						>
							Contact Support
						</a>
					</div>
				{/if}

				<!-- API KEY Card -->
				<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Key size={16} class="text-blue-500 animate-pulse" />
							<h3 class="text-sm font-semibold text-slate-100 font-sans">API Authentication</h3>
						</div>
						<span class="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-mono text-slate-500 border border-slate-800">nxt_live</span>
					</div>
					
					<p class="text-xs text-slate-400 leading-relaxed">
						Use this credential key to authenticate requests targeting the Bhejna uniform gateway API endpoint.
					</p>

					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<div class="flex-1 font-mono text-xs text-slate-300 bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 overflow-hidden text-ellipsis whitespace-nowrap select-all">
								{showApiKey ? (data.tenant?.api_key || 'N/A') : 'nxt_live_••••••••••••••••••••••••••••••••'}
							</div>
							<button
								type="button"
								onclick={() => (showApiKey = !showApiKey)}
								class="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0 active:scale-[0.98]"
								title={showApiKey ? 'Hide Key' : 'Reveal Key'}
							>
								{#if showApiKey}Hide{:else}Reveal{/if}
							</button>
							<button
								type="button"
								onclick={() => {
									if (data.tenant?.api_key) {
										navigator.clipboard.writeText(data.tenant.api_key);
										showToast('API Key copied to clipboard', 'success');
									}
								}}
								class="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0 active:scale-[0.98]"
								title="Copy Key"
							>
								Copy
							</button>
						</div>
						<span class="block text-[9px] text-slate-500 italic">
							Never check this key into version control or expose it to client-side environments.
						</span>
					</div>
				</div>

				<!-- WEBHOOK Card -->
				<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6">
					<div class="flex items-center gap-2">
						<Terminal size={16} class="text-blue-500" />
						<h3 class="text-sm font-semibold text-slate-100 font-sans">Webhook Configuration</h3>
					</div>

					<form
						method="POST"
						action="?/updateWebhook"
						use:enhance={() => {
							updatingWebhook = true;
							webhookUrlDirty = true;
							return async ({ update }) => {
								updatingWebhook = false;
								await update();
							};
						}}
						class="space-y-4"
					>
						<div class="space-y-1.5">
							<label for="webhook_url" class="block text-xs font-medium tracking-wider text-slate-400 uppercase">Webhook URL</label>
							<input
								type="url"
								name="webhook_url"
								id="webhook_url"
								bind:value={webhookUrlValue}
								required
								pattern="https://.*"
								onblur={() => webhookUrlDirty = true}
								placeholder="https://your-domain.com/webhooks/bhejna"
								class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
							/>
							{#if !isWebhookUrlValid}
								<span class="block text-xs text-red-400 font-mono">❌ Webhook URL must start with https://</span>
							{/if}
							<p class="text-[10px] text-slate-500">
								Bhejna will POST status updates and inbound user messages to this URL.
							</p>
						</div>

						<button
							type="submit"
							disabled={updatingWebhook || !webhookUrlValue.startsWith('https://')}
							class="w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] py-2.5 text-sm font-semibold text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
						>
							{#if updatingWebhook}
								<Loader2 size={16} class="animate-spin" />
								Saving...
							{:else}
								Save Webhook Settings
							{/if}
						</button>
					</form>

					{#if data.tenant?.webhook_secret}
						<div class="pt-6 border-t border-slate-800 space-y-4">
							<div class="space-y-1.5">
								<span class="block text-xs font-medium tracking-wider text-slate-400 uppercase">Webhook Secret</span>
								<div class="flex items-center gap-2">
									<div class="flex-1 font-mono text-xs text-slate-300 break-all bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 overflow-hidden text-ellipsis whitespace-nowrap select-all">
										{showSecret ? data.tenant.webhook_secret : '••••••••••••••••••••••••••••••••'}
									</div>
									<button
										type="button"
										onclick={() => (showSecret = !showSecret)}
										class="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0 active:scale-[0.98]"
										title={showSecret ? 'Hide Secret' : 'Show Secret'}
									>
										{#if showSecret}Hide{:else}Show{/if}
									</button>
									<button
										type="button"
										onclick={() => {
											if (data.tenant?.webhook_secret) {
												navigator.clipboard.writeText(data.tenant.webhook_secret);
												showToast('Webhook secret copied to clipboard', 'success');
											}
										}}
										class="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all shrink-0 active:scale-[0.98]"
										title="Copy Secret"
									>
										Copy
									</button>
								</div>
							</div>
							
							<div class="flex items-center justify-between">
								<span class="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
									HMAC-SHA256 Payload Verification
								</span>
								<form
									method="POST"
									action="?/rotateSecret"
									use:enhance={() => {
										rotatingSecret = true;
										return async ({ update }) => {
											rotatingSecret = false;
											await update();
										};
									}}
								>
									<button
										type="submit"
										disabled={rotatingSecret}
										class="text-xs text-red-400 hover:text-red-300 underline underline-offset-4 transition-colors font-medium flex items-center gap-1.5"
									>
										{#if rotatingSecret}
											<Loader2 size={12} class="animate-spin" />
											Rotating...
										{:else}
											Rotate Secret Key
										{/if}
									</button>
								</form>
							</div>
						</div>
					{/if}

					<div class="pt-4 border-t border-slate-800">
						<button
							type="button"
							onclick={handleCopyIntegrationConfig}
							disabled={whatsappStatus !== 'ACTIVE'}
							class="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:text-white px-4 py-2.5 text-xs font-semibold text-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
							title={whatsappStatus === 'ACTIVE' ? '' : 'Connect your WhatsApp account first'}
						>
							<Terminal size={12} />
							Copy Integration Config
						</button>
					</div>
				</div>

				<!-- TEMPLATES Card -->
				<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6">
					<div class="flex items-center justify-between">
						<div class="space-y-1">
							<h3 class="text-sm font-semibold text-slate-100 font-sans">Message Templates</h3>
							<p class="text-xs text-slate-400 leading-relaxed font-sans">
								Local mirror of your templates synchronized with Meta.
							</p>
						</div>
						<div class="flex items-center space-x-4">
							{#if data.tenant?.waba_id}
								<a
									href="https://business.facebook.com/wa/manage/message-templates/?waba_id={data.tenant.waba_id}"
									target="_blank"
									rel="noopener noreferrer"
									class="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
								>
									Manage in WhatsApp Manager <ExternalLink size={12} />
								</a>
							{:else}
								<span class="text-xs text-slate-500 select-none cursor-not-allowed" title="Connect WhatsApp to manage templates">
									Connect WhatsApp to manage templates
								</span>
							{/if}
							<button
								type="button"
								onclick={fetchTemplates}
								disabled={templatesLoading}
								class="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-905 transition-all disabled:opacity-50 shrink-0"
								title="Refresh templates"
							>
								<RefreshCw size={14} class={templatesLoading ? 'animate-spin' : ''} />
							</button>
						</div>
					</div>

					{#if templatesLoading && templates.length === 0}
						<!-- Skeleton Rows -->
						<div class="space-y-3 animate-pulse">
							{#each Array(3) as _}
								<div class="h-10 bg-slate-950/60 rounded-lg border border-slate-850"></div>
							{/each}
						</div>
					{:else if templatesError && templates.length === 0}
						<div class="rounded-xl border border-red-500/20 bg-red-950/10 p-4 flex flex-col items-start gap-2">
							<span class="text-xs font-semibold text-red-400 font-mono">Could not load templates.</span>
							<p class="text-xs text-red-300/80 font-mono leading-relaxed">{templatesError}</p>
							<button
								type="button"
								onclick={fetchTemplates}
								class="mt-1 rounded-lg border border-red-500/20 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-950/30 transition-all"
							>
								Retry Fetch
							</button>
						</div>
					{:else if templates.length === 0}
						<div class="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center space-y-2">
							<p class="text-xs text-slate-400">
								No templates yet. Create your first template in WhatsApp Manager, then it will appear here once approved.
							</p>
						</div>
					{:else}
						<div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
							<table class="w-full text-left border-collapse">
								<thead>
									<tr class="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-500 uppercase select-none">
										<th class="px-4 py-3 font-semibold">Name</th>
										<th class="px-4 py-3 font-semibold">Language</th>
										<th class="px-4 py-3 font-semibold">Category</th>
										<th class="px-4 py-3 font-semibold">Status</th>
										<th class="px-4 py-3 font-semibold">Quality</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-850 font-mono text-xs text-slate-300">
									{#each templates as template (template.id)}
										<tr class="hover:bg-slate-900/40 transition-colors">
											<td class="px-4 py-3 font-semibold text-slate-200">{template.name}</td>
											<td class="px-4 py-3 text-slate-400">{template.language}</td>
											<td class="px-4 py-3 text-slate-400">{template.category}</td>
											<td class="px-4 py-3">
												<span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border
													{template.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 
													 template.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 
													 ['REJECTED', 'DISABLED', 'PAUSED'].includes(template.status) ? 'bg-red-500/10 text-red-400 border-red-500/25' : 
													 'bg-slate-800 text-slate-400 border-slate-700/50'}"
												>
													{template.status}
												</span>
											</td>
											<td class="px-4 py-3">
												<div class="flex items-center gap-1.5">
													<span class="h-1.5 w-1.5 rounded-full 
														{template.quality_rating === 'GREEN' ? 'bg-emerald-500' : 
														 template.quality_rating === 'YELLOW' ? 'bg-amber-500' : 
														 template.quality_rating === 'RED' ? 'bg-red-500' : 
														 'bg-slate-600'}"
													></span>
													<span class="text-[10px] text-slate-400">{template.quality_rating || 'UNKNOWN'}</span>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

			</div>

			<!-- Right Column: API Playground Widget (Sticky) -->
			<div class="lg:sticky lg:top-24 lg:col-span-4">
				<div class="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6">
					<div>
						<h3 class="text-sm font-semibold text-slate-100 font-sans">API Playground</h3>
						<p class="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
							Send manual test messages to verify network streams. Requests route via your configured credential keys.
						</p>
					</div>

					<form onsubmit={(e) => e.preventDefault()} class="space-y-4">
						<div class="space-y-1.5">
							<label for="recipient_target" class="block text-xs font-medium tracking-wider text-slate-400 uppercase">Recipient Target</label>
							<input
								type="text"
								id="recipient_target"
								bind:value={recipientTarget}
								placeholder="Phone or BSUID (e.g., 15551234567)"
								class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
							/>
						</div>

						<div class="space-y-3">
							<div class="flex p-1 rounded-xl bg-slate-950 border border-slate-800 relative select-none">
								<!-- Sliding Background Pill -->
								<div 
									class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-slate-900 border border-slate-800 transition-all duration-200 ease-out"
									class:translate-x-full={playgroundType === 'template'}
								></div>
								
								<button
									type="button"
									onclick={() => (playgroundType = 'text')}
									class="relative z-10 flex-1 py-1.5 text-xs font-medium transition-colors duration-200 text-center {playgroundType === 'text' ? 'text-slate-200' : 'text-slate-500 hover:text-slate-400'}"
								>
									Text Message
								</button>
								<button
									type="button"
									onclick={() => (playgroundType = 'template')}
									class="relative z-10 flex-1 py-1.5 text-xs font-medium transition-colors duration-200 text-center {playgroundType === 'template' ? 'text-slate-200' : 'text-slate-500 hover:text-slate-400'}"
								>
									Template
								</button>
							</div>

							{#if playgroundType === 'text'}
								<div class="space-y-1.5">
									<div class="flex justify-between items-center text-xs text-slate-400">
										<label for="message_body" class="font-medium tracking-wider uppercase text-[10px]">Message Body</label>
										<span class="font-mono text-[10px] {testMessageBody.length > 1000 ? 'text-red-400' : 'text-slate-500'}">
											{testMessageBody.length}/1000
										</span>
									</div>
									<textarea
										id="message_body"
										bind:value={testMessageBody}
										maxlength="1000"
										placeholder="Type a test message..."
										rows="4"
										class="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-sans text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
									></textarea>
								</div>
							{:else}
								<div class="space-y-3">
									<div class="space-y-1.5">
										<label for="template_select" class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Select Template</label>
										<select
											id="template_select"
											bind:value={selectedTemplateName}
											disabled={templates.filter(t => t.status === 'APPROVED').length === 0}
											class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-sans text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
										>
											{#if templates.filter(t => t.status === 'APPROVED').length === 0}
												<option value="" disabled selected>No approved templates — create one in WhatsApp Manager</option>
											{:else}
												<option value="" disabled selected>Select an approved template...</option>
												{#each templates.filter(t => t.status === 'APPROVED') as t}
													<option value={t.name}>{t.name} ({t.language})</option>
												{/each}
											{/if}
										</select>
									</div>

									{#if selectedTemplateName && hasNamedParameters}
										<div class="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-2">
											<span class="block text-xs font-semibold text-amber-400 tracking-wide uppercase">Unsupported Template Format</span>
											<p class="text-xs text-amber-300/80 leading-relaxed font-sans">
												Templates with named parameters (e.g. <code>{parsedBodySlots.join(', ')}</code>) are not supported in the Playground yet. Please select an ordinal template (e.g. <code>&#123;&#123;1&#125;&#125;</code>).
											</p>
										</div>
									{/if}

									{#if selectedTemplateName && !hasNamedParameters && parsedBodySlots.length > 0}
										<div class="space-y-3 pt-2 border-t border-slate-800/60">
											<span class="block text-[10px] font-medium tracking-wider text-slate-400 uppercase">Body Parameters</span>
											<div class="grid grid-cols-1 gap-3">
												{#each parsedBodySlots as slot, i}
													<div class="space-y-1">
														<label for="param_{i}" class="block text-[10px] font-mono text-slate-500">{slot}</label>
														<input
															type="text"
															id="param_{i}"
															bind:value={bodyParams[i]}
															placeholder="Value for {slot}"
															class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
														/>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<button
								type="button"
								onclick={handleTestMessage}
								disabled={testingPlayground || !recipientTarget || (playgroundType === 'text' && !testMessageBody.trim()) || (playgroundType === 'template' && (!selectedTemplateName || hasNamedParameters))}
								class="w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] py-2.5 text-sm font-semibold text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{#if testingPlayground}
									<Loader2 size={16} class="animate-spin" />
									Dispatching...
								{:else}
									Send Test Message
								{/if}
							</button>
						</div>
					</form>

					<!-- First-Class Response Panel -->
					{#if playgroundResponse}
						<div aria-live="polite" class="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
							{#if playgroundResponse.success}
								<div class="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-3">
									<div class="flex items-center gap-2 text-emerald-400">
										<CheckCircle2 size={16} />
										<span class="text-xs font-semibold tracking-wide uppercase">Message Queued</span>
										<span class="ml-auto font-mono text-[10px] text-slate-500">{playgroundResponse.roundTripMs}ms</span>
									</div>
									
									<div class="space-y-1">
										<span class="block text-[9px] font-black tracking-widest text-slate-500 uppercase">Job ID</span>
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs text-slate-300 break-all bg-slate-950/50 px-2 py-1.5 rounded-lg border border-slate-800 flex-1">{playgroundResponse.jobId}</span>
											<button
												type="button"
												onclick={() => {
													if (playgroundResponse?.jobId) {
														navigator.clipboard.writeText(playgroundResponse.jobId);
														showToast('Job ID copied to clipboard', 'success');
													}
												}}
												class="rounded-lg bg-slate-950/60 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-950 transition-all border border-slate-800"
												title="Copy Job ID"
											>
												<Copy size={12} />
											</button>
										</div>
									</div>
								</div>
							{:else}
								<div class="rounded-xl border border-red-500/20 bg-red-950/10 p-4 space-y-2">
									<div class="flex items-center gap-2 text-red-400">
										<AlertCircle size={16} />
										<span class="text-xs font-semibold tracking-wide uppercase text-red-400">Delivery Failure</span>
										{#if playgroundResponse.code}
											<span class="ml-auto font-mono text-[10px] text-slate-500">Status: {playgroundResponse.code}</span>
										{/if}
									</div>
									<p class="text-xs text-red-200/90 leading-relaxed font-mono">
										{playgroundResponse.message}
									</p>
								</div>
							{/if}
						</div>
					{/if}

					<div class="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
						<h4 class="text-xs font-semibold text-slate-200">Production Mode</h4>
						<p class="text-[10px] leading-relaxed text-slate-500">
							Playground calls target standard billing rates for live outbound Meta Cloud messages. Use care when configuring test loops.
						</p>
					</div>
				</div>
			</div>

		</div>
	</main>
</div>

<!-- Dynamic Toasts Component -->
<div aria-live="assertive" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
	{#each toasts as toast (toast.id)}
		<div class="pointer-events-auto flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-xl animate-in slide-in-from-bottom-5 duration-200">
			<div class="flex items-center gap-2.5">
				{#if toast.type === 'success'}
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span class="text-xs font-medium text-slate-200">{toast.message}</span>
				{:else if toast.type === 'error'}
					<span class="h-2 w-2 rounded-full bg-red-500"></span>
					<span class="text-xs font-medium text-slate-200">{toast.message}</span>
				{:else}
					<span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
					<span class="text-xs font-medium text-slate-200">{toast.message}</span>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => (toasts = toasts.filter(t => t.id !== toast.id))}
				class="ml-4 text-slate-500 hover:text-slate-300 transition-colors text-lg"
			>
				&times;
			</button>
		</div>
	{/each}
</div>

<style>
	:global(body) {
		background-color: #020617;
	}

	input:user-invalid, textarea:user-invalid {
		border-color: rgba(239, 68, 68, 0.4);
		background-color: rgba(239, 68, 68, 0.02);
	}
</style>
