# Internal API Reference

This documentation covers the service-to-service communication between the Bhejna Frontend (Control Plane) and the Bhejna Go Backend (Data Plane). These endpoints are protected by `INTERNAL_SECRET` and are not intended for public use.

> [!WARNING]
> These endpoints bypass standard tenant-level RLS and have full administrative access to the edge database. Always use the `InternalAuth` (Bearer JWT) scheme.

## Tenant Provisioning

When a user connects a WhatsApp account on the dashboard, the frontend provisions the tenant in the central database and then synchronizes the configuration to the edge.

### Sync Tenant

- **OperationId**: `syncTenant`
- **Method**: `POST`
- **Path**: `/v1/internal/tenant`

## Service Control

Manage the operational state of tenants on the edge.

### Pause Delivery

- **OperationId**: `pauseTenant`
- **Method**: `PUT`
- **Path**: `/v1/internal/tenants/{id}/pause`

## Technical Reference

### Webhook Schema Generation

Internal utility used to ensure type-safety for the asynchronous webhook processing engine.

- **OperationId**: `forceGenerateWebhookType`
- **Method**: `POST`
- **Path**: `/v1/internal/webhook-schema`
