# AgreeIt

AgreeIt is a Rwanda-first agreement workflow application. This repository contains the foundation and first working vertical slice: account registration/login, PostgreSQL-backed sessions, private draft creation, versioned draft content, and an authenticated agreement list/detail view.

> **MVP boundary:** This is not a production-ready signing service. Invitations, phone OTP, recipient participation, amendments, signatures, PDF generation, public verification, admin tools, and notification delivery are not implemented. Do not enter real national identity data or treat a draft as signed or legally approved.

## Requirements

- Node.js 20.19 or later
- npm
- Docker Desktop (or a local PostgreSQL 16 instance)

Docker was not available in the implementation environment. Redis is included for planned background work but is not used by the current application.

## Run locally

In PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `SESSION_SECRET` in `.env` to a random value of at least 32 characters. For example:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Start the local services and install dependencies:

```powershell
docker compose up -d postgres redis
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account and save a private agreement draft from the dashboard.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

The health endpoint is `GET /api/v1/health`. It reports database availability without exposing connection details.

CI in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) applies the committed migration to PostgreSQL 16, then runs lint, type checking, tests, and a production build.

## Configuration

See [.env.example](./.env.example). Production must use a managed secret store, HTTPS, a managed PostgreSQL deployment, reviewed data-location/subprocessor arrangements, backups, and a production-ready rate limiter. No SMS, email, identity, storage, or signing-provider credentials are needed or included in this MVP.

## Architecture and readiness

- [Architecture](./docs/architecture.md)
- [Database](./docs/database.md)
- [API](./docs/api.md)
- [Security](./docs/security.md)
- [Privacy and legal readiness](./docs/privacy-and-legal-readiness.md)
- [Deployment](./docs/deployment.md)
- [User flows](./docs/user-flows.md)
