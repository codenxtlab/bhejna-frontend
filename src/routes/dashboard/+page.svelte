<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let loading = $state(false);
	let provisioning = $state(false);
	let userEmail = $derived(data.user?.email || '');
	let whatsappStatus = $derived(data.tenant?.whatsapp_status || 'UNCONNECTED');
	let waba_id = $state('');
	let phone_number_id = $state('');
	let apiKey = $state('');
	let error = $state('');

	// API Playground state
	let recipientTarget = $state('');
	let testMessageBody = $state('');
	let playgroundMode = $state<'template' | 'text'>('template');
	let testing = $state(false);
	let updatingWebhook = $state(false);
	let testResult = $state('');
	let testError = $state('');
	let copiedSecret = $state(false);
	let showSecret = $state(false);



	async function copySecretToClipboard(secret: string | undefined) {
		if (secret) {
			await navigator.clipboard.writeText(secret);
			copiedSecret = true;
			setTimeout(() => { copiedSecret = false; }, 2000);
		}
	}

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

			const data = await response.json();

			if (!response.ok) throw new Error(data.message || 'Provisioning failed');
			
			apiKey = data.api_key;
			// Clear fields on success
			waba_id = '';
			phone_number_id = '';
		} catch (err: any) {
			error = err.message;
		} finally {
			provisioning = false;
		}
	}



	function copyToClipboard() {
		navigator.clipboard.writeText(apiKey);
	}

	async function handleTestMessage(msgType: 'text' | 'template') {
		testing = true;
		testResult = '';
		testError = '';
		if (!recipientTarget) {
			testError = 'Recipient target is required for sending messages.';
			testing = false;
			return;
		}

		try {
			const reqBody: any = {
				recipient_target: recipientTarget,
				type: msgType
			};
			if (msgType === 'text') {
				reqBody.text_body = testMessageBody || "This is a live test from the Bhejna uniform gateway!";
			} else if (msgType === 'template') {
				reqBody.template_code = "hello_world";
			}

			const res = await fetch('/api/test-message', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(reqBody)
			});

			const resData = await res.json();
			if (!res.ok) throw new Error(resData.message || 'Failed to send test message');

			// Extract from enqueued response envelope
			const jobId = resData.data?.job_id || resData.job_id || resData.id || 'Success';
			const status = resData.data?.status || resData.status || 'queued';
			testResult = `Message Enqueued! Job ID: ${jobId} (Status: ${status})`;
		} catch (err: any) {
			testError = err.message;
		} finally {
			testing = false;
		}
	}


</script>

<div class="min-h-screen bg-slate-900 text-white font-sans">
	<nav class="border-b border-white/[0.05] bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
			<div class="flex items-center space-x-2">
				<img src="/favicon.svg" alt="Bhejna Logo" class="w-8 h-8" />
				<span class="text-xl font-bold tracking-tight">Bhejna</span>
			</div>
			<div class="flex items-center space-x-6">
				<a href="/docs" class="text-sm font-medium text-slate-400 hover:text-white transition-colors">Documentation</a>
				<span class="text-sm text-slate-400 hidden sm:inline">{userEmail}</span>
				<form method="POST" action="/dashboard?/signout" use:enhance>
					<button
						type="submit"
						class="text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] px-4 py-2 rounded-lg transition-all"
					>
						Sign Out
					</button>
				</form>
			</div>
		</div>
	</nav>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
		{#if loading}
			<div class="flex justify-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		{:else}
			<div class="mb-8 border-b border-white/[0.05] pb-5">
				<h1 class="text-2xl font-semibold text-white tracking-tight">API & Integration Settings</h1>
				<p class="text-sm text-slate-400 mt-1">Manage your WhatsApp Business connection, API keys, and webhook routing.</p>
			</div>

			<div class="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
				<!-- Left Column: Settings -->
				<div class="xl:col-span-8 flex flex-col gap-6">
					
					<!-- WhatsApp Connection Card -->
					<div class="bg-[#111827]/80 backdrop-blur-xl rounded-xl border border-white/[0.05] shadow-sm overflow-hidden">
						<div class="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
							<h2 class="text-sm font-semibold text-slate-200">WhatsApp Connection</h2>
						</div>
						<div class="p-6">
							{#if whatsappStatus === 'ACTIVE'}
								<div class="flex items-start gap-4 rounded-lg bg-emerald-950/30 border border-emerald-800/60 p-4 text-emerald-400">
									<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 fill-none stroke-current stroke-2 shrink-0 mt-0.5" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<div>
										<p class="font-semibold text-sm text-emerald-200">Gateway Active & Operational</p>
										<p class="text-xs text-emerald-500/90 mt-1 leading-relaxed">
											Your WABA ID (<span class="font-mono text-emerald-400">{data.tenant?.waba_id}</span>) and Phone Number ID are hot-hydrated for zero-latency webhook multiplexing.
										</p>
									</div>
								</div>
							{:else if whatsappStatus === 'PENDING_ONBOARDING'}
								<div class="rounded-lg bg-amber-950/30 border border-amber-800/60 p-4 text-amber-400 mb-5">
									<div class="flex items-start gap-4">
										<div class="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0 mt-2"></div>
										<div>
											<p class="font-semibold text-sm text-amber-200">Awaiting Meta Verification</p>
											<p class="text-xs text-amber-500/90 mt-1 leading-relaxed">
												Your setup is pending confirmation from Meta's asynchronous systems. Click track below to monitor activation.
											</p>
										</div>
									</div>
								</div>
								
								<div class="space-y-3">
									<a 
										href="/onboarding-success" 
										class="inline-flex w-full justify-center items-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-500 shadow-md shadow-amber-950/40"
									>
										Track Real-time Sync Progress
									</a>
									
									<form method="POST" action="?/cancelOnboarding" use:enhance class="w-full">
										<button 
											type="submit"
											class="inline-flex w-full justify-center items-center rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-950/10 hover:bg-red-950/20 px-4 py-2.5 text-sm font-medium text-red-400 transition cursor-pointer"
										>
											Reset & Start Over
										</button>
									</form>
								</div>
							{:else}
								<div class="space-y-6">
									<div class="bg-blue-500/5 border border-white/[0.05] p-4 rounded-lg">
										<h3 class="text-sm font-medium text-blue-400 mb-1">Embedded Signup (Recommended)</h3>
										<p class="text-xs text-slate-400 mb-4">The fastest way to connect your WhatsApp Business Account via Meta's official onboarding.</p>
										<form 
											method="POST" 
											action="?/initializeOnboarding" 
											use:enhance={() => {
												loading = true;
												return async ({ result }) => {
													loading = false;
													const res = result as any;
													const onboardingUrl = res.data?.onboardingUrl;
													if (res.type === 'success' && onboardingUrl) {
														// Open Meta onboarding portal in a new tab securely
														window.open(onboardingUrl, '_blank');
														// Navigate current workspace view to success tracker
														goto('/onboarding-success');
													}
												};
											}}
										>
											<button 
												type="submit"
												class="inline-flex w-full justify-center items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 shadow-md shadow-blue-950/30 cursor-pointer"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
												</svg>
												Connect WhatsApp Workspace
											</button>
										</form>
									</div>

									<div class="relative py-2">
										<div class="absolute inset-0 flex items-center"><span class="w-full border-t border-white/[0.05]"></span></div>
										<div class="relative flex justify-center text-xs uppercase"><span class="bg-slate-900 px-2 text-slate-500">Or Manual Provisioning</span></div>
									</div>

									<form onsubmit={handleProvision} class="space-y-4">
										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<label for="waba_id" class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">WABA ID</label>
												<input
													type="text"
													id="waba_id"
													bind:value={waba_id}
													required
													placeholder="e.g. 1029384756..."
													class="w-full bg-[#0B1120] border border-white/[0.05] text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner font-mono"
												/>
											</div>
											<div>
												<label for="phone_number_id" class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Phone Number ID</label>
												<input
													type="text"
													id="phone_number_id"
													bind:value={phone_number_id}
													required
													placeholder="e.g. 987654321..."
													class="w-full bg-[#0B1120] border border-white/[0.05] text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner font-mono"
												/>
											</div>
										</div>

										<button
											type="submit"
											disabled={provisioning}
											class="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold py-2.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all active:scale-[0.98] disabled:opacity-50"
										>
											{provisioning ? 'Provisioning...' : 'Provision Bhejna API Key'}
										</button>
									</form>
								</div>
							{/if}

							{#if error}
								<div class="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs">
									{error}
								</div>
							{/if}

							{#if apiKey}
								<div class="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-blue-500/5 p-4 rounded-xl border border-white/[0.05]">
									<h3 class="text-xs font-semibold mb-3 text-blue-400 flex items-center uppercase tracking-wider">
										<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
										API Key Generated
									</h3>
									<div class="flex items-center gap-2">
										<div class="flex-1 bg-black/50 border border-white/[0.05] rounded-lg p-3 font-mono text-blue-300 text-xs overflow-x-auto break-all shadow-inner">
											{apiKey}
										</div>
										<button
											onclick={copyToClipboard}
											class="p-2.5 bg-white/[0.05] hover:bg-white/[0.1] rounded-lg text-slate-400 hover:text-white transition-colors"
											title="Copy to clipboard"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
											</svg>
										</button>
									</div>
									<p class="mt-3 text-[10px] text-slate-500 italic">
										Save this key securely. It will not be shown again.
									</p>
								</div>
							{/if}

							<details class="group mt-8 border-t border-slate-900 pt-6">
								<summary class="flex items-center justify-between cursor-pointer list-none text-xs font-semibold text-slate-500 hover:text-slate-400 select-none">
									<span>Advanced Diagnostics & Recovery</span>
									<span class="transition-transform group-open:rotate-180 text-[10px]">▼</span>
								</summary>
								
								<div class="mt-4 rounded-xl border border-dashed border-amber-950/40 bg-amber-950/5 p-4">
									<p class="text-[11px] leading-relaxed text-amber-500/90 font-medium mb-3">
										<strong>Integration Rescue Hatch:</strong> If your incoming messages or status checkmarks are not delivering after setting up your custom production IDs, your Meta App stream registration may have encountered a network timeout. Triggering a sync force-updates your credentials cache across data planes.
									</p>
									
									<form method="POST" action="?/retryWabaSubscription" use:enhance>
										<button 
											type="submit"
											class="inline-flex rounded-md bg-amber-600/10 border border-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-600/20 active:scale-[0.98] cursor-pointer"
										>
											Sync Event Stream Allocation
										</button>
									</form>
								</div>
							</details>
						</div>
					</div>

					<!-- Developer Settings Card -->
					<div class="bg-[#111827]/80 backdrop-blur-xl rounded-xl border border-white/[0.05] shadow-sm overflow-hidden">
						<div class="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
							<h2 class="text-sm font-semibold text-slate-200">Developer Settings</h2>
						</div>
						<div class="p-6">
							<form 
								method="POST" 
								action="?/updateWebhook" 
								use:enhance={() => {
									updatingWebhook = true;
									return async ({ update, result }) => {
										updatingWebhook = false;
										await update();
									};
								}} 
								class="space-y-6"
							>
								<div>
									<label for="webhook_url" class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Webhook URL</label>
									<input
										type="url"
										name="webhook_url"
										id="webhook_url"
										value={form?.webhook_url ?? data.tenant?.webhook_url ?? ''}
										required
										placeholder="https://your-app.com/api/webhooks/bhejna"
										class="w-full bg-[#0B1120] border border-white/[0.05] text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner font-mono"
									/>
									<p class="text-[10px] text-slate-500 mt-2">Bhejna will POST status updates and inbound messages to this URL.</p>
								</div>

								<button
									type="submit"
									disabled={updatingWebhook}
									class="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-bold py-2.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all active:scale-[0.98] disabled:opacity-50"
								>
									{updatingWebhook ? 'Saving Settings...' : 'Save Webhook Settings'}
								</button>
							</form>

							{#if form?.success && form?.message?.includes('Webhook saved')}
								<div class="mt-4 p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-emerald-400 text-xs flex items-center">
									<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
									{form?.message}
								</div>
							{/if}

							{#if data.tenant?.webhook_secret}
								<div class="mt-6 pt-6 border-t border-white/[0.05]">
									<span class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Webhook Secret</span>
									<div class="flex items-center gap-3">
										<div class="flex-1 bg-[#0B1120] border border-white/[0.05] rounded-lg px-4 py-2.5 font-mono text-sm text-slate-300 overflow-hidden text-ellipsis">
											{showSecret ? data.tenant.webhook_secret : '••••••••••••••••••••••••••••••••'}
										</div>
										<button 
											type="button" 
											onclick={() => showSecret = !showSecret} 
											class="p-2.5 rounded-lg border border-white/[0.05] hover:bg-white/[0.05] text-slate-400 transition-colors"
											title={showSecret ? 'Hide Secret' : 'Show Secret'}
										>
											{showSecret ? 'Hide' : 'Show'}
										</button>
										<button 
											type="button" 
											onclick={() => {
												navigator.clipboard.writeText(data.tenant?.webhook_secret || '');
											}} 
											class="p-2.5 rounded-lg border border-white/[0.05] hover:bg-white/[0.05] text-slate-400 transition-colors"
											title="Copy Secret"
										>
											Copy
										</button>
									</div>
									<div class="mt-3 flex justify-between items-center">
										<p class="text-[9px] uppercase tracking-widest text-slate-500 font-bold">HMAC-SHA256 Payload Verification</p>
										<form method="POST" action="?/rotateSecret" use:enhance>
											<button type="submit" class="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors">Rotate Secret Key</button>
										</form>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Right Column: API Playground (Sticky) -->
				<div class="xl:col-span-4 sticky top-24">
					<div class="bg-[#111827]/80 backdrop-blur-xl rounded-xl border border-white/[0.05] shadow-sm overflow-hidden border-t-2 border-t-[#2563EB]">
						<div class="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
							<h2 class="text-sm font-semibold text-slate-200">API Playground</h2>
						</div>
						<div class="p-6">
							<p class="text-xs text-slate-400 mb-6 leading-relaxed">Send a test message to ensure your integration is active. Requests are proxied via Bhejna infrastructure.</p>

							<form onsubmit={(e) => e.preventDefault()} class="space-y-5">
								<div>
									<label for="recipient_target" class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Recipient Target</label>
									<input
										type="text"
										id="recipient_target"
										bind:value={recipientTarget}
										placeholder="Phone or BSUID (e.g. 15551234567)"
										class="w-full bg-[#0B1120] border border-white/[0.05] text-slate-200 text-sm rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner font-mono"
									/>
								</div>
								
								<div class="space-y-3">
									<div class="flex bg-[#0B1120] p-1 rounded-lg border border-white/[0.05] mb-5">
										<button 
											type="button"
											onclick={() => playgroundMode = 'template'}
											class="flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center rounded-md transition-all cursor-pointer {playgroundMode === 'template' ? 'bg-[#2563EB] text-white shadow' : 'text-slate-400 hover:text-slate-200'}"
										>
											Template
										</button>
										<button 
											type="button"
											onclick={() => playgroundMode = 'text'}
											class="flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center rounded-md transition-all cursor-pointer {playgroundMode === 'text' ? 'bg-[#2563EB] text-white shadow' : 'text-slate-400 hover:text-slate-200'}"
										>
											Free-Form Text
										</button>
									</div>

									{#if playgroundMode === 'template'}
										<div class="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3.5 mb-5">
											<div class="flex items-center justify-between text-xs mb-1.5">
												<span class="font-medium text-blue-400">Selected Template</span>
												<span class="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[10px]">hello_world</span>
											</div>
											<p class="text-[11px] text-slate-400 leading-relaxed">Meta's pre-approved standard onboarding greeting template in US English. No custom parameters required.</p>
										</div>

										<button
											type="button"
											onclick={() => handleTestMessage('template')}
											disabled={testing}
											class="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold py-2.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center cursor-pointer"
										>
											{#if testing}
												<svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
												Sending Template...
											{:else}
												Send 'hello_world' Template
											{/if}
										</button>
									{:else}
										<div class="space-y-4 mb-5">
											<div>
												<div class="flex justify-between items-center mb-2">
													<label for="message_body" class="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Message Body</label>
													<span class="text-[10px] font-mono {testMessageBody.length > 1000 ? 'text-red-400' : 'text-slate-500'}">
														{testMessageBody.length} / 1000 chars
													</span>
												</div>
												<textarea
													id="message_body"
													bind:value={testMessageBody}
													placeholder="Write your custom test message here..."
													rows="4"
													class="w-full bg-[#0B1120] border border-white/[0.05] text-slate-200 text-sm rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-inner resize-none leading-relaxed"
												></textarea>
											</div>
										</div>

										<button
											type="button"
											onclick={() => handleTestMessage('text')}
											disabled={testing || !testMessageBody.trim()}
											class="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold py-2.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center cursor-pointer"
										>
											{#if testing}
												<svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
												Sending Custom Text...
											{:else}
												Send Custom Text Message
											{/if}
										</button>
									{/if}
								</div>
							</form>

							{#if testError}
								<div class="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs">
									{testError}
								</div>
							{/if}

							{#if testResult}
								<div class="mt-4 p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-emerald-400 text-xs font-mono flex items-center">
									<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
									{testResult}
								</div>
							{/if}
						</div>
					</div>
					
					<div class="mt-6 p-4 bg-blue-500/5 border border-white/[0.05] rounded-xl">
						<div class="flex items-start gap-3">
							<svg class="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
							<div>
								<h4 class="text-xs font-semibold text-slate-200">Production Ready</h4>
								<p class="text-[10px] text-slate-500 mt-1 leading-relaxed">This playground uses your production API configuration. Standard messaging rates apply.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
