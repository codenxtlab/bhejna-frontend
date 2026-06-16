## Why

Developers utilizing the Bhejna gateway need an easy way to export and copy their active integration settings payload directly from the browser dashboard settings interface. Additionally, they need to view the specific WhatsApp phone number associated with their tenant record.

## What Changes

*   **Display Phone Number**: Update the WhatsApp Connection card status component on the dashboard settings page to display the user's active WhatsApp phone number (`phone_number`).
*   **Copy Integration Configuration Utility**: Implement a "Copy Integration Config" button in the Developer Settings section. Clicking this button dynamically formats the current loaded tenant state as a JSON block containing key connection metadata and copies it directly to the clipboard with temporary feedback ("Copied! ✓").

## Capabilities

### New Capabilities

- `copy-integration-config`: Exposes a frontend utility button to format and copy the tenant configuration payload to the clipboard in JSON format.

### Modified Capabilities

<!-- None -->

## Impact

*   **Affected Code**:
    *   `src/routes/dashboard/+page.svelte` (renders the phone number, adds the Copy Integration Config button, manages tooltip and clipboard copy state).
*   **APIs**:
    *   None (pure client-side change using already-fetched tenant record data).
