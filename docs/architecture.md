# Architecture

## Current implementation

The project is a Next.js App Router application with TypeScript. API route handlers under `/api/v1` provide the server boundary; PostgreSQL persistence is managed with Prisma. The UI uses responsive CSS and shared page styles. Password hashing uses Node.js scrypt; sessions are opaque random tokens stored only as keyed hashes in the database and delivered through HttpOnly, SameSite cookies.

The first vertical slice is intentionally modular:

- `src/lib/auth.ts`: password and session primitives and same-origin mutation check.
- `src/lib/agreements.ts`: canonical JSON serialization, SHA-256 content hashes, event hashes, and state transition policy.
- `src/app/api/v1`: health, auth, user, and agreement APIs.
- `prisma/schema.prisma`: PostgreSQL data model.

## Initial workflow

Registration creates an active user and a session. An authenticated issuer can save a draft. Draft creation writes the agreement, version 1 canonical JSON snapshot, content hash, and first hash-chained event in one database transaction. Agreement lookup is scoped to the issuer's user ID on the server.

The current interface does not allow sending or signing drafts. Agreement lifecycle states are persisted as a database enum; frontend input cannot set status.

## Planned boundaries

As the product grows, retain a modular monolith and add separate domain modules for invitation/review/signature workflows, a document engine, notifications, and least-privilege administration. Integrate external providers behind interfaces and keep them disabled until credentials, operational confirmation, and legal authorization are available.

## Decisions and constraints

- PostgreSQL is the source of truth; no local in-memory persistence fallback is used.
- Redis is provisioned in the development compose file but not yet connected.
- Document hash canonicalization is versioned as `json-c14n-v1`.
- The hash chain is tamper-evident, not proof against privileged database/infrastructure modification.
- Application-level encryption for sensitive identity fields is not implemented because the first slice does not collect identity numbers.
