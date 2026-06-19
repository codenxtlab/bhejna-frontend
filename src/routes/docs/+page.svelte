<script lang="ts">
	import {
		Terminal,
		Shield,
		Zap,
		Activity,
		Webhook,
		BookOpen,
		Code,
		Info,
		AlertTriangle,
		Copy,
		Check
	} from 'lucide-svelte';

	// The registry (operations) is already synchronized with the YAML via the compiler.

	let copiedId = $state<string | null>(null);

	async function copyToClipboard(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => (copiedId = null), 2000);
	}
</script>

<div
	class="min-h-screen bg-[#020617] text-slate-300 selection:bg-cyan-500/30 selection:text-cyan-200"
>
	<!-- Gradient Background Effects -->
	<div class="pointer-events-none fixed inset-0 overflow-hidden">
		<div
			class="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-cyan-500/5 blur-[120px]"
		></div>
		<div
			class="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/5 blur-[100px]"
		></div>
	</div>

	<main class="relative mx-auto max-w-5xl px-6 py-20 lg:py-32">
		<!-- Hero Section -->
		<header class="mb-24">
			<div class="mb-6 flex items-center gap-3">
				<div class="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
					<BookOpen size={20} class="text-cyan-400" />
				</div>
				<span class="text-xs font-black tracking-[0.2em] text-slate-500 uppercase"
					>Developer Documentation</span
				>
			</div>
			<h1 class="mb-8 text-5xl leading-[0.9] font-black tracking-tighter text-white lg:text-7xl">
				Build Infrastructure <br />
				<span class="text-slate-500">for WhatsApp.</span>
			</h1>
			<p class="max-w-2xl text-xl leading-relaxed text-slate-400">
				Bhejna is a high-performance messaging proxy designed for scale. Sync your WABA, provision
				keys, and start sending messages in minutes.
			</p>
		</header>

		<!-- Authentication -->
		<section id="authentication" class="mb-32 scroll-mt-32">
			<div class="mb-8 flex items-center gap-3">
				<Shield size={24} class="text-cyan-500" />
				<h2 class="text-3xl font-black tracking-tight text-white">Authentication</h2>
			</div>

			<p class="mb-8 leading-relaxed text-slate-400">
				All requests to the Bhejna API must be authenticated using a Bearer Token. You can generate
				production-grade keys starting with <code class="font-mono text-cyan-400">nxt_live_</code> in
				your dashboard.
			</p>

			<div class="rounded-3xl border border-slate-800/60 bg-slate-900/40 p-8">
				<h3 class="mb-4 text-sm font-bold tracking-widest text-slate-500 uppercase">
					Authorization Header
				</h3>

				<div class="overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a]">
					<div
						class="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2"
					>
						<div class="flex items-center gap-2">
							<Terminal size={12} class="text-slate-400" />
							<span class="text-xs font-semibold text-slate-300">Header</span>
						</div>
						<button
							onclick={() => copyToClipboard('Authorization: Bearer nxt_live_YOUR_API_KEY', 'auth')}
							class="rounded-lg p-2 text-slate-500 transition-colors hover:text-white"
						>
							{#if copiedId === 'auth'}
								<Check size={14} class="text-green-500" />
							{:else}
								<Copy size={14} />
							{/if}
						</button>
					</div>
					<pre class="overflow-x-auto p-6"><code class="font-mono text-sm text-slate-300"
							>Authorization: Bearer nxt_live_YOUR_API_KEY</code
						></pre>
				</div>

				<div class="mt-8 flex gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
					<div class="mt-0.5 shrink-0">
						<AlertTriangle size={20} class="text-amber-500" />
					</div>
					<div>
						<h5 class="mt-0 mb-1 font-bold text-slate-200">Security Requirement</h5>
						<p class="text-sm leading-relaxed text-slate-400">
							Ensure your API key is kept secret. Do not expose it in client-side code or public
							repositories. Requests over non-HTTPS connections will be rejected.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Quick Example -->
		<section id="quick-example" class="mb-32 scroll-mt-32">
			<div class="mb-8 flex items-center gap-3">
				<Zap size={24} class="text-yellow-500" />
				<h2 class="text-3xl font-black tracking-tight text-white">Quick Example</h2>
			</div>

			<p class="mb-8 leading-relaxed text-slate-400">
				Send a template message instantly using cURL. This example uses the production endpoint and
				a standard WhatsApp template.
			</p>

			<div class="overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a]">
				<div
					class="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2"
				>
					<div class="flex items-center gap-2">
						<Terminal size={12} class="text-slate-400" />
						<span class="text-xs font-semibold text-slate-300">Send Message</span>
					</div>
					<button
						onclick={() =>
							copyToClipboard(
								'curl -X POST "https://bhejna-api.codenxtlab.tech/v1/messages" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "recipient": "+1234567890",\n    "message_type": "template",\n    "payload": {\n      "template": {\n        "name": "hello_world",\n        "language": {\n          "code": "en_US"\n        }\n      }\n    }\n  }\'',
								'curl'
							)}
						class="rounded-lg p-2 text-slate-500 transition-colors hover:text-white"
					>
						{#if copiedId === 'curl'}
							<Check size={14} class="text-green-500" />
						{:else}
							<Copy size={14} />
						{/if}
					</button>
				</div>
				<pre class="overflow-x-auto p-6"><code class="font-mono text-sm text-slate-300"
						>curl -X POST "https://bhejna-api.codenxtlab.tech/v1/messages" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '&lcub;
    "recipient": "+1234567890",
    "message_type": "template",
    "payload": &lcub;
      "template": &lcub;
        "name": "hello_world",
        "language": &lcub;
          "code": "en_US"
        &rcub;
      &rcub;
    &rcub;
  &rcub;'</code
					></pre>
			</div>
		</section>

		<!-- API Reference -->
		<section id="api-reference" class="mb-32 scroll-mt-32">
			<div class="mb-8 flex items-center gap-3">
				<Code size={24} class="text-green-500" />
				<h2 class="text-3xl font-black tracking-tight text-white">API Reference</h2>
			</div>

			<div
				class="rounded-3xl border border-slate-800/60 bg-gradient-to-br from-slate-900/40 to-slate-800/20 p-12 text-center"
			>
				<h3 class="mb-4 text-2xl font-black text-white">Interactive API Explorer</h3>
				<p class="mx-auto mb-8 max-w-lg text-slate-400">
					Explore our complete API specification with interactive request builders, multi-language
					code snippets, and real-time response validation.
				</p>
				<a
					href="/docs/api-reference"
					class="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 font-black text-black transition-all hover:scale-105 hover:bg-cyan-400 active:scale-95"
				>
					Open API Reference
					<Zap size={18} fill="currentColor" />
				</a>
			</div>
		</section>

		<!-- Status Codes -->
		<section id="status-codes" class="mb-32 scroll-mt-32">
			<div class="mb-8 flex items-center gap-3">
				<Activity size={24} class="text-blue-500" />
				<h2 class="text-3xl font-black tracking-tight text-white">Status Codes</h2>
			</div>

			<div class="overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40">
				<table class="w-full border-collapse text-left text-sm">
					<thead>
						<tr class="bg-slate-900/60">
							<th
								class="border-b border-slate-800/60 px-8 py-4 font-black tracking-widest text-slate-500 uppercase"
								>Code</th
							>
							<th
								class="border-b border-slate-800/60 px-8 py-4 font-black tracking-widest text-slate-500 uppercase"
								>Description</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/60">
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-emerald-400">202 Accepted</td>
							<td class="px-8 py-6 text-slate-400"
								>Message has been enqueued successfully. Use the returned <code>job_id</code> for tracking.</td
							>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-yellow-400">400 Bad Request</td>
							<td class="px-8 py-6 text-slate-400"
								>Validation error. Check the response body for specific field errors.</td
							>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-red-400">401 Unauthorized</td>
							<td class="px-8 py-6 text-slate-400"
								>Invalid or missing API key. Ensure you are using the <code
									>Authorization: Bearer</code
								> scheme.</td
							>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-purple-400">429 Rate Limited</td>
							<td class="px-8 py-6 text-slate-400"
								>Too many requests. Implement exponential backoff.</td
							>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-slate-500">500 Server Error</td>
							<td class="px-8 py-6 text-slate-400"
								>Internal infrastructure issue. Bhejna status is automatically monitored.</td
							>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- Webhooks -->
		<section id="webhooks" class="mb-32 scroll-mt-32">
			<div class="mb-8 flex items-center gap-3">
				<Webhook size={24} class="text-indigo-500" />
				<h2 class="text-3xl font-black tracking-tight text-white">Webhooks</h2>
			</div>

			<p class="mb-8 leading-relaxed text-slate-400">
				Bhejna pushes real-time delivery status updates to your configured Webhook URL. We use a
				standard WhatsApp Business Platform schema for maximum compatibility.
			</p>

			<div class="grid grid-cols-1 gap-8">
				<div class="rounded-3xl border border-slate-800/60 bg-slate-900/40 p-8">
					<h3 class="mb-4 text-sm font-bold tracking-widest text-slate-500 uppercase">
						Delivery Status Schema
					</h3>
					<p class="mb-6 text-slate-400">
						Delivery updates include the message ID, current status (delivered, read, failed), and a
						timestamp. For a detailed schema definition, see the Webhooks section in our API
						reference.
					</p>
					<a
						href="/docs/api-reference#tag/Webhooks"
						class="flex items-center gap-2 font-bold text-cyan-400 hover:underline"
					>
						View Webhook Spec
						<Code size={16} />
					</a>
				</div>
			</div>
		</section>
	</main>

	<!-- Sidebar Navigation (Desktop) -->
	<aside class="fixed top-1/2 right-10 hidden w-64 -translate-y-1/2 xl:block">
		<nav class="space-y-4">
			{#each ['Authentication', 'Quick Example', 'API Reference', 'Status Codes', 'Webhooks'] as item}
				{#if item === 'API Reference'}
					<a
						href="/docs/api-reference"
						class="block text-xs font-black tracking-widest text-cyan-500 uppercase transition-colors hover:text-cyan-400"
					>
						{item}
					</a>
				{:else}
					<a
						href="#{item.toLowerCase().replace(' ', '-')}"
						class="block text-xs font-bold tracking-widest text-slate-500 uppercase transition-colors hover:text-cyan-400"
					>
						{item}
					</a>
				{/if}
			{/each}
		</nav>
	</aside>
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
