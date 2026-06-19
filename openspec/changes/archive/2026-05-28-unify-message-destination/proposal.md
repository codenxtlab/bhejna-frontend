## Why

Currently, our Go backend contracts and local SvelteKit API proxy route utilize split message destination parameters (`to_phone` and `to_bsuid`). To simplify integration contracts and align with modern multi-channel routing patterns, the Go backend has unified outbound message destinations into a single polymorphic field named `to`. We need to align the frontend message proxy and playground UI with this updated contract to resolve HTTP 400 validation exceptions.

## What Changes

- **Contract Alignment**: Synchronize our OpenAPI definitions from the Go backend and regenerate local SDK clients and Zod schema validators (`npm run api:sync`).
- **API Proxy Refactoring (BREAKING)**: Completely remove `to_phone` and `to_bsuid` properties from the `/api/test-message` proxy payload, and replace them with a unified polymorphic field `to`.
- **Dashboard UI Refactoring**: Replace split/obsolete target variables like `recipientPhone` with a single unified `recipientTarget` state in the developer playground UI.

## Capabilities

### New Capabilities

- `unified-destination`: Exposes a unified destination target field `to` that polymorphically routing message dispatches to either standard phone numbers or internal business scope IDs.

### Modified Capabilities

<!-- None -->

## Impact

- **Affected Code**:
  - `src/routes/api/test-message/+server.ts` (flat payload construction maps `to` field).
  - `src/routes/dashboard/+page.svelte` (playground variables and form submission maps `recipientTarget`).
- **APIs**: Local proxy `/api/test-message` route structure shifts to polymorphic validation.
- **Dependencies**: Requires Orval model regenerations.
