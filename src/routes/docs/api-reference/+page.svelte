<script lang="ts">
	import { onMount } from 'svelte';
	import { createApiReference } from '@scalar/api-reference';
	import '@scalar/api-reference/style.css';

	let container: HTMLElement;
	let scalarInstance: any;

	onMount(() => {
		if (container) {
			scalarInstance = createApiReference(container, {
				url: '/api/openapi.yaml',
				theme: 'deepSpace',
				darkMode: true,
				showSidebar: true,
				layout: 'modern',
				searchHotKey: 'k'
			});
		}

		return () => {
			if (scalarInstance && scalarInstance.destroy) {
				scalarInstance.destroy();
			}
		};
	});
</script>

<svelte:head>
	<title>API Reference | Bhejna Docs</title>
	<meta
		name="description"
		content="Interactive API documentation for Bhejna - high-performance WhatsApp messaging proxy."
	/>
</svelte:head>

<main class="min-h-screen w-full bg-[#0A0A0A] text-white">
	<!-- Scalar UI Container -->
	<div bind:this={container} class="scalar-theme-deep-space"></div>
</main>

<style>
	/* Native feel overrides for Bhejna's Stealth Minimalist aesthetic */
	:global(.scalar-api-reference) {
		--scalar-font-body: 'Inter', system-ui, sans-serif;
		--scalar-font-code: 'JetBrains Mono', 'Fira Code', monospace;
		--scalar-color-1: #ffffff;
		--scalar-color-2: #94a3b8;
		--scalar-color-3: #64748b;
		--scalar-color-accent: #06b6d4; /* Cyan accent matching Bhejna */
		--scalar-background-1: #0a0a0a;
		--scalar-background-2: #111111;
		--scalar-background-3: #1a1a1a;
		--scalar-border-color: #1f2937;
	}

	/* Ensure Scalar fills the screen properly */
	:global(body) {
		margin: 0;
		padding: 0;
		background-color: #0a0a0a;
	}

	:global(.scalar-api-reference .sidebar) {
		background-color: #0a0a0a !important;
		border-right: 1px solid #1f2937 !important;
	}

	:global(.scalar-api-reference .main-content) {
		background-color: #0a0a0a !important;
	}
</style>
