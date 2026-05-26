<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData, form: ActionData } = $props();
	
	let loading = $state(false);
	let isSignUp = $state(false);
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-900 p-4">
	<div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-6">
		<div class="text-center">
			<img src="/favicon.svg" alt="Bhejna Logo" class="w-16 h-16 mx-auto mb-4" />
			<h1 class="text-3xl font-bold text-white tracking-tight">Bhejna</h1>
			<p class="text-slate-400 mt-2">Control Plane Dashboard</p>
		</div>

		<form 
			method="POST" 
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					update();
				};
			}} 
			class="space-y-4"
		>
			<input type="hidden" name="isSignUp" value={isSignUp ? 'true' : 'false'} />
			<div>
				<label for="email" class="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
				<input
					type="email"
					id="email"
					name="email"
					value={form?.email ?? ''}
					required
					class="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
					placeholder="name@company.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-slate-300 mb-1">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					class="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
					placeholder="••••••••"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
			>
				{loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
			</button>
		</form>

		{#if form?.message}
			<p class="text-center text-sm {form.message.includes('Check') ? 'text-green-400' : 'text-red-400'} animate-pulse">
				{form.message}
			</p>
		{/if}

		<div class="text-center pt-4 border-t border-slate-700 space-y-3">
			<button
				onclick={() => (isSignUp = !isSignUp)}
				class="w-full text-sm text-slate-400 hover:text-blue-400 transition-colors underline underline-offset-4"
			>
				{isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
			</button>
			<div class="pt-2">
				<a href="/docs" class="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center">
					<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
					View API Documentation
				</a>
			</div>
		</div>
	</div>
</div>
