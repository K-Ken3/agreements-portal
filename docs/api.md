# API

All implemented endpoints use `/api/v1`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Database health check |
| POST | `/auth/register` | Create account and session |
| POST | `/auth/login` | Authenticate and create session |
| POST | `/auth/logout` | Revoke current session |
| GET | `/users/me` | Return the authenticated user's safe profile |
| GET | `/agreements` | List the authenticated issuer's agreements |
| POST | `/agreements` | Create a private draft, version and audit event |
| GET | `/agreements/:id` | Read an issuer-owned agreement and latest draft version |

JSON request bodies are validated with Zod. State-changing browser routes reject a mismatched `Origin` header. Authentication failures use generic messages. Agreement IDs are always scoped to the authenticated user; the public reference is not an access token.

Not implemented yet: OpenAPI generation, invitation endpoints, recipient access, status-transition APIs, review/signing APIs, document downloads, verifier, admin routes, distributed rate limiting, and notifications.
