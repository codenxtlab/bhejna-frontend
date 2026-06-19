# freeform-messaging Specification

## Purpose

TBD - created by archiving change add-freeform-text-ui. Update Purpose after archive.

## Requirements

### Requirement: Interactive Playground Textarea for Custom Messages

The dashboard playground SHALL display a visual multi-line text input field (textarea) when the developer selects the "Send Free-Form Text" option.

#### Scenario: Textarea visibility

- **WHEN** user selects the "Send Free-Form Text" message format button
- **THEN** a responsive multi-line textarea is rendered on the dashboard card

### Requirement: Dynamic Payload Proxying

The frontend playground proxy SHALL dynamically forward the custom text body input by the developer to the Go backend system under the "text" structure envelope.

#### Scenario: Successful dispatch of custom text

- **WHEN** developer types "Hello World from Playground" and triggers "Send Free-Form Text"
- **THEN** the local endpoint parses the custom body and successfully queues the message to the Go queue handler
