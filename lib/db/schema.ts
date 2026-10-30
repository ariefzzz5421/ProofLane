import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const time = (name: string) => integer(name, { mode: "timestamp_ms" });
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: time("created_at").notNull(),
});
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  planId: text("plan_id").notNull().default("free"),
  createdAt: time("created_at").notNull(),
});
export const organizationMembers = sqliteTable(
  "organization_members",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["owner", "admin", "viewer"] }).notNull(),
    createdAt: time("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.userId] }),
    index("members_user_idx").on(t.userId),
  ],
);
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    logoUrl: text("logo_url"),
    projectUrl: text("project_url"),
    chainId: integer("chain_id").notNull(),
    startsAt: time("starts_at"),
    endsAt: time("ends_at"),
    maxApplicants: integer("max_applicants").notNull(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    status: text("status", {
      enum: ["draft", "scheduled", "live", "paused", "closed"],
    })
      .notNull()
      .default("draft"),
    requirements: text("requirements").notNull().default(""),
    reward: text("reward").notNull().default(""),
    termsUrl: text("terms_url"),
    privacyUrl: text("privacy_url"),
    rulesVersion: integer("rules_version").notNull().default(1),
    duplicateAttempts: integer("duplicate_attempts").notNull().default(0),
    createdAt: time("created_at").notNull(),
    updatedAt: time("updated_at").notNull(),
  },
  (t) => [index("campaigns_org_idx").on(t.organizationId)],
);
export const campaignTasks = sqliteTable(
  "campaign_tasks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: text("type", {
      enum: [
        "wallet",
        "token",
        "nft",
        "transaction",
        "discord",
        "x",
        "custom",
        "manual",
      ],
    }).notNull(),
    required: integer("required", { mode: "boolean" }).notNull().default(true),
    config: text("config").notNull().default("{}"),
    createdAt: time("created_at").notNull(),
  },
  (t) => [index("tasks_campaign_idx").on(t.campaignId)],
);
export const walletIdentities = sqliteTable(
  "wallet_identities",
  {
    id: text("id").primaryKey(),
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    createdAt: time("created_at").notNull(),
  },
  (t) => [uniqueIndex("wallet_chain_address_uq").on(t.chainId, t.address)],
);
export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    walletIdentityId: text("wallet_identity_id")
      .notNull()
      .references(() => walletIdentities.id),
    chainId: integer("chain_id").notNull(),
    address: text("address").notNull(),
    eligibility: text("eligibility", {
      enum: ["eligible", "pending", "rejected"],
    })
      .notNull()
      .default("eligible"),
    acceptedAt: time("accepted_at").notNull(),
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    uniqueIndex("application_wallet_uq").on(t.campaignId, t.chainId, t.address),
    uniqueIndex("application_idempotency_uq").on(
      t.campaignId,
      t.idempotencyKey,
    ),
    index("applications_org_idx").on(t.organizationId),
  ],
);
export const taskVerifications = sqliteTable(
  "task_verifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    taskId: text("task_id")
      .notNull()
      .references(() => campaignTasks.id),
    walletIdentityId: text("wallet_identity_id")
      .notNull()
      .references(() => walletIdentities.id),
    status: text("status", {
      enum: ["pending", "verified", "rejected", "unsupported"],
    }).notNull(),
    detail: text("detail").notNull().default(""),
    verifiedAt: time("verified_at"),
    createdAt: time("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("verification_task_wallet_uq").on(t.taskId, t.walletIdentityId),
    index("verifications_campaign_idx").on(t.campaignId),
  ],
);
export const verificationEvidence = sqliteTable("verification_evidence", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  verificationId: text("verification_id")
    .notNull()
    .references(() => taskVerifications.id),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  createdAt: time("created_at").notNull(),
});
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    secretHash: text("secret_hash").notNull(),
    scopes: text("scopes").notNull(),
    createdAt: time("created_at").notNull(),
    revokedAt: time("revoked_at"),
  },
  (t) => [index("api_keys_org_idx").on(t.organizationId)],
);
export const webhookEndpoints = sqliteTable("webhook_endpoints", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  url: text("url").notNull(),
  secretHash: text("secret_hash").notNull(),
  secretEncrypted: text("secret_encrypted").notNull(),
  events: text("events").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: time("created_at").notNull(),
});
export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  endpointId: text("endpoint_id")
    .notNull()
    .references(() => webhookEndpoints.id),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status").notNull().default("pending"),
  nextAttemptAt: time("next_attempt_at").notNull(),
  lastResponse: text("last_response"),
  createdAt: time("created_at").notNull(),
});
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id").notNull(),
    detail: text("detail").notNull().default("{}"),
    createdAt: time("created_at").notNull(),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)],
);
export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxCampaigns: integer("max_campaigns").notNull(),
  monthlyApplicants: integer("monthly_applicants").notNull(),
  monthlyVerifications: integer("monthly_verifications").notNull(),
  teamSeats: integer("team_seats").notNull(),
  whiteLabel: integer("white_label", { mode: "boolean" })
    .notNull()
    .default(false),
});
export const usageCounters = sqliteTable(
  "usage_counters",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    month: text("month").notNull(),
    applicants: integer("applicants").notNull().default(0),
    verifications: integer("verifications").notNull().default(0),
    apiCalls: integer("api_calls").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.month] })],
);
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  kind: text("kind", { enum: ["admin", "wallet"] }).notNull(),
  userId: text("user_id"),
  walletIdentityId: text("wallet_identity_id"),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull(),
});
export const authChallenges = sqliteTable("auth_challenges", {
  id: text("id").primaryKey(),
  nonceHash: text("nonce_hash").notNull().unique(),
  address: text("address").notNull(),
  chainId: integer("chain_id").notNull(),
  domain: text("domain").notNull(),
  expiresAt: time("expires_at").notNull(),
  consumedAt: time("consumed_at"),
  createdAt: time("created_at").notNull(),
});
export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  rulesVersion: integer("rules_version").notNull(),
  checksum: text("checksum").notNull(),
  rowCount: integer("row_count").notNull(),
  csv: text("csv").notNull(),
  createdAt: time("created_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: time("reset_at").notNull(),
});
