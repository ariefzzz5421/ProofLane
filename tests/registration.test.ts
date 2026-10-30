import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";

const folder = mkdtempSync(join(tmpdir(), "questkernel-test-"));
process.env.DATABASE_URL = `file:${join(folder, "test.db").replaceAll("\\", "/")}`;
const { db, client } = await import("../lib/db");
const {
  campaigns,
  organizations,
  walletIdentities,
  campaignTasks,
  taskVerifications,
} = await import("../lib/db/schema");
const { registerApplication } = await import("../lib/registration");
const { checkTask } = await import("../lib/verification");
const { publicWebhookUrl } = await import("../lib/webhooks");
const { createClient } = await import("@libsql/client");
const when = () => new Date();
async function campaign(id: string, maxApplicants: number) {
  await db.insert(campaigns).values({
    id,
    organizationId: "org-test",
    name: id,
    slug: id,
    chainId: 1,
    maxApplicants,
    status: "live",
    createdAt: when(),
    updatedAt: when(),
  });
}
async function wallet(id: string, address: string) {
  await db
    .insert(walletIdentities)
    .values({ id, chainId: 1, address, createdAt: when() });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.execute("PRAGMA journal_mode=WAL");
  await db.insert(organizations).values({
    id: "org-test",
    name: "Test",
    slug: "test-org",
    createdAt: when(),
  });
});
describe("server-authoritative registration", () => {
  it("rejects loopback webhook destinations before any delivery", async () => {
    await expect(publicWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow(
      "public HTTPS hostname",
    );
  });
  it("commits a valid application and returns an idempotent receipt", async () => {
    await campaign("campaign-valid", 2);
    await wallet("wallet-1", "0x0000000000000000000000000000000000000001");
    const input = {
      campaignId: "campaign-valid",
      walletId: "wallet-1",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
    };
    const first = await registerApplication(input);
    expect(first.ok).toBe(true);
    const second = await registerApplication(input);
    expect(second).toMatchObject({ ok: true, duplicate: true });
    const rows = await client.execute({
      sql: "SELECT id FROM applications WHERE campaign_id=?",
      args: ["campaign-valid"],
    });
    expect(rows.rows).toHaveLength(1);
    const c = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, "campaign-valid"),
    });
    expect(c?.acceptedCount).toBe(1);
  });
  it("rejects unverified required tasks even if frontend says verified", async () => {
    await campaign("campaign-task", 2);
    await wallet("wallet-2", "0x0000000000000000000000000000000000000002");
    await db.insert(campaignTasks).values({
      id: "task-1",
      organizationId: "org-test",
      campaignId: "campaign-task",
      title: "Signature",
      type: "wallet",
      required: true,
      config: "{}",
      createdAt: when(),
    });
    const input = {
      campaignId: "campaign-task",
      walletId: "wallet-2",
      address: "0x0000000000000000000000000000000000000002",
      chainId: 1,
    };
    expect(await registerApplication(input)).toMatchObject({
      ok: false,
      code: "TASKS_REQUIRED",
    });
    await db.insert(taskVerifications).values({
      id: "verification-1",
      organizationId: "org-test",
      campaignId: "campaign-task",
      taskId: "task-1",
      walletIdentityId: "wallet-2",
      status: "verified",
      createdAt: when(),
    });
    expect((await registerApplication(input)).ok).toBe(true);
  });
  it("allows exactly one of two contenders for the final slot at 4,999", async () => {
    await campaign("campaign-race", 5000);
    await client.execute({
      sql: `WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x<4999) INSERT INTO wallet_identities (id,chain_id,address,created_at) SELECT printf('bulk-w%06d',x),1,printf('0x%040x',x+100000),? FROM seq`,
      args: [Date.now()],
    });
    await client.execute({
      sql: `WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x<4999) INSERT INTO applications (id,organization_id,campaign_id,wallet_identity_id,chain_id,address,eligibility,accepted_at) SELECT printf('bulk-a%06d',x),'org-test','campaign-race',printf('bulk-w%06d',x),1,printf('0x%040x',x+100000),'eligible',? FROM seq`,
      args: [Date.now()],
    });
    await client.execute({
      sql: "UPDATE campaigns SET accepted_count=4999 WHERE id=?",
      args: ["campaign-race"],
    });
    await wallet("race-a", "0x000000000000000000000000000000000000ffff");
    await wallet("race-b", "0x000000000000000000000000000000000000fffe");
    const results = await Promise.all([
      registerApplication({
        campaignId: "campaign-race",
        walletId: "race-a",
        address: "0x000000000000000000000000000000000000ffff",
        chainId: 1,
      }),
      registerApplication({
        campaignId: "campaign-race",
        walletId: "race-b",
        address: "0x000000000000000000000000000000000000fffe",
        chainId: 1,
      }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ code: "FULL" });
    const count = await client.execute({
      sql: "SELECT count(*) n FROM applications WHERE campaign_id=?",
      args: ["campaign-race"],
    });
    expect(Number(count.rows[0].n)).toBe(5000);
    const c = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, "campaign-race"),
    });
    expect(c?.acceptedCount).toBe(5000);
  });
  it("survives a new database connection and reports missing RPC as unsupported", async () => {
    await campaign("campaign-rpc", 5);
    await db.insert(campaignTasks).values({
      id: "task-rpc",
      organizationId: "org-test",
      campaignId: "campaign-rpc",
      title: "Hold token",
      type: "token",
      required: true,
      config: JSON.stringify({
        chainId: 99999,
        contract: "0x0000000000000000000000000000000000000001",
      }),
      createdAt: when(),
    });
    const task = await db.query.campaignTasks.findFirst({
      where: eq(campaignTasks.id, "task-rpc"),
    });
    expect(task).toBeDefined();
    expect(
      await checkTask(task!, "0x0000000000000000000000000000000000000001"),
    ).toMatchObject({ status: "unsupported" });
    await db.insert(campaignTasks).values({
      id: "task-discord",
      organizationId: "org-test",
      campaignId: "campaign-rpc",
      title: "Join guild",
      type: "discord",
      required: false,
      config: JSON.stringify({ guildId: "123456789012345678" }),
      createdAt: when(),
    });
    const discord = await db.query.campaignTasks.findFirst({
      where: eq(campaignTasks.id, "task-discord"),
    });
    expect(
      await checkTask(discord!, "0x0000000000000000000000000000000000000001"),
    ).toMatchObject({ status: "unsupported" });
    const second = createClient({ url: process.env.DATABASE_URL! });
    const rows = await second.execute({
      sql: "SELECT id FROM applications WHERE campaign_id=?",
      args: ["campaign-valid"],
    });
    expect(rows.rows).toHaveLength(1);
    await second.close();
  });
});
