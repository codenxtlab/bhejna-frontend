## ADDED Requirements

### Requirement: Display WhatsApp Phone Number

The dashboard SHALL display the user's WhatsApp phone number next to the WABA ID in the WhatsApp Connection section.

#### Scenario: Display phone number when connected

- **WHEN** the dashboard page loads and the tenant WhatsApp status is ACTIVE
- **THEN** the page displays the WABA ID alongside the tenant's WhatsApp phone number

### Requirement: Copy Integration Config Button Status

The dashboard page SHALL render a "Copy Integration Config" button that is enabled only when the WhatsApp status is active, and disabled with a custom connectivity warning tooltip otherwise.

#### Scenario: Button is disabled when connection is inactive

- **WHEN** the tenant's WhatsApp status is not ACTIVE
- **THEN** the Copy Integration Config button is disabled and displays a tooltip title "Connect your WhatsApp number first"

#### Scenario: Button is enabled when connection is active

- **WHEN** the tenant's WhatsApp status is ACTIVE
- **THEN** the Copy Integration Config button is enabled and fully clickable

### Requirement: Copy Config Payload Clipboard Writing

When the enabled Copy Integration Config button is clicked, the system SHALL construct a JSON payload with key integration parameters, copy it to the clipboard, and display temporary completion feedback for exactly 2 seconds.

#### Scenario: Successful copy integration configuration

- **WHEN** the user clicks the Copy Integration Config button
- **THEN** the system copies the populated integration JSON block to the clipboard and changes the button text to "Copied! ✓" for 2 seconds
