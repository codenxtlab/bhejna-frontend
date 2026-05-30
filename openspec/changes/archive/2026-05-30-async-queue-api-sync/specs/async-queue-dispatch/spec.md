## ADDED Requirements

### Requirement: Async Response Representation
The playground UI SHALL gracefully parse the HTTP 202 async response envelope and extract the transaction job ID.

#### Scenario: Playground extracts job_id
- **WHEN** the user sends a test message successfully
- **THEN** the playground card extracts `resData.id` or `resData.job_id` and displays it to the developer

### Requirement: Asynchronous User Notifications
The playground UI SHALL indicate that the message has been queued for delivery instead of displaying instant delivery confirmations.

#### Scenario: Display queued status message
- **WHEN** the local proxy returns the successful enqueued status body
- **THEN** the dashboard renders a visual feedback box reading "Message Queued: <job_id>"
