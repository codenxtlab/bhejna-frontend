<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { Send, Loader2, MessageSquare, Bell, BellOff, BellRing, Download } from 'lucide-svelte';
	import type { Message } from '$lib/api/generated/models';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import { initPush, enablePush, disablePush, type PushState } from '$lib/push';
	import { install, promptInstall } from '$lib/install.svelte';

	let { data, form } = $props();

	let conversations = $state<Message[]>((data.conversations as Message[]) ?? []);
	let selectedBsuid = $state<string | null>(null);
	let threadMessages = $state<Message[]>([]);
	let threadDisplayName = $state<string | null>(null);
	let threadPhoneNumber = $state<string | null>(null);
	let sessionActive = $state(false);
	let threadLoading = $state(false);
	let replyBody = $state('');
	let sending = $state(false);

	async function fetchConversations() {
		try {
			const res = await fetch('/api/conversations');
			if (!res.ok) return;
			conversations = (await res.json()) ?? [];
		} catch (err) {
			console.error('Failed to poll conversations:', err);
		}
	}

	async function fetchThread(bsuid: string) {
		threadLoading = true;
		try {
			const res = await fetch(`/api/conversations/${encodeURIComponent(bsuid)}`);
			if (!res.ok) return;
			const data = await res.json();
			threadMessages = data.messages || [];
			sessionActive = !!data.session_active;
			threadDisplayName = data.display_name ?? null;
			threadPhoneNumber = data.phone_number ?? null;
		} catch (err) {
			console.error('Failed to fetch thread:', err);
		} finally {
			threadLoading = false;
		}
	}

	// Fingerprint of the selected conversation's latest message, as seen in the
	// last list poll. Lets the poll tick skip re-fetching the thread unless the
	// list actually shows new activity for it, instead of re-fetching on a
	// fixed schedule of its own.
	let lastSelectedFingerprint = $state<string | undefined>(undefined);

	function fingerprintFor(bsuid: string): string | undefined {
		return conversations.find((c) => c.recipient_bsuid === bsuid)?.id;
	}

	function selectConversation(bsuid: string) {
		selectedBsuid = bsuid;
		replyBody = '';
		threadDisplayName = null;
		threadPhoneNumber = null;
		lastSelectedFingerprint = fingerprintFor(bsuid);
		fetchThread(bsuid);
	}

	async function pollTick() {
		await fetchConversations();
		if (selectedBsuid) {
			const fp = fingerprintFor(selectedBsuid);
			if (fp !== undefined && fp !== lastSelectedFingerprint) {
				lastSelectedFingerprint = fp;
				await fetchThread(selectedBsuid);
			}
		}
	}

	// Single-operator tool — no reason to poll a backgrounded or navigated-away
	// tab. SvelteKit's client-side routing means leaving /dashboard/inbox for
	// another dashboard route doesn't reload the page, so without this the
	// interval would otherwise keep firing against a route nobody can see.
	let pollInterval: ReturnType<typeof setInterval> | null = null;

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(pollTick, 8000);
	}
	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}
	function handleVisibilityChange() {
		if (document.hidden) {
			stopPolling();
		} else {
			pollTick();
			startPolling();
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		if (!document.hidden) startPolling();
		initPush().then((s) => (pushState = s));
	});
	onDestroy(() => {
		stopPolling();
		if (browser) document.removeEventListener('visibilitychange', handleVisibilityChange);
	});

	// Push covers the case polling can't: the tab is closed, or the operator is
	// away from this machine entirely.
	let pushState = $state<PushState>('unsupported');
	let pushBusy = $state(false);

	async function togglePush() {
		if (pushBusy || pushState === 'blocked' || pushState === 'unsupported') return;
		pushBusy = true;
		try {
			pushState = pushState === 'on' ? await disablePush() : await enablePush();
		} finally {
			pushBusy = false;
		}
	}

	function formatTime(iso?: string) {
		if (!iso) return '';
		return new Date(iso).toLocaleString();
	}
</script>

<svelte:head>
	<title>Inbox | Bhejna</title>
	<!-- PWA install is offered here only. Linking the manifest from app.html
	     would advertise "Install Bhejna" to every visitor on the landing page,
	     docs and login — this is a single-operator tool. -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon-192.png" />
	<meta name="theme-color" content="#020617" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Bhejna" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

<div class="min-h-screen bg-slate-950 font-sans text-slate-100">
	<main class="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
		<!-- Left Pane: Conversation List -->
		<div
			class="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
		>
			<div class="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
				<h2 class="text-sm font-semibold text-slate-100">Conversations</h2>
				<div class="flex items-center gap-1">
					{#if install.available}
						<button
							type="button"
							onclick={promptInstall}
							title="Install Bhejna as an app on this device"
							class="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600/15 px-2 py-1 text-[10px] font-medium text-blue-400 transition-colors hover:bg-blue-600/25"
						>
							<Download size={12} />
							Install
						</button>
					{/if}
					{#if pushState !== 'unsupported'}
						<button
							type="button"
							onclick={togglePush}
							disabled={pushBusy || pushState === 'blocked'}
							title={pushState === 'blocked'
								? 'Notifications are blocked in your browser settings'
								: pushState === 'on'
									? 'Notifications on — click to turn off'
									: 'Get notified of new messages, even with this tab closed'}
							class="rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 {pushState ===
							'on'
								? 'text-blue-400 hover:bg-slate-800'
								: 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}"
						>
							{#if pushBusy}
								<Loader2 size={16} class="animate-spin" />
							{:else if pushState === 'on'}
								<BellRing size={16} />
							{:else if pushState === 'blocked'}
								<BellOff size={16} />
							{:else}
								<Bell size={16} />
							{/if}
						</button>
					{/if}
				</div>
			</div>
			<div class="divide-slate-850 flex-1 divide-y overflow-y-auto">
				{#if conversations.length === 0}
					<div class="p-6 text-center text-xs text-slate-500">
						No conversations yet. Inbound messages will appear here.
					</div>
				{:else}
					{#each conversations as conv (conv.recipient_bsuid)}
						<button
							type="button"
							onclick={() => selectConversation(conv.recipient_bsuid!)}
							class="w-full px-4 py-3 text-left transition-colors hover:bg-slate-800/60 {selectedBsuid ===
							conv.recipient_bsuid
								? 'bg-slate-800/80'
								: ''}"
						>
							<div class="flex items-center justify-between gap-2">
								<span class="truncate text-xs font-semibold text-slate-200">
									{conv.display_name || conv.recipient_bsuid}
								</span>
								<span class="shrink-0 text-[9px] text-slate-500">{formatTime(conv.created_at)}</span
								>
							</div>
							{#if conv.display_name}
								<span class="truncate font-mono text-[10px] text-slate-500"
									>{conv.recipient_bsuid}</span
								>
							{/if}
							{#if conv.phone_number && conv.phone_number !== conv.display_name && conv.phone_number !== conv.recipient_bsuid}
								<span class="truncate font-mono text-[10px] text-slate-500"
									>{conv.phone_number}</span
								>
							{/if}
							<p class="mt-1 truncate text-xs text-slate-400">
								{conv.direction === 'outbound' ? 'You: ' : ''}{conv.body || ''}
							</p>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Right Pane: Selected Thread -->
		<div
			class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
		>
			{#if !selectedBsuid}
				<div class="flex flex-1 items-center justify-center text-slate-600">
					<div class="text-center">
						<MessageSquare size={32} class="mx-auto mb-2" />
						<p class="text-xs">Select a conversation to view the thread</p>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
					<div class="flex flex-col">
						<span class="text-xs font-semibold text-slate-200"
							>{threadDisplayName || selectedBsuid}</span
						>
						{#if threadDisplayName || threadPhoneNumber}
							<span class="font-mono text-[10px] text-slate-500">
								{threadDisplayName ? selectedBsuid : ''}{threadDisplayName && threadPhoneNumber
									? ' · '
									: ''}{threadPhoneNumber ?? ''}
							</span>
						{/if}
					</div>
					{#if sessionActive}
						<span
							class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400"
							>Session Open</span
						>
					{:else}
						<span
							class="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-medium text-slate-400"
							>Session Closed</span
						>
					{/if}
				</div>

				<div class="flex-1 space-y-3 overflow-y-auto p-4">
					{#if threadLoading && threadMessages.length === 0}
						<div class="flex justify-center py-8">
							<Loader2 size={20} class="animate-spin text-slate-600" />
						</div>
					{:else}
						{#each threadMessages as msg (msg.id)}
							<MessageBubble {msg} />
						{/each}
					{/if}
				</div>

				<div class="border-t border-slate-800 p-4">
					{#if !sessionActive}
						<p class="mb-2 text-xs text-amber-400">Session expired — send a template to reopen.</p>
					{/if}
					<form
						method="POST"
						action="?/reply"
						use:enhance={() => {
							sending = true;
							return async ({ update }) => {
								sending = false;
								replyBody = '';
								await update({ invalidateAll: false });
								if (selectedBsuid) {
									await fetchThread(selectedBsuid);
									// Refresh the list too so its fingerprint reflects the reply we
									// just sent — otherwise the next poll tick would see the list
									// change and redundantly re-fetch a thread we already have fresh.
									await fetchConversations();
									lastSelectedFingerprint = fingerprintFor(selectedBsuid);
								}
							};
						}}
						class="flex items-center gap-2"
					>
						<input type="hidden" name="recipient_bsuid" value={selectedBsuid} />
						<input
							type="text"
							name="body"
							bind:value={replyBody}
							disabled={!sessionActive || sending}
							placeholder={sessionActive
								? 'Type a reply...'
								: 'Session expired — send a template to reopen'}
							class="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-200 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden disabled:opacity-50"
						/>
						<button
							type="submit"
							disabled={!sessionActive || sending || !replyBody.trim()}
							class="shrink-0 rounded-xl bg-blue-600 p-2.5 text-white transition-all hover:bg-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if sending}
								<Loader2 size={16} class="animate-spin" />
							{:else}
								<Send size={16} />
							{/if}
						</button>
					</form>
					{#if form?.message}
						<p
							class="mt-2 text-xs {(form as any).sessionClosed ? 'text-amber-400' : 'text-red-400'}"
						>
							{form.message}
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</main>
</div>
