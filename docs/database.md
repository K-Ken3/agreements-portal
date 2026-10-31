# Database

Prisma models currently cover:

- `users`: normalized unique email, legal name, password hash, account status, locale.
- `sessions`: keyed token hash, expiry, user foreign key, and expiry indexes.
- `agreements`: unique public reference, issuer foreign key, draft metadata, status, currency, dates, and query indexes.
- `agreement_versions`: immutable-at-the-workflow-level canonical JSON snapshot, canonicalization version, SHA-256 hash, and unique per-agreement version number.
- `agreement_events`: minimized event payload and previous/current event hashes.

Draft creation inserts the agreement, version 1 and initial event in one Prisma transaction. No finalized content is updated or deleted by the current API. The schema deliberately excludes identity-number and phone-verification records until collection is justified and the required encryption, retention, and provider design are approved.

Run `npm run db:migrate` for local development and `npm run db:deploy` for deployment. The initial migration is committed under `prisma/migrations`; review any new migration before applying it. Back up the database, test restoration, and establish retention/legal-hold policy before real user data is accepted.
