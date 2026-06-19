<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	$effect(() => {
		const urlError = page.url.searchParams.get('error');
		if (urlError === 'auth_failed') {
			error = 'Authentication failed. Please try again.';
		} else if (urlError) {
			error = urlError;
		}
	});

	$effect(() => {
		if (form?.error) {
			error = form.error;
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans text-slate-50">
	<div class="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-8">
		<div class="text-center">
			<img src="/favicon.svg" alt="Bhejna Logo" class="mx-auto mb-4 h-12 w-12" />
			<h1 class="text-2xl font-bold tracking-tight text-slate-50">Bhejna</h1>
			<p class="mt-1 text-xs text-slate-400">Control Plane Login</p>
		</div>

		<form
			method="POST"
			action="?/login"
			use:enhance={() => {
				loading = true;
				error = '';
				return async ({ update }) => {
					loading = false;
					await update({ reset: false });
				};
			}}
			class="space-y-4"
		>
			<div>
				<label
					for="email"
					class="mb-1.5 block text-xs font-semibold tracking-wider text-slate-400 uppercase"
					>Email Address</label
				>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					required
					autocomplete="email"
					class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-50 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					placeholder="name@company.com"
				/>
			</div>

			<div>
				<label
					for="password"
					class="mb-1.5 block text-xs font-semibold tracking-wider text-slate-400 uppercase"
					>Password</label
				>
				<input
					type="password"
					id="password"
					name="password"
					bind:value={password}
					required
					autocomplete="current-password"
					class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-50 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					placeholder="••••••••"
				/>
			</div>

			{#if error}
				<p class="my-2 text-center text-sm font-medium text-red-500">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
			>
				{loading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>

		<div class="border-t border-slate-700 pt-4 text-center">
			<a
				href="/signup"
				class="text-sm text-slate-400 underline underline-offset-4 transition-colors hover:text-blue-500"
			>
				Don't have an account? Sign Up
			</a>
		</div>
	</div>
</div>
