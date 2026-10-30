# QuestKernel

Developer-first airdrop registration infrastructure. This Next.js MVP uses SQLite locally and Turso/libSQL in production. Registrations, task states, analytics, and snapshots come from the database.

## Local setup

Requires Node.js 20.9+ and npm. Copy `.env.example` to `.env` and set `DATABASE_URL=file:local.db` and `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Visit `/c/demo-builder-registration` for a real database-backed demo campaign. Create a dashboard account at `/register`. To grant an owner access to the seeded demo organization, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (at least 12 characters) before `npm run db:seed`. No default password is shipped.

## Production deployment

Set `DATABASE_URL=libsql://...`, `DATABASE_AUTH_TOKEN`, and the exact public `NEXT_PUBLIC_APP_URL`. Apply migrations to the remote database before deployment with `npm run db:migrate`. Use the same persistent Turso database across deployments. A Vercel build fails closed if it sees a local file database. Configure `RPC_URL_<CHAIN_ID>` server-side for chain tasks, `WEBHOOK_ENCRYPTION_KEY` (32 random bytes encoded as 64 hex characters) for webhooks, and `CRON_SECRET` for delivery retries. Point a scheduler at `POST /api/v1/webhooks/deliver` with a Bearer token. Secrets stay server-side.

## Architecture

- `lib/db/schema.ts`: Drizzle schema with explicit tenant IDs, foreign keys and uniqueness constraints.
- `lib/registration.ts`: write transaction for required task checks, conditional cap increment, accepted application, usage and audit/outbox records.
- `lib/verification.ts`: server-owned task verification. Wallet, balance and transaction checks are supported; missing integrations fail visibly.
- `app/api/v1`: participant, admin and scoped project backend endpoints.
- `sdk`: small typed server SDK and Next.js example.
- `drizzle`: committed SQL migrations; do not use schema push in production.

Wallet sessions use httpOnly same-site cookies. SIWE challenges are bound to domain, chain, address and a one-time nonce. Project backend API keys are hashed and scoped. Webhook secrets are encrypted at rest. The database, rather than browser storage, is the source of truth.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright requires browser installation (`npx playwright install chromium`). Tests use an isolated temporary SQLite file.

## MVP boundaries

Discord guild membership can be verified with an authorized OAuth application, bot token, and task guild ID. Register `https://YOUR_DOMAIN/api/v1/discord/callback` as the Discord OAuth redirect and configure the Discord environment variables. Without credentials it reports Unsupported. X tasks report Unsupported until official API permissions are available. Manual evidence requires administrator review. Billing definitions and usage counters exist, but payment processing and plan upgrades do not. Self-service deletion is not yet available; administrators must process deletion requests at the database level. No token creation, custody or distribution is included.
