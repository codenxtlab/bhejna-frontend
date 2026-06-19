import { defineConfig } from 'orval';

export default defineConfig({
	bhejna: {
		input: './src/lib/api/openapi.yaml',
		output: {
			mode: 'split',
			target: './src/lib/api/generated/client.ts',
			schemas: './src/lib/api/generated/models',
			client: 'fetch',
			mock: false,
			override: {
				mutator: {
					path: './src/lib/api/mutator.ts',
					name: 'customFetch'
				}
			}
		}
	},
	bhejnaZod: {
		input: './src/lib/api/openapi.yaml',
		output: {
			mode: 'split',
			client: 'zod',
			target: './src/lib/api/generated/zod.ts'
		}
	}
});
