## Why

Bhejna's backend API has migrated to a high-throughput Asynchronous Queue engine. Hitting the message dispatch endpoint now returns an HTTP `202 Accepted` status with a `job_id` and a `status: "queued"` value instead of a completed delivery receipt. We need to sync our OpenAPI specification, regenerate local SDK models, and update our Svelte dashboard UI states to match this updated contract.

## What Changes

*   **API Model Alignment**: Synchronize contracts and regenerate fetch clients and schema validators to handle the updated `SendMessageResponse` structure (`job_id` and `status`).
*   **Playground UI Lifecyle Refactoring**: Update form handlers on the dashboard so successful submissions display a "Message Enqueued" or "Sending..." indicator rather than looking for immediate finished delivery.
*   **Compile State Verification**: Execute standard frontend checks to guarantee type safety under the async model.

## Capabilities

### New Capabilities

- `async-queue-dispatch`: Integrates the SvelteKit API client and dashboard settings simulation card with the backend's high-throughput HTTP 202 async message dispatch queue.

### Modified Capabilities

<!-- None -->

## Impact

*   **Affected Code**:
    *   `src/routes/api/test-message/+server.ts` (proxies the dynamic payload, returning the enqueued job metadata).
    *   `src/routes/dashboard/+page.svelte` (renders queued status badges and tracks enqueued job IDs).
*   **APIs**: Response interface of the outbound message dispatch conforms to the asynchronous contract.
*   **Dependencies**: Requires Orval model regenerations.
