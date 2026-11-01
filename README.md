# AgreeIt

AgreeIt is a Rwanda-first agreement workflow application. The app supports account registration/login, private agreement drafts, versioned terms, email invitations with email-code verification or issuer-created manual bearer links, and typed in-app signatures from both parties against one locked agreement version.

> **MVP boundary:** In-app typed signatures and email verification are not a qualified digital signature, independent identity proof, or guarantee of legal enforceability. Obtain qualified Rwanda legal/privacy review before production use. PDF generation, public verification, admin tools, amendments, and phone/identity verification are not implemented.

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

Open [http://localhost:3000](http://localhost:3000). Create an account, prepare an agreement with the other party's email, and review it. You can use a manual invitation link without email delivery; anyone holding that link can access the agreement, and it does not verify email ownership. Configure `RESEND_API_KEY` and a sender address on a Resend-verified domain in `EMAIL_FROM` to send email invitations.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

The health endpoint is `GET /api/v1/health`. It reports database availability without exposing connection details.

CI in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) applies the committed migration to PostgreSQL 16, then runs lint, type checking, tests, and a production build.

## Deploy to Vercel

1. Import this repository in Vercel; the framework preset is detected automatically.
2. Add these environment variables for Production, Preview, and Development:
   - `DATABASE_URL`: a hosted PostgreSQL connection string. Prefer the provider's pooled connection URL for serverless use.
   - `DIRECT_URL`: the direct/session connection string used by migrations.
   - `SESSION_SECRET`: a random value of at least 32 characters.
   - `APP_URL`: the deployed URL, for example `https://your-project.vercel.app`.
   - `RESEND_API_KEY`: Resend API key for counterparty invitations and verification codes.
   - `EMAIL_FROM`: verified sender email address, for example `agreements@example.com`.
3. Apply the database migration once against the production database:

   ```powershell
   $env:DATABASE_URL="<production pooled connection string>"
   $env:DIRECT_URL="<production direct connection string>"
   npx prisma migrate deploy
   ```

   This applies the agreement-signing and manual-invitation schema changes.

4. Deploy. `npm run postinstall` generates the Prisma client during the Vercel build.

The database must be reachable from Vercel and allow TLS. Do not commit `.env` or production credentials.

### Supabase

Use Supabase's connection details from **Project Settings → Database**:

- `DATABASE_URL`: transaction pooler, port `6543`, for example
  `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
- `DIRECT_URL`: session pooler, port `5432`, for example
  `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

URL-encode special characters in the password. Keep `sslmode=require` if your connection string does not already include it.

## Configuration

See [.env.example](./.env.example). Production must use a managed secret store, HTTPS, a managed PostgreSQL deployment, reviewed data-location/subprocessor arrangements, backups, and a production-ready rate limiter. Email delivery is provided through Resend; do not commit provider credentials. No SMS, government identity, qualified digital-signature provider, or file-storage credentials are included.

## Architecture and readiness

- [Architecture](./docs/architecture.md)
- [Database](./docs/database.md)
- [API](./docs/api.md)
- [Security](./docs/security.md)
- [Privacy and legal readiness](./docs/privacy-and-legal-readiness.md)
- [Deployment](./docs/deployment.md)
- [User flows](./docs/user-flows.md)
