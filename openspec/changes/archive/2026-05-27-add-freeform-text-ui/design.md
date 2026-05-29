## Context

Currently, the `bhejna-frontend` developer playground allows sending a text message, but uses a hardcoded body: `"This is a live test from the Bhejna gateway!"`. Developers need to be able to supply a custom string using a premium textarea, complete with live feedback (e.g. character count) to test variable message lengths and formats before production use.

## Goals / Non-Goals

**Goals:**
*   Provide a premium Svelte 5 component UI for freeform message input on the developer dashboard.
*   Enable real-time interactive feedback (character length counts, clean error states).
*   Correctly parse and forward custom user input through the local `/api/test-message` proxy.

**Non-Goals:**
*   Adding full markdown/rich-text editor support (basic text input via standard textarea is fully sufficient for raw WhatsApp SMS style testing).
*   Storing unsent drafts persistently across logins.

## Decisions

### 1. Unified Svelte 5 Rune State Management
*   **Choice**: Define `testMessageBody = $state('')` inside `src/routes/dashboard/+page.svelte` to bind to the textarea value directly.
*   **Alternatives Considered**: Defining a separate sub-component vs keeping state inline in the dashboard. Since the dashboard state has `recipientPhone` and `testing` as local state runes already, inline state minimizes prop drilling and matches the current structure perfectly.

### 2. Tabbed or Expandable Form UI Layout
*   **Choice**: Show/hide the freeform textarea input dynamically depending on the message type selection. When the user clicks "Send Free-Form Text", standard Svelte 5 template logic (`{#if ...}`) will smoothly transition the UI to render the textarea box.
*   **Rationale**: This keeps the UI extremely clean, premium, and focused without overwhelming developers with unnecessary fields.

## Risks / Trade-offs

*   **Risk**: Text length exceeding Meta's standard text limit guidelines.
    *   *Mitigation*: Implement a visual length warning indicating optimal sizing (e.g., standard text constraints) and show real-time characters count indicator.
