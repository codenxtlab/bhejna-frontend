import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { compileOpenAPI } from '../src/lib/utils/openapi-compiler.js';

/**
 * Synchronizes the OpenAPI specification from the backend repository
 * to the frontend documentation platform.
 *
 * It produces two outputs:
 * 1. src/lib/api/openapi.yaml: Raw spec for Orval/Zod generation.
 * 2. static/api/openapi.yaml: Public-safe spec for Scalar docs.
 */
async function syncOpenAPI() {
	const backendSpecPath = '/home/rakshitbhai/bhejna/internal/api/spec/openapi.yaml';
	const staticApiDir = path.resolve('static/api');
	const libApiDir = path.resolve('src/lib/api');

	console.log('🔄 Synchronizing OpenAPI contract from backend...');

	// 1. Ensure target directories exist
	[staticApiDir, libApiDir].forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});

	// 2. Validate backend spec exists
	if (!fs.existsSync(backendSpecPath)) {
		console.error(`❌ Backend OpenAPI spec not found at: ${backendSpecPath}`);
		process.exit(1);
	}

	try {
		// 3. Read the backend spec
		let rawContent = fs.readFileSync(backendSpecPath, 'utf8');
		rawContent = rawContent.replace('openapi: 3.0.3', 'openapi: 3.1.0');
		const spec = yaml.load(rawContent) as any;

		// 4. Save raw spec for internal generation
		fs.writeFileSync(path.join(libApiDir, 'openapi.yaml'), rawContent);
		console.log(`✅ Synced raw spec: -> ${path.join(libApiDir, 'openapi.yaml')}`);

		// 5. Post-process for public documentation
		console.log('🛡️  Post-processing public documentation spec...');
		const publicSpec = JSON.parse(JSON.stringify(spec)); // Deep clone

		// A. Ensure Sandbox server is first
		const sandboxUrl = 'https://sandbox.bhejna.codenxtlab.tech';
		const prodUrl = 'https://bhejna-api.codenxtlab.tech';

		publicSpec.servers = [
			{ url: sandboxUrl, description: 'Sandbox Server' },
			{ url: prodUrl, description: 'Production Server' }
		];

		// B. Remove internal/admin endpoints
		if (publicSpec.paths) {
			const internalPaths = Object.keys(publicSpec.paths).filter(
				(p) => p.startsWith('/v1/internal') || p.startsWith('/v1/admin')
			);

			internalPaths.forEach((p) => {
				console.log(`   - Hiding internal path: ${p}`);
				delete publicSpec.paths[p];
			});
		}

		// 6. Save public spec
		fs.writeFileSync(path.join(staticApiDir, 'openapi.yaml'), yaml.dump(publicSpec));
		console.log(`✅ Synced public spec: -> ${path.join(staticApiDir, 'openapi.yaml')}`);

		// 7. Trigger internal regeneration (using raw spec)
		console.log('🏗️  Regenerating endpoint registry...');
		await compileOpenAPI();

		console.log('✨ OpenAPI synchronization complete.');
	} catch (err) {
		console.error('❌ Sync failed:', err);
		process.exit(1);
	}
}

syncOpenAPI();
