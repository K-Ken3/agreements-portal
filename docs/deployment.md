# Deployment

## Local

Use the PowerShell commands in the repository README. The Docker Compose file starts PostgreSQL 16 and Redis 7. Only PostgreSQL is required for the implemented slice.

## Production checklist

1. Select the hosting, database, backup, logging, and object-storage regions only after reviewing Rwanda data protection and cross-border transfer requirements with qualified professionals.
2. Set `DATABASE_URL`, `SESSION_SECRET`, and `APP_URL` using a managed secret store. Use a unique random session secret and HTTPS.
3. Provision PostgreSQL with encrypted storage, least-privilege credentials, point-in-time recovery, monitoring, and tested restoration.
4. Run reviewed Prisma migrations with `npm run db:deploy`.
5. Build with `npm run build`; run `npm run typecheck` and `npm test` in CI.
6. Configure appropriate proxy limits, security monitoring, alerting, and production rate limiting before exposing account endpoints.
7. Do not enable external delivery, identity, or signature services without reviewed credentials and legal/operational approval.

No hosting platform, region, provider credentials, or deployment automation is selected in this repository.
