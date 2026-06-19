import visit from 'unist-util-visit';
import { schemas } from '../generated/openapi.server.ts';
import { highlight } from './docs.server.ts';

/**
 * Rehype plugin for OpenAPI documentation.
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * In mdsvex, Svelte component tags like <ApiEndpoint operationId="sendMessage" />
 * pass through the rehype AST as raw text/HTML nodes — they are NOT represented as
 * element nodes with tagName === 'ApiEndpoint'. This means rehype plugins cannot
 * intercept them to inject props.
 *
 * Therefore, ApiEndpoint.svelte resolves its own data directly from the compiled
 * registry (src/lib/generated/openapi.ts) using its operationId prop.
 *
 * This plugin handles:
 *   1. Pre-highlighting fenced code blocks via Shiki (for <pre> elements)
 *   2. Schema injection for SchemaTable (when schemaName prop is provided)
 *
 * The plugin does NOT need to inject opData into ApiEndpoint — that's handled
 * by the component itself via direct registry import.
 */
export function rehypeOpenApi() {
	return async (tree: any) => {
		const promises: Promise<void>[] = [];

		visit(tree, 'element', (node: any) => {
			// Note: <ApiEndpoint> nodes are NOT visible here due to how mdsvex processes
			// Svelte components. ApiEndpoint resolves its own data from the registry.

			// Handle SchemaTable schema injection (if schemaName prop is used)
			if (node.tagName === 'SchemaTable') {
				const schemaName = node.properties?.schemaName;
				const schemaProp = node.properties?.schema;

				let targetSchema = schemaName;
				if (!targetSchema && typeof schemaProp === 'string') {
					// Extract "ErrorResponse" from "{schemas.ErrorResponse}" style references
					const match = schemaProp.match(/schemas\.(\w+)/);
					if (match) targetSchema = match[1];
				}

				if (targetSchema) {
					const schemaData = (schemas as any)[targetSchema];
					if (schemaData) {
						node.properties.schemaData = JSON.stringify(schemaData);
					} else {
						const available = Object.keys(schemas as any);
						console.warn(
							`⚠️  rehypeOpenApi: Schema "${targetSchema}" not found in registry.\n` +
								`   Available schemas: ${available.join(', ')}`
						);
					}
				}
			}
		});

		await Promise.all(promises);
	};
}
