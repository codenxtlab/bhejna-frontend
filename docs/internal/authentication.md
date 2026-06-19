# Internal Authentication

This section covers authentication for internal Bhejna microservices and management operations.

## Bearer JWT

Internal requests must include a Bearer JWT in the `Authorization` header.

## Service-to-Service

Services identify themselves using specific claims in the JWT, allowing for fine-grained role-based access control (RBAC) within the cluster.
