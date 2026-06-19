## Why

Currently, Bhejna's developer playground supports sending a hardcoded text message payload ("This is a live test from the Bhejna gateway!") or the "hello_world" template. To provide a superior testing experience for developers, the dashboard should allow composing and sending custom free-form text messages dynamically, with a premium, responsive textarea component and visual feedback.

## What Changes

- **Dynamic Custom Text Area UI**: Introduce a sleek, glassmorphic textarea block inside the API Playground on the dashboard for composing custom messages when the "Send Free-Form Text" type is selected.
- **Polished Svelte 5 Integration**: Leverage Svelte 5 runes (`$state`, `$derived`, etc.) to bind the textarea input field dynamically.
- **Dynamic API Payload Handling**: Forward the custom textarea content directly to the `/api/test-message` proxy.
- **UX Enhancements**: Show live character counts, placeholder recommendations, and visually group input types based on active options to keep the dashboard uncluttered.

## Capabilities

### New Capabilities

- `freeform-messaging`: Provides developer playground UI for inputting and dynamically queueing custom free-form text messages to any WhatsApp recipient.

### Modified Capabilities

<!-- None -->

## Impact

- **Affected Code**: `src/routes/dashboard/+page.svelte` (visual form inputs, state bindings, handleTestMessage payload forwarding).
- **APIs**: Local proxy `/api/test-message` handles custom `text_body` value passed dynamically.
- **Dependencies**: Fully type-safe under generated Orval models.
