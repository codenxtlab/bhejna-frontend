<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import {
		Send,
		Loader2,
		MessageSquare,
		Bell,
		BellOff,
		BellRing,
		Download,
		ArrowLeft
	} from 'lucide-svelte';
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
		threadMessages = [];
		threadDisplayName = null;
		threadPhoneNumber = null;
		lastSelectedFingerprint = fingerprintFor(bsuid);
		fetchThread(bsuid);
	}

	// Mobile is one pane at a time: back returns to the list. On md+ both panes
	// are always visible, so the button is hidden there.
	function closeThread() {
		selectedBsuid = null;
		threadMessages = [];
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

	// Single-operator tool. No reason to poll a backgrounded or navigated-away
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

	// Newest message pinned to the bottom, like every chat client. $effect runs
	// after the DOM updates, so scrollHeight is already the post-render value.
	let threadEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		threadMessages.length;
		threadEl?.scrollTo({ top: threadEl.scrollHeight });
	});

	function dayKey(iso?: string) {
		return iso ? new Date(iso).toDateString() : '';
	}

	function dayLabel(iso?: string) {
		if (!iso) return '';
		const key = dayKey(iso);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(today.getDate() - 1);
		if (key === today.toDateString()) return 'Today';
		if (key === yesterday.toDateString()) return 'Yesterday';
		return new Date(iso).toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}

	// One entry per message, carrying the day-divider label when the day changes.
	const thread = $derived(
		threadMessages.map((msg, i) => ({
			msg,
			divider:
				dayKey(msg.created_at) === dayKey(threadMessages[i - 1]?.created_at)
					? null
					: dayLabel(msg.created_at)
		}))
	);

	// List timestamps stay glanceable: time for today, weekday this week, date beyond.
	function formatListTime(iso?: string) {
		if (!iso) return '';
		const d = new Date(iso);
		const label = dayLabel(iso);
		if (label === 'Today') return d.toLocaleTimeString(undefined, { timeStyle: 'short' });
		if (label === 'Yesterday') return 'Yesterday';
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	}

	function initials(name: string) {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
		return name.replace(/\D/g, '').slice(-2) || name.slice(0, 2).toUpperCase();
	}
</script>

<svelte:head>
	<title>Inbox | Bhejna</title>
	<!-- PWA install is offered here only. Linking the manifest from app.html
	     would advertise "Install Bhejna" to every visitor on the landing page,
	     docs and login. This is a single-operator tool. -->
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon-192.png" />
	<meta name="theme-color" content="#020617" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Bhejna" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

<!-- 100dvh, not 100vh: iOS Safari's collapsing address bar makes vh overshoot. -->
<div class="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 font-sans text-slate-100">
	<main class="mx-auto flex w-full max-w-7xl flex-1 overflow-hidden md:gap-4 md:p-4">
		<!-- Conversation list. Full width on mobile, hidden once a thread is open. -->
		<section
			class="{selectedBsuid
				? 'hidden md:flex'
				: 'flex'} w-full min-w-0 flex-col overflow-hidden md:w-80 md:shrink-0 md:rounded-2xl md:border md:border-slate-800 md:bg-slate-900"
		>
			<header
				class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:pt-3"
			>
				<h2 class="text-base font-semibold text-slate-100 md:text-sm">Conversations</h2>
				<div class="flex items-center gap-1">
					{#if install.available}
						<button
							type="button"
							onclick={promptInstall}
							title="Install Bhejna as an app on this device"
							class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600/15 px-2.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-600/25 active:scale-[0.97]"
						>
							<Download size={14} />
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
									? 'Notifications on, tap to turn off'
									: 'Get notified of new messages, even with this tab closed'}
							class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 {pushState ===
							'on'
								? 'text-blue-400 hover:bg-slate-800'
								: 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}"
						>
							{#if pushBusy}
								<Loader2 size={18} class="animate-spin" />
							{:else if pushState === 'on'}
								<BellRing size={18} />
							{:else if pushState === 'blocked'}
								<BellOff size={18} />
							{:else}
								<Bell size={18} />
							{/if}
						</button>
					{/if}
				</div>
			</header>

			<div class="flex-1 divide-y divide-slate-800/70 overflow-y-auto overscroll-contain">
				{#if conversations.length === 0}
					<div class="flex flex-col items-center gap-2 px-8 py-16 text-center">
						<MessageSquare size={28} class="text-slate-700" />
						<p class="text-sm text-slate-500">No conversations yet</p>
						<p class="text-xs text-slate-600">Inbound messages will appear here.</p>
					</div>
				{:else}
					{#each conversations as conv (conv.recipient_bsuid)}
						{@const name = conv.display_name || conv.recipient_bsuid || ''}
						<button
							type="button"
							onclick={() => selectConversation(conv.recipient_bsuid!)}
							class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/60 active:bg-slate-800 {selectedBsuid ===
							conv.recipient_bsuid
								? 'md:bg-slate-800/80'
								: ''}"
						>
							<span
								class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300"
								aria-hidden="true">{initials(name)}</span
							>
							<span class="min-w-0 flex-1">
								<span class="flex items-baseline justify-between gap-2">
									<span class="truncate text-sm font-semibold text-slate-100">{name}</span>
									<span class="shrink-0 text-[11px] text-slate-500"
										>{formatListTime(conv.created_at)}</span
									>
								</span>
								<span class="mt-0.5 block truncate text-xs text-slate-400">
									{conv.direction === 'outbound' ? 'You: ' : ''}{conv.body || ''}
								</span>
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</section>

		<!-- Thread. Takes over the whole screen on mobile once a conversation is open. -->
		<section
			class="{selectedBsuid
				? 'flex'
				: 'hidden md:flex'} w-full min-w-0 flex-1 flex-col overflow-hidden md:rounded-2xl md:border md:border-slate-800 md:bg-slate-900"
		>
			{#if !selectedBsuid}
				<div class="flex flex-1 items-center justify-center text-slate-600">
					<div class="text-center">
						<MessageSquare size={32} class="mx-auto mb-2" />
						<p class="text-xs">Select a conversation to view the thread</p>
					</div>
				</div>
			{:else}
				{@const name = threadDisplayName || selectedBsuid}
				<header
					class="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 md:px-4 md:pt-3 md:pb-3"
				>
					<button
						type="button"
						onclick={closeThread}
						aria-label="Back to conversations"
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-slate-800 active:scale-[0.97] md:hidden"
					>
						<ArrowLeft size={20} />
					</button>
					<span
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300"
						aria-hidden="true">{initials(name)}</span
					>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm font-semibold text-slate-100">{name}</span>
						<span class="truncate font-mono text-[10px] text-slate-500">
							{threadPhoneNumber || selectedBsuid}
						</span>
					</div>
					{#if sessionActive}
						<span
							class="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400"
							>Open</span
						>
					{:else}
						<span
							class="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-400"
							>Closed</span
						>
					{/if}
				</header>

				<div
					bind:this={threadEl}
					class="flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4 md:px-4"
				>
					{#if threadLoading && thread.length === 0}
						<div class="flex justify-center py-8">
							<Loader2 size={20} class="animate-spin text-slate-600" />
						</div>
					{:else if thread.length === 0}
						<p class="py-8 text-center text-xs text-slate-600">No messages in this conversation.</p>
					{:else}
						{#each thread as { msg, divider } (msg.id)}
							{#if divider}
								<div class="flex justify-center py-2">
									<span
										class="rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium text-slate-400"
										>{divider}</span
									>
								</div>
							{/if}
							<MessageBubble {msg} />
						{/each}
					{/if}
				</div>

				<div
					class="shrink-0 border-t border-slate-800 bg-slate-900 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-4 md:pb-4"
				>
					{#if !sessionActive}
						<p class="mb-2 text-xs text-amber-400">
							Session expired. Send a template to reopen it.
						</p>
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
									// just sent, otherwise the next poll tick would see the list
									// change and redundantly re-fetch a thread we already have fresh.
									await fetchConversations();
									lastSelectedFingerprint = fingerprintFor(selectedBsuid);
								}
							};
						}}
						class="flex items-end gap-2"
					>
						<input type="hidden" name="recipient_bsuid" value={selectedBsuid} />
						<!-- text-base on mobile: anything under 16px makes iOS Safari zoom on focus. -->
						<input
							type="text"
							name="body"
							bind:value={replyBody}
							disabled={!sessionActive || sending}
							enterkeyhint="send"
							autocomplete="off"
							placeholder={sessionActive ? 'Message' : 'Session expired'}
							class="min-h-11 flex-1 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden disabled:opacity-50 md:text-sm"
						/>
						<button
							type="submit"
							aria-label="Send reply"
							disabled={!sessionActive || sending || !replyBody.trim()}
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-transform hover:bg-blue-500 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40"
						>
							{#if sending}
								<Loader2 size={18} class="animate-spin" />
							{:else}
								<Send size={18} />
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
		</section>
	</main>
</div>
