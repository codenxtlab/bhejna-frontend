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

<div class="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-50">
	<div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-8 space-y-6">
		<div class="text-center">
			<img src="/favicon.svg" alt="Bhejna Logo" class="w-12 h-12 mx-auto mb-4" />
			<h1 class="text-2xl font-bold tracking-tight text-slate-50">Bhejna</h1>
			<p class="text-xs text-slate-400 mt-1">Control Plane Login</p>
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
				<label for="email" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					required
					autocomplete="email"
					class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
					placeholder="name@company.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					bind:value={password}
					required
					autocomplete="current-password"
					class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
					placeholder="••••••••"
				/>
			</div>

			{#if error}
				<p class="text-sm text-red-500 text-center font-medium my-2">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm cursor-pointer"
			>
				{loading ? 'Signing in...' : 'Sign In'}
			</button>
		</form>

		<div class="text-center pt-4 border-t border-slate-700">
			<a
				href="/signup"
				class="text-sm text-slate-400 hover:text-blue-500 transition-colors underline underline-offset-4"
			>
				Don't have an account? Sign Up
			</a>
		</div>
	</div>
</div>
