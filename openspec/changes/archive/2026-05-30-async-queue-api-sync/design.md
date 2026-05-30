## Context

The backend has switched to an asynchronous messaging model. When we call the message dispatch API, we get an HTTP `202 Accepted` response with a `job_id` and a `status: "queued"`. The frontend needs to pull the contract spec (`npm run api:sync`), regenerate its Orval client SDK, and update the dashboard playground's form status visuals to represent this queueing flow.

## Goals / Non-Goals

**Goals:**
*   Synchronize the OpenAPI schema from the Go backend and generate updated typings.
*   Update dashboard playground page state models to render queued/sending indicators.
*   Validate complete workspace type safety under the async model.

**Non-Goals:**
*   Implementing long-polling websocket clients to check delivery status in real-time on the settings dashboard.
*   Altering backend task runner queues in SvelteKit.

## Decisions

### 1. Visual Queue Indicators
*   **Choice**: Render a distinct success badge mapping `job_id` when the message is successfully enqueued: `Message Queued: {job_id}`.
*   **Rationale**: Instantly confirms to developers that the payload has been safely received and enqueued in our broker network, eliminating blocking waits.

### 2. Local Proxy Payload Verification
*   **Choice**: Ensure the SvelteKit proxy `/api/test-message` forwards backend success payloads natively without structural conversions.
*   **Rationale**: Prevents data loss and allows frontends to transparently inspect response statuses.

## Risks / Trade-offs

*   **Risk**: Deprecated references to static delivery receipts in other layout cards.
    *   *Mitigation*: Verify the scope of references in the playground and ensure only enqueued job statuses are checked.
