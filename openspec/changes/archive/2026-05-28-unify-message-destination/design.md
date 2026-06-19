## Context

Our Go data plane backend has consolidated destination properties (`to_phone`, `to_bsuid`) into a polymorphic `to` field inside its message dispatch envelope. Currently, the SvelteKit proxy route and playground dashboard settings card are sending the old flat layout, resulting in schema validation mismatches (HTTP 400 errors). We need to pull the new OpenAPI contract, regenerate our local Orval API clients and Zod schemas, and update our Svelte components to conform.

## Goals / Non-Goals

**Goals:**

- Synchronize the OpenAPI schema from the Go sibling codebase and run Orval generators.
- Refactor `src/routes/api/test-message/+server.ts` to construct the unified payload.
- Update `src/routes/dashboard/+page.svelte` to bind `recipientTarget` and dynamically proxy it to the local route.

**Non-Goals:**

- Reimplementing Go backend routing layers or validation rules in SvelteKit beyond matching Zod constraints.
- Adding manual phone number format cleaners in SvelteKit that conflict with Go's polymorphic resolver.

## Decisions

### 1. Unified Svelte 5 State Rune for Destination Targets

- **Choice**: Define `recipientTarget = $state('')` to replace `recipientPhone`.
- **Rationale**: Since `to` is fully polymorphic on the backend, a single unified target string input is the most elegant representation in the UI.

### 2. Client-to-Proxy Payload Forwarding

- **Choice**: Pass `recipient_target` from the dashboard fetch caller, and let the server proxy map it to `to`.
- **Rationale**: Maintains alignment between the browser forms layer and SvelteKit endpoints, providing clean parameter tracing.

## Risks / Trade-offs

- **Risk**: Zod validation failure if the new OpenAPI definition requires specific formats for the unified `to` parameter.
  - _Mitigation_: Verify the generated `SendMessageBody` schema validator inside `src/lib/api/generated/zod.ts` and ensure correct input passing.
