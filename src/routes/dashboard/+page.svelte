<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance, deserialize } from '$app/forms';

	import { env } from '$env/dynamic/public';

	let { data, form } = $props();

	let loading = $state(false);
	let provisioning = $state(false);
	let metaOnboardUrl = $derived(
		`https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${env.PUBLIC_META_APP_ID || '1594349876023947'}&config_id=${env.PUBLIC_META_CONFIG_ID || '1298428131650108'}`
	);
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
	let copiedConfig = $state(false);

	async function copySecretToClipboard(secret: string | undefined) {
		if (secret) {
			await navigator.clipboard.writeText(secret);
			copiedSecret = true;
			setTimeout(() => {
				copiedSecret = false;
			}, 2000);
		}
	}

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
		copiedConfig = true;
		setTimeout(() => {
			copiedConfig = false;
		}, 2000);
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
				reqBody.text_body =
					testMessageBody || 'This is a live test from the Bhejna uniform gateway!';
			} else if (msgType === 'template') {
				reqBody.template_code = 'hello_world';
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

	async function handleOnboardingClick(e: MouseEvent) {
		e.preventDefault();
		loading = true;
		try {
			const response = await fetch('?/initializeOnboarding', {
				method: 'POST',
				body: new FormData()
			});

			const result = deserialize(await response.text());

			if (result.type === 'success' && result.data && (result.data as any).onboardingUrl) {
				window.location.href = (result.data as any).onboardingUrl;
			} else {
				console.error('Onboarding init action failed:', result);
				error = 'Onboarding initialization failed. Please try again.';
			}
		} catch (err: any) {
			console.error('Failed to initialize onboarding:', err);
			error = err.message || 'Failed to initialize onboarding';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-slate-900 font-sans text-white">
	<nav class="sticky top-0 z-50 border-b border-white/[0.05] bg-[#111827]/80 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
			<div class="flex items-center space-x-2">
				<img src="/favicon.svg" alt="Bhejna Logo" class="h-8 w-8" />
				<span class="text-xl font-bold tracking-tight">Bhejna</span>
			</div>
			<div class="flex items-center space-x-6">
				<a
					href="/docs"
					class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
					>Documentation</a
				>
				<span class="hidden text-sm text-slate-400 sm:inline">{userEmail}</span>
				<form method="POST" action="/dashboard?/signout" use:enhance>
					<button
						type="submit"
						class="rounded-lg px-4 py-2 text-sm text-slate-400 transition-all hover:bg-white/[0.05] hover:text-white"
					>
						Sign Out
					</button>
				</form>
			</div>
		</div>
	</nav>

	<main class="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
		{#if loading}
			<div class="flex justify-center py-12">
				<div
					class="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"
				></div>
			</div>
		{:else}
			<div class="mb-8 border-b border-white/[0.05] pb-5">
				<h1 class="text-2xl font-semibold tracking-tight text-white">API & Integration Settings</h1>
				<p class="mt-1 text-sm text-slate-400">
					Manage your WhatsApp Business connection, API keys, and webhook routing.
				</p>
			</div>

			<div class="grid grid-cols-1 items-start gap-8 xl:grid-cols-12">
				<!-- Left Column: Settings -->
				<div class="flex flex-col gap-6 xl:col-span-8">
					<!-- WhatsApp Connection Card -->
					<div
						class="overflow-hidden rounded-xl border border-white/[0.05] bg-[#111827]/80 shadow-sm backdrop-blur-xl"
					>
						<div class="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
							<h2 class="text-sm font-semibold text-slate-200">WhatsApp Connection</h2>
						</div>
						<div class="p-6">
							{#if whatsappStatus === 'ACTIVE'}
								<div
									class="flex items-start gap-4 rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-4 text-emerald-400"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="mt-0.5 h-6 w-6 shrink-0 fill-none stroke-current stroke-2"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
									<div>
										<p class="text-sm font-semibold text-emerald-200">
											Gateway Active & Operational
										</p>
										<p class="mt-1 text-xs leading-relaxed text-emerald-500/90">
											Your WABA ID (<span class="font-mono text-emerald-400"
												>{data.tenant?.waba_id}</span
											>){#if data.tenant?.phone_number}, WhatsApp Number (<span
													class="font-mono text-emerald-400">{data.tenant?.phone_number}</span
												>){/if} and Phone Number ID are hot-hydrated for zero-latency webhook multiplexing.
										</p>
									</div>
								</div>
							{:else if whatsappStatus === 'PENDING_ONBOARDING'}
								<div
									class="mb-5 rounded-lg border border-amber-800/60 bg-amber-950/30 p-4 text-amber-400"
								>
									<div class="flex items-start gap-4">
										<div
											class="mt-2 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500"
										></div>
										<div>
											<p class="text-sm font-semibold text-amber-200">Awaiting Meta Verification</p>
											<p class="mt-1 text-xs leading-relaxed text-amber-500/90">
												Your setup is pending confirmation from Meta's asynchronous systems. Click
												track below to monitor activation.
											</p>
										</div>
									</div>
								</div>

								<div class="space-y-3">
									<a
										href="/onboarding-success"
										class="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-amber-950/40 transition hover:bg-amber-500"
									>
										Track Real-time Sync Progress
									</a>

									<form method="POST" action="?/cancelOnboarding" use:enhance class="w-full">
										<button
											type="submit"
											class="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:border-red-500/40 hover:bg-red-950/20"
										>
											Reset & Start Over
										</button>
									</form>
								</div>
							{:else}
								<div class="space-y-6">
									<div class="rounded-lg border border-white/[0.05] bg-blue-500/5 p-4">
										<h3 class="mb-1 text-sm font-medium text-blue-400">
											Embedded Signup (Recommended)
										</h3>
										<p class="mb-4 text-xs text-slate-400">
											The fastest way to connect your WhatsApp Business Account via Meta's official
											onboarding.
										</p>
										<a
											href={metaOnboardUrl}
											target="_blank"
											rel="noopener noreferrer"
											onclick={handleOnboardingClick}
											class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-950/30 transition hover:bg-blue-500"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 fill-none stroke-current stroke-2"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
												/>
											</svg>
											Connect WhatsApp Workspace
										</a>
									</div>

									<div class="relative py-2">
										<div class="absolute inset-0 flex items-center">
											<span class="w-full border-t border-white/[0.05]"></span>
										</div>
										<div class="relative flex justify-center text-xs uppercase">
											<span class="bg-slate-900 px-2 text-slate-500">Or Manual Provisioning</span>
										</div>
									</div>

									<form onsubmit={handleProvision} class="space-y-4">
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<div>
												<label
													for="waba_id"
													class="mb-2 block text-xs font-medium tracking-wider text-slate-400 uppercase"
													>WABA ID</label
												>
												<input
													type="text"
													id="waba_id"
													bind:value={waba_id}
													required
													placeholder="e.g. 1029384756..."
													class="w-full rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-2.5 font-mono text-sm text-slate-200 shadow-inner transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
												/>
											</div>
											<div>
												<label
													for="phone_number_id"
													class="mb-2 block text-xs font-medium tracking-wider text-slate-400 uppercase"
													>Phone Number ID</label
												>
												<input
													type="text"
													id="phone_number_id"
													bind:value={phone_number_id}
													required
													placeholder="e.g. 987654321..."
													class="w-full rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-2.5 font-mono text-sm text-slate-200 shadow-inner transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
												/>
											</div>
										</div>

										<button
											type="submit"
											disabled={provisioning}
											class="w-full rounded-lg bg-[#2563EB] py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
										>
											{provisioning ? 'Provisioning...' : 'Provision Bhejna API Key'}
										</button>
									</form>
								</div>
							{/if}

							{#if error}
								<div
									class="mt-4 rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-xs text-red-400"
								>
									{error}
								</div>
							{/if}

							{#if apiKey}
								<div
									class="animate-in fade-in slide-in-from-bottom-4 mt-6 rounded-xl border border-white/[0.05] bg-blue-500/5 p-4 duration-500"
								>
									<h3
										class="mb-3 flex items-center text-xs font-semibold tracking-wider text-blue-400 uppercase"
									>
										<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
											></path>
										</svg>
										API Key Generated
									</h3>
									<div class="flex items-center gap-2">
										<div
											class="flex-1 overflow-x-auto rounded-lg border border-white/[0.05] bg-black/50 p-3 font-mono text-xs break-all text-blue-300 shadow-inner"
										>
											{apiKey}
										</div>
										<button
											onclick={copyToClipboard}
											class="rounded-lg bg-white/[0.05] p-2.5 text-slate-400 transition-colors hover:bg-white/[0.1] hover:text-white"
											title="Copy to clipboard"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
												></path>
											</svg>
										</button>
									</div>
									<p class="mt-3 text-[10px] text-slate-500 italic">
										Save this key securely. It will not be shown again.
									</p>
								</div>
							{/if}

							<details class="group mt-8 border-t border-slate-900 pt-6">
								<summary
									class="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-500 select-none hover:text-slate-400"
								>
									<span>Advanced Diagnostics & Recovery</span>
									<span class="text-[10px] transition-transform group-open:rotate-180">▼</span>
								</summary>

								<div
									class="mt-4 rounded-xl border border-dashed border-amber-950/40 bg-amber-950/5 p-4"
								>
									<p class="mb-3 text-[11px] leading-relaxed font-medium text-amber-500/90">
										<strong>Integration Rescue Hatch:</strong> If your incoming messages or status checkmarks
										are not delivering after setting up your custom production IDs, your Meta App stream
										registration may have encountered a network timeout. Triggering a sync force-updates
										your credentials cache across data planes.
									</p>

									<form method="POST" action="?/retryWabaSubscription" use:enhance>
										<button
											type="submit"
											class="inline-flex cursor-pointer rounded-md border border-amber-500/20 bg-amber-600/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-600/20 active:scale-[0.98]"
										>
											Sync Event Stream Allocation
										</button>
									</form>
								</div>
							</details>
						</div>
					</div>

					<!-- Developer Settings Card -->
					<div
						class="overflow-hidden rounded-xl border border-white/[0.05] bg-[#111827]/80 shadow-sm backdrop-blur-xl"
					>
						<div class="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
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
									<label
										for="webhook_url"
										class="mb-2 block text-xs font-medium tracking-wider text-slate-400 uppercase"
										>Webhook URL</label
									>
									<input
										type="url"
										name="webhook_url"
										id="webhook_url"
										value={form?.webhook_url ?? data.tenant?.webhook_url ?? ''}
										required
										placeholder="https://your-app.com/api/webhooks/bhejna"
										class="w-full rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-2.5 font-mono text-sm text-slate-200 shadow-inner transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									/>
									<p class="mt-2 text-[10px] text-slate-500">
										Bhejna will POST status updates and inbound messages to this URL.
									</p>
								</div>

								<button
									type="submit"
									disabled={updatingWebhook}
									class="w-full rounded-lg bg-[#2563EB] py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
								>
									{updatingWebhook ? 'Saving Settings...' : 'Save Webhook Settings'}
								</button>
							</form>

							{#if form?.success && form?.message?.includes('Webhook saved')}
								<div
									class="mt-4 flex items-center rounded-lg border border-emerald-900/50 bg-emerald-900/20 p-3 text-xs text-emerald-400"
								>
									<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										></path></svg
									>
									{form?.message}
								</div>
							{/if}

							{#if data.tenant?.webhook_secret}
								<div class="mt-6 border-t border-white/[0.05] pt-6">
									<span
										class="mb-2 block text-xs font-medium tracking-wider text-slate-400 uppercase"
										>Webhook Secret</span
									>
									<div class="flex items-center gap-3">
										<div
											class="flex-1 overflow-hidden rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-2.5 font-mono text-sm text-ellipsis text-slate-300"
										>
											{showSecret ? data.tenant.webhook_secret : '••••••••••••••••••••••••••••••••'}
										</div>
										<button
											type="button"
											onclick={() => (showSecret = !showSecret)}
											class="rounded-lg border border-white/[0.05] p-2.5 text-slate-400 transition-colors hover:bg-white/[0.05]"
											title={showSecret ? 'Hide Secret' : 'Show Secret'}
										>
											{showSecret ? 'Hide' : 'Show'}
										</button>
										<button
											type="button"
											onclick={() => {
												navigator.clipboard.writeText(data.tenant?.webhook_secret || '');
											}}
											class="rounded-lg border border-white/[0.05] p-2.5 text-slate-400 transition-colors hover:bg-white/[0.05]"
											title="Copy Secret"
										>
											Copy
										</button>
									</div>
									<div class="mt-3 flex items-center justify-between">
										<p class="text-[9px] font-bold tracking-widest text-slate-500 uppercase">
											HMAC-SHA256 Payload Verification
										</p>
										<form method="POST" action="?/rotateSecret" use:enhance>
											<button
												type="submit"
												class="text-xs text-red-400 underline underline-offset-2 transition-colors hover:text-red-300"
												>Rotate Secret Key</button
											>
										</form>
									</div>
								</div>
							{/if}

							<div class="mt-6 border-t border-white/[0.05] pt-6">
								<button
									type="button"
									onclick={handleCopyIntegrationConfig}
									disabled={whatsappStatus !== 'ACTIVE'}
									title={whatsappStatus === 'ACTIVE' ? '' : 'Connect your WhatsApp number first'}
									class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.05] px-4 py-2.5 text-xs font-semibold tracking-wider text-slate-400 uppercase transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
								>
									{#if copiedConfig}
										Copied! ✓
									{:else}
										Copy Integration Config
									{/if}
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Right Column: API Playground (Sticky) -->
				<div class="sticky top-24 xl:col-span-4">
					<div
						class="overflow-hidden rounded-xl border border-t-2 border-white/[0.05] border-t-[#2563EB] bg-[#111827]/80 shadow-sm backdrop-blur-xl"
					>
						<div class="flex items-center justify-between border-b border-white/[0.05] px-6 py-4">
							<h2 class="text-sm font-semibold text-slate-200">API Playground</h2>
						</div>
						<div class="p-6">
							<p class="mb-6 text-xs leading-relaxed text-slate-400">
								Send a test message to ensure your integration is active. Requests are proxied via
								Bhejna infrastructure.
							</p>

							<form onsubmit={(e) => e.preventDefault()} class="space-y-5">
								<div>
									<label
										for="recipient_target"
										class="mb-2 block text-xs font-medium tracking-wider text-slate-400 uppercase"
										>Recipient Target</label
									>
									<input
										type="text"
										id="recipient_target"
										bind:value={recipientTarget}
										placeholder="Phone or BSUID (e.g. 15551234567)"
										class="w-full rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-2.5 font-mono text-sm text-slate-200 shadow-inner transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
									/>
								</div>

								<div class="space-y-3">
									<div class="mb-5 flex rounded-lg border border-white/[0.05] bg-[#0B1120] p-1">
										<button
											type="button"
											onclick={() => (playgroundMode = 'template')}
											class="flex-1 cursor-pointer rounded-md py-1.5 text-center text-xs font-semibold tracking-wider uppercase transition-all {playgroundMode ===
											'template'
												? 'bg-[#2563EB] text-white shadow'
												: 'text-slate-400 hover:text-slate-200'}"
										>
											Template
										</button>
										<button
											type="button"
											onclick={() => (playgroundMode = 'text')}
											class="flex-1 cursor-pointer rounded-md py-1.5 text-center text-xs font-semibold tracking-wider uppercase transition-all {playgroundMode ===
											'text'
												? 'bg-[#2563EB] text-white shadow'
												: 'text-slate-400 hover:text-slate-200'}"
										>
											Free-Form Text
										</button>
									</div>

									{#if playgroundMode === 'template'}
										<div class="mb-5 rounded-lg border border-blue-500/10 bg-blue-500/5 p-3.5">
											<div class="mb-1.5 flex items-center justify-between text-xs">
												<span class="font-medium text-blue-400">Selected Template</span>
												<span
													class="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-300"
													>hello_world</span
												>
											</div>
											<p class="text-[11px] leading-relaxed text-slate-400">
												Meta's pre-approved standard onboarding greeting template in US English. No
												custom parameters required.
											</p>
										</div>

										<button
											type="button"
											onclick={() => handleTestMessage('template')}
											disabled={testing}
											class="flex w-full cursor-pointer items-center justify-center rounded-lg bg-[#2563EB] py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
										>
											{#if testing}
												<svg
													class="mr-3 -ml-1 h-4 w-4 animate-spin text-white"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													><circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle><path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path></svg
												>
												Sending Template...
											{:else}
												Send 'hello_world' Template
											{/if}
										</button>
									{:else}
										<div class="mb-5 space-y-4">
											<div>
												<div class="mb-2 flex items-center justify-between">
													<label
														for="message_body"
														class="text-[11px] font-medium tracking-wider text-slate-400 uppercase"
														>Message Body</label
													>
													<span
														class="font-mono text-[10px] {testMessageBody.length > 1000
															? 'text-red-400'
															: 'text-slate-500'}"
													>
														{testMessageBody.length} / 1000 chars
													</span>
												</div>
												<textarea
													id="message_body"
													bind:value={testMessageBody}
													placeholder="Write your custom test message here..."
													rows="4"
													class="w-full resize-none rounded-lg border border-white/[0.05] bg-[#0B1120] px-4 py-3 text-sm leading-relaxed text-slate-200 shadow-inner transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
												></textarea>
											</div>
										</div>

										<button
											type="button"
											onclick={() => handleTestMessage('text')}
											disabled={testing || !testMessageBody.trim()}
											class="flex w-full cursor-pointer items-center justify-center rounded-lg bg-[#2563EB] py-2.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
										>
											{#if testing}
												<svg
													class="mr-3 -ml-1 h-4 w-4 animate-spin text-white"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
													><circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle><path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path></svg
												>
												Sending Custom Text...
											{:else}
												Send Custom Text Message
											{/if}
										</button>
									{/if}
								</div>
							</form>

							{#if testError}
								<div
									class="mt-4 rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-xs text-red-400"
								>
									{testError}
								</div>
							{/if}

							{#if testResult}
								<div
									class="mt-4 flex items-center rounded-lg border border-emerald-900/50 bg-emerald-900/20 p-3 font-mono text-xs text-emerald-400"
								>
									<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										></path></svg
									>
									{testResult}
								</div>
							{/if}
						</div>
					</div>

					<div class="mt-6 rounded-xl border border-white/[0.05] bg-blue-500/5 p-4">
						<div class="flex items-start gap-3">
							<svg
								class="mt-0.5 h-5 w-5 text-blue-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								></path></svg
							>
							<div>
								<h4 class="text-xs font-semibold text-slate-200">Production Ready</h4>
								<p class="mt-1 text-[10px] leading-relaxed text-slate-500">
									This playground uses your production API configuration. Standard messaging rates
									apply.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
