## Context

Developers need to view their WhatsApp phone number and easily copy the entire integration configuration JSON to their clipboard directly from the dashboard setting interface. The data is already loaded in SvelteKit page load data (`data.tenant`).

## Goals / Non-Goals

**Goals:**
*   Render the active WhatsApp phone number (`phone_number`) next to the WABA ID in the WhatsApp Connection section when the status is `'ACTIVE'`.
*   Provide a "Copy Integration Config" button in the Developer Settings card.
*   Enforce disabled button state with a custom browser tooltip/title (`"Connect your WhatsApp number first"`) if the connection status is not `'ACTIVE'`.
*   Assemble a customized configuration JSON dynamically from the loaded tenant properties and write it to the clipboard, displaying visual feedback for 2 seconds.

**Non-Goals:**
*   Adding a server-side route or DB column changes (the field is assumed to be queried automatically via `select('*')`).

## Decisions

### 1. Clipboard Copy Action Handler
*   **Choice**: Implement a client-side click handler function `copyIntegrationConfig()` in Svelte that formats the JSON block and calls `navigator.clipboard.writeText(...)`.
*   **Rationale**: Simplest and most reliable approach, conforming to Svelte 5 state reactivity with visual indicator tracking.

### 2. Button State and Styling
*   **Choice**: Render the button in the Developer Settings card below the Webhook Secret row. Set its style to match the existing Copy buttons (e.g., standard padding, borders, background, hover states), and use Svelte 5 conditional classes for the disabled and tooltip state.
*   **Rationale**: Maintains UI consistency and provides instant visual context.

## Risks / Trade-offs

*   **Risk**: Clipboard API blocked on non-secure origins.
    *   *Mitigation*: Ensure fallback UI behavior or standard browser exceptions are handled; however, the dashboard is hosted on HTTPS (covered by Cloudflare Universal SSL) so it is secure.
