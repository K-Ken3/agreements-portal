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
| PATCH | `/agreements/:id` | Create a new immutable draft version |
| POST | `/agreements/:id/invite` | Lock the current version and email the counterparty invitation/code |
| POST | `/agreements/:id/signatures` | Record the authenticated issuer's typed signature |
| POST | `/signatures/verify` | Verify a counterparty invitation email code |
| POST | `/signatures/resend` | Resend a code within the invitation's limits |
| GET | `/signatures/session?token=...` | Read the verified counterparty's locked agreement |
| POST | `/signatures/session` | Record the verified counterparty's typed signature |

JSON request bodies are validated with Zod. State-changing browser routes reject a mismatched `Origin` header. Authentication failures use generic messages. Agreement IDs are always scoped to the authenticated user; the public reference is not an access token.

Invitation and recipient signing routes use random, hashed tokens and short-lived email codes. Configure Resend before sending invitations. The typed in-app signature workflow is not a qualified signature provider and does not guarantee legal enforceability.

Not implemented yet: OpenAPI generation, document downloads, public verifier, admin routes, distributed rate limiting, and post-invitation amendments.
