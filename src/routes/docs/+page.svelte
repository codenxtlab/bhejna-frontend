<script lang="ts">
	import { Terminal, Shield, Zap, Activity, Webhook, BookOpen, Code, Info, AlertTriangle, Copy, Check } from 'lucide-svelte';

	// The registry (operations) is already synchronized with the YAML via the compiler.
	
	let copiedId = $state<string | null>(null);

	async function copyToClipboard(text: string, id: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => (copiedId = null), 2000);
	}
</script>

<div class="min-h-screen bg-[#020617] text-slate-300 selection:bg-cyan-500/30 selection:text-cyan-200">
	<!-- Gradient Background Effects -->
	<div class="fixed inset-0 overflow-hidden pointer-events-none">
		<div class="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]"></div>
		<div class="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]"></div>
	</div>

	<main class="relative max-w-5xl mx-auto px-6 py-20 lg:py-32">
		<!-- Hero Section -->
		<header class="mb-24">
			<div class="flex items-center gap-3 mb-6">
				<div class="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
					<BookOpen size={20} class="text-cyan-400" />
				</div>
				<span class="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Developer Documentation</span>
			</div>
			<h1 class="text-5xl lg:text-7xl font-black text-white tracking-tighter mb-8 leading-[0.9]">
				Build Infrastructure <br />
				<span class="text-slate-500">for WhatsApp.</span>
			</h1>
			<p class="text-xl text-slate-400 leading-relaxed max-w-2xl">
				Bhejna is a high-performance messaging proxy designed for scale. Sync your WABA, provision keys, and start sending messages in minutes.
			</p>
		</header>

		<!-- Authentication -->
		<section id="authentication" class="mb-32 scroll-mt-32">
			<div class="flex items-center gap-3 mb-8">
				<Shield size={24} class="text-cyan-500" />
				<h2 class="text-3xl font-black text-white tracking-tight">Authentication</h2>
			</div>

			<p class="mb-8 text-slate-400 leading-relaxed">
				All requests to the Bhejna API must be authenticated using a Bearer Token. You can generate production-grade keys starting with <code class="text-cyan-400 font-mono">nxt_live_</code> in your dashboard.
			</p>

			<div class="bg-slate-900/40 rounded-3xl border border-slate-800/60 p-8">
				<h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Authorization Header</h3>
				
				<div class="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden">
					<div class="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
						<div class="flex items-center gap-2">
							<Terminal size={12} class="text-slate-400" />
							<span class="text-xs font-semibold text-slate-300">Header</span>
						</div>
						<button 
							onclick={() => copyToClipboard('Authorization: Bearer nxt_live_YOUR_API_KEY', 'auth')}
							class="p-2 text-slate-500 hover:text-white transition-colors rounded-lg"
						>
							{#if copiedId === 'auth'}
								<Check size={14} class="text-green-500" />
							{:else}
								<Copy size={14} />
							{/if}
						</button>
					</div>
					<pre class="p-6 overflow-x-auto"><code class="text-sm font-mono text-slate-300">Authorization: Bearer nxt_live_YOUR_API_KEY</code></pre>
				</div>
				
				<div class="mt-8 flex gap-4 p-5 rounded-xl border border-amber-500/20 bg-amber-500/5">
					<div class="shrink-0 mt-0.5">
						<AlertTriangle size={20} class="text-amber-500" />
					</div>
					<div>
						<h5 class="mt-0 mb-1 font-bold text-slate-200">Security Requirement</h5>
						<p class="text-sm leading-relaxed text-slate-400">
							Ensure your API key is kept secret. Do not expose it in client-side code or public repositories. Requests over non-HTTPS connections will be rejected.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Quick Example -->
		<section id="quick-example" class="mb-32 scroll-mt-32">
			<div class="flex items-center gap-3 mb-8">
				<Zap size={24} class="text-yellow-500" />
				<h2 class="text-3xl font-black text-white tracking-tight">Quick Example</h2>
			</div>

			<p class="mb-8 text-slate-400 leading-relaxed">
				Send a template message instantly using cURL. This example uses the production endpoint and a standard WhatsApp template.
			</p>

			<div class="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden">
				<div class="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
					<div class="flex items-center gap-2">
						<Terminal size={12} class="text-slate-400" />
						<span class="text-xs font-semibold text-slate-300">Send Message</span>
					</div>
					<button 
						onclick={() => copyToClipboard('curl -X POST "https://bhejna-api.codenxtlab.tech/v1/messages" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "recipient": "+1234567890",\n    "message_type": "template",\n    "payload": {\n      "template": {\n        "name": "hello_world",\n        "language": {\n          "code": "en_US"\n        }\n      }\n    }\n  }\'', 'curl')}
						class="p-2 text-slate-500 hover:text-white transition-colors rounded-lg"
					>
						{#if copiedId === 'curl'}
							<Check size={14} class="text-green-500" />
						{:else}
							<Copy size={14} />
						{/if}
					</button>
				</div>
				<pre class="p-6 overflow-x-auto"><code class="text-sm font-mono text-slate-300">curl -X POST "https://bhejna-api.codenxtlab.tech/v1/messages" \
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
  &rcub;'</code></pre>
			</div>
		</section>

		<!-- API Reference -->
		<section id="api-reference" class="mb-32 scroll-mt-32">
			<div class="flex items-center gap-3 mb-8">
				<Code size={24} class="text-green-500" />
				<h2 class="text-3xl font-black text-white tracking-tight">API Reference</h2>
			</div>

			<div class="bg-gradient-to-br from-slate-900/40 to-slate-800/20 rounded-3xl border border-slate-800/60 p-12 text-center">
				<h3 class="text-2xl font-black text-white mb-4">Interactive API Explorer</h3>
				<p class="text-slate-400 mb-8 max-w-lg mx-auto">
					Explore our complete API specification with interactive request builders, 
					multi-language code snippets, and real-time response validation.
				</p>
				<a 
					href="/docs/api-reference" 
					class="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 text-black font-black rounded-xl hover:bg-cyan-400 transition-all hover:scale-105 active:scale-95"
				>
					Open API Reference
					<Zap size={18} fill="currentColor" />
				</a>
			</div>
		</section>

		<!-- Status Codes -->
		<section id="status-codes" class="mb-32 scroll-mt-32">
			<div class="flex items-center gap-3 mb-8">
				<Activity size={24} class="text-blue-500" />
				<h2 class="text-3xl font-black text-white tracking-tight">Status Codes</h2>
			</div>

			<div class="bg-slate-900/40 rounded-3xl border border-slate-800/60 overflow-hidden">
				<table class="w-full text-left text-sm border-collapse">
					<thead>
						<tr class="bg-slate-900/60">
							<th class="px-8 py-4 font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/60">Code</th>
							<th class="px-8 py-4 font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/60">Description</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/60">
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-emerald-400">202 Accepted</td>
							<td class="px-8 py-6 text-slate-400">Message has been enqueued successfully. Use the returned <code>job_id</code> for tracking.</td>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-yellow-400">400 Bad Request</td>
							<td class="px-8 py-6 text-slate-400">Validation error. Check the response body for specific field errors.</td>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-red-400">401 Unauthorized</td>
							<td class="px-8 py-6 text-slate-400">Invalid or missing API key. Ensure you are using the <code>Authorization: Bearer</code> scheme.</td>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-purple-400">429 Rate Limited</td>
							<td class="px-8 py-6 text-slate-400">Too many requests. Implement exponential backoff.</td>
						</tr>
						<tr>
							<td class="px-8 py-6 font-mono font-bold text-slate-500">500 Server Error</td>
							<td class="px-8 py-6 text-slate-400">Internal infrastructure issue. Bhejna status is automatically monitored.</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<!-- Webhooks -->
		<section id="webhooks" class="mb-32 scroll-mt-32">
			<div class="flex items-center gap-3 mb-8">
				<Webhook size={24} class="text-indigo-500" />
				<h2 class="text-3xl font-black text-white tracking-tight">Webhooks</h2>
			</div>

			<p class="mb-8 text-slate-400 leading-relaxed">
				Bhejna pushes real-time delivery status updates to your configured Webhook URL. We use a standard WhatsApp Business Platform schema for maximum compatibility.
			</p>

			<div class="grid grid-cols-1 gap-8">
				<div class="bg-slate-900/40 rounded-3xl border border-slate-800/60 p-8">
					<h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Delivery Status Schema</h3>
					<p class="text-slate-400 mb-6">
						Delivery updates include the message ID, current status (delivered, read, failed), and a timestamp. 
						For a detailed schema definition, see the Webhooks section in our API reference.
					</p>
					<a href="/docs/api-reference#tag/Webhooks" class="text-cyan-400 font-bold hover:underline flex items-center gap-2">
						View Webhook Spec
						<Code size={16} />
					</a>
				</div>
			</div>
		</section>
	</main>

	<!-- Sidebar Navigation (Desktop) -->
	<aside class="hidden xl:block fixed right-10 top-1/2 -translate-y-1/2 w-64">
		<nav class="space-y-4">
			{#each ['Authentication', 'Quick Example', 'API Reference', 'Status Codes', 'Webhooks'] as item}
				{#if item === 'API Reference'}
					<a 
						href="/docs/api-reference" 
						class="block text-xs font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-400 transition-colors"
					>
						{item}
					</a>
				{:else}
					<a 
						href="#{item.toLowerCase().replace(' ', '-')}" 
						class="block text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
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
