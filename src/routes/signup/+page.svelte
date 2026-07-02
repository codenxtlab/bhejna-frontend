<script lang="ts">
	import { enhance } from '$app/forms';
	import { Eye, EyeOff } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let error = $state('');
	let loading = $state(false);

	let passwordsMatch = $derived(password === confirmPassword);

	$effect(() => {
		if (form?.error) {
			error = form.error;
		}
	});

	function handleSubmit(e: SubmitEvent) {
		if (!passwordsMatch) {
			e.preventDefault();
			error = 'Passwords do not match';
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans text-slate-50">
	<div class="w-full max-w-md space-y-6 rounded-xl border border-slate-700 bg-slate-800 p-8">
		<div class="text-center">
			<img src="/favicon.svg" alt="Bhejna Logo" class="mx-auto mb-4 h-12 w-12" />
			<h1 class="text-2xl font-bold tracking-tight text-slate-50">Bhejna</h1>
			<p class="mt-1 text-xs text-slate-400">Create an Account</p>
		</div>

		{#if form?.success}
			<div
				class="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-4 text-center text-sm text-emerald-400"
			>
				<p class="font-semibold text-emerald-200">Registration Successful</p>
				<p class="mt-2 font-mono text-xs leading-relaxed text-emerald-500/90">
					Check your email to confirm your account.
				</p>
			</div>
			<div class="pt-2 text-center">
				<a
					href="/login"
					class="text-sm text-slate-400 underline underline-offset-4 transition-colors hover:text-blue-500"
				>
					Return to login
				</a>
			</div>
		{:else}
			<form
				method="POST"
				action="?/signup"
				onsubmit={handleSubmit}
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
					<div class="relative">
						<input
							type={showPassword ? 'text' : 'password'}
							id="password"
							name="password"
							bind:value={password}
							required
							autocomplete="new-password"
							class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 pr-10 text-sm text-slate-50 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							placeholder="••••••••"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-slate-400 transition-colors hover:text-slate-200 focus:outline-none"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<div>
					<label
						for="confirmPassword"
						class="mb-1.5 block text-xs font-semibold tracking-wider text-slate-400 uppercase"
						>Confirm Password</label
					>
					<div class="relative">
						<input
							type={showConfirmPassword ? 'text' : 'password'}
							id="confirmPassword"
							name="confirmPassword"
							bind:value={confirmPassword}
							required
							autocomplete="new-password"
							class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 pr-10 text-sm text-slate-50 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							placeholder="••••••••"
						/>
						<button
							type="button"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
							class="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-slate-400 transition-colors hover:text-slate-200 focus:outline-none"
							aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
						>
							{#if showConfirmPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				{#if error}
					<p class="my-2 text-center text-sm font-medium text-red-500">{error}</p>
				{:else if !passwordsMatch && confirmPassword !== ''}
					<p class="my-2 text-center text-sm font-medium text-red-500">Passwords do not match</p>
				{/if}

				<button
					type="submit"
					disabled={loading || (!passwordsMatch && confirmPassword !== '')}
					class="w-full cursor-pointer rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
				>
					{loading ? 'Creating account...' : 'Sign Up'}
				</button>
			</form>

			<div class="border-t border-slate-700 pt-4 text-center">
				<a
					href="/login"
					class="text-sm text-slate-400 underline underline-offset-4 transition-colors hover:text-blue-500"
				>
					Already have an account? Sign In
				</a>
			</div>
		{/if}
	</div>
</div>
