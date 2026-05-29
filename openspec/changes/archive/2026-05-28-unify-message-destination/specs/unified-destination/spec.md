## ADDED Requirements

### Requirement: Polymorphic Destination Field
The API proxy route and dashboard playground UI SHALL support inputting and dispatching message payloads to a single unified polymorphic field `to`.

#### Scenario: Unified target input binding
- **WHEN** user type a phone number or business scope ID in the unified recipient target text field
- **THEN** the input value is bound to the `recipientTarget` state rune successfully

### Requirement: Uniform Proxy Mapping
The SvelteKit `/api/test-message` proxy handler SHALL map the dynamic destination parameter directly into the single `to` attribute slot of the flat SendMessageBody schema payload.

#### Scenario: Proxy forwards unified field
- **WHEN** client POSTs a test message request containing `recipient_target`
- **THEN** the server proxy maps it to `to` inside the flat envelope and dispatches it successfully to the Go backend
