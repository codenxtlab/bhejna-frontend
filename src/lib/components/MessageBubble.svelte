<script lang="ts">
	import { FileText, MapPin, User, AlertCircle, Mic } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import type { Message } from '$lib/api/generated/models';

	let { msg }: { msg: Message } = $props();

	const outbound = $derived(msg.direction === 'outbound');
	const media = $derived(msg.media ?? null);

	// A media id outlives its message row on Meta's side, but not forever, and
	// a proxy hop can fail. When the file won't load we fall back to the text
	// body rather than leaving a broken-image icon in the thread.
	let mediaFailed = $state(false);

	const src = $derived(media?.id ? resolve(`/api/media/${media.id}`) : '');

	function formatTime(iso?: string) {
		if (!iso) return '';
		return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
	}

	// Stickers and reactions read better without a chat bubble around them.
	const bare = $derived(!mediaFailed && (media?.type === 'sticker' || media?.type === 'reaction'));
</script>

<div class="flex {outbound ? 'justify-end' : 'justify-start'}">
	{#if bare && media?.type === 'reaction'}
		<span class="px-1 text-xs text-slate-400 italic">
			Reacted <span class="text-base not-italic">{media.emoji}</span>
		</span>
	{:else if bare && media?.type === 'sticker'}
		<div class="max-w-[85%] sm:max-w-[70%]">
			<img
				{src}
				alt={media.caption || 'Sticker'}
				loading="lazy"
				class="h-32 w-32 object-contain"
				onerror={() => (mediaFailed = true)}
			/>
			<span class="mt-1 block text-[9px] text-slate-500">{formatTime(msg.created_at)}</span>
		</div>
	{:else}
		<div
			class="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm sm:max-w-[70%] md:text-xs {outbound
				? 'rounded-br-md bg-blue-600 text-white'
				: 'rounded-bl-md bg-slate-800 text-slate-200'}"
		>
			{#if media && !mediaFailed}
				{#if media.type === 'image'}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- src is already resolve()d above; the rule only matches inline literals -->
					<a href={src} target="_blank" rel="noopener noreferrer">
						<img
							{src}
							alt={media.caption || 'Photo'}
							loading="lazy"
							class="max-h-72 w-auto rounded-lg"
							onerror={() => (mediaFailed = true)}
						/>
					</a>
				{:else if media.type === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						{src}
						controls
						preload="metadata"
						aria-label={media.caption || 'Video'}
						class="max-h-72 w-auto rounded-lg"
						onerror={() => (mediaFailed = true)}
					></video>
				{:else if media.type === 'audio'}
					<div class="flex items-center gap-2">
						{#if media.voice}
							<Mic size={14} class="shrink-0 opacity-70" />
						{/if}
						<audio
							{src}
							controls
							preload="metadata"
							aria-label={media.voice ? 'Voice message' : 'Audio'}
							class="h-8 max-w-full"
							onerror={() => (mediaFailed = true)}
						></audio>
					</div>
				{:else if media.type === 'document'}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- src is already resolve()d above; the rule only matches inline literals -->
					<a
						href={src}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 underline underline-offset-2"
					>
						<FileText size={16} class="shrink-0 opacity-70" />
						<span class="truncate">{media.filename || 'Document'}</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{#if media.mime_type}
						<span class="mt-0.5 block text-[9px] opacity-50">{media.mime_type}</span>
					{/if}
				{:else if media.type === 'location'}
					<a
						href="https://www.google.com/maps?q={media.latitude},{media.longitude}"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-start gap-2 underline underline-offset-2"
					>
						<MapPin size={16} class="mt-0.5 shrink-0 opacity-70" />
						<span>
							{media.name || 'Location'}
							{#if media.address}
								<span class="block text-[10px] opacity-70">{media.address}</span>
							{/if}
						</span>
					</a>
				{:else if media.type === 'contacts'}
					<div class="flex items-start gap-2">
						<User size={16} class="mt-0.5 shrink-0 opacity-70" />
						<span>{media.contacts?.join(', ') || 'Contact'}</span>
					</div>
				{:else}
					<!-- type:"unsupported", or a block Meta added that we don't render yet. -->
					<div class="flex items-start gap-2 opacity-70">
						<AlertCircle size={16} class="mt-0.5 shrink-0" />
						<span>
							Unsupported message
							{#if media.error}
								<span class="block text-[10px] opacity-80">{media.error}</span>
							{/if}
						</span>
					</div>
				{/if}

				{#if media.caption && media.type !== 'document'}
					<p class="mt-1.5 whitespace-pre-wrap">{media.caption}</p>
				{/if}
			{:else}
				<p class="whitespace-pre-wrap">{msg.body}</p>
				{#if mediaFailed}
					<span class="mt-0.5 block text-[9px] opacity-50">Attachment unavailable</span>
				{/if}
			{/if}

			<span class="mt-1 block text-[9px] opacity-60">{formatTime(msg.created_at)}</span>
		</div>
	{/if}
</div>
