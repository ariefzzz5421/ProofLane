# QuestKernel architecture

The application is a modular monolith. The browser never writes application or verification state directly: route handlers validate a wallet or administrator session, then call the database and verification modules. Tenant data tables carry `organization_id`; privileged queries enforce membership or a scoped API key before reading or writing. Public campaign responses select safe fields explicitly.

## Registration invariant

`registerApplication` starts a libSQL write transaction, checks campaign state, existing wallet registration, required verified tasks, and conditionally increments `accepted_count` only while it is below `max_applicants`. It inserts the application, usage counter, audit event, and webhook outbox entries in that same transaction. Any error rolls back the increment. SQLite write-lock contention is retried a bounded number of times. The unique index on `(campaign_id, chain_id, address)` is a second barrier against duplicates.

## Wallet adapters

The MVP uses EIP-4361 SIWE and lowercased EVM addresses. A Solana module should add an `auth_namespace` and chain reference to wallet identities, challenges, and applications in a migration, then implement a separate signed-message verifier. It must preserve the same one-time nonce, origin, expiry, session, and unique campaign-wallet invariants. Never interpret an EVM chain ID as a Solana chain identifier. No Solana authentication is currently exposed.

## External verification

RPC calls are server-only and must match the configured chain. Discord verification uses an OAuth identity plus a bot membership query for the configured guild; the returned user ID is stored as evidence, while OAuth access tokens are discarded. X is Unsupported until appropriate official API access exists. Custom decisions require a scoped project backend API key. Manual evidence requires an administrator decision. All states are persisted.

## Delivery and persistence

Webhook deliveries are an at-least-once outbox. An authenticated scheduler calls the delivery route; each event has a stable delivery ID, HMAC timestamp/signature, response log, and bounded exponential retry. Receivers must deduplicate delivery IDs. Immutable snapshot rows store the exact CSV, checksum, rules version, and creation time. Remote Turso credentials are required for production persistence; no local file database is allowed on Vercel.

## Current boundaries

Snapshots only record eligibility. They do not distribute tokens or guarantee a payout. Plan limits and usage are stored, but billing is not connected. Deletion requests require an administrator-managed database process, including review of already exported snapshots and external copies. This is not yet a self-service privacy workflow.
