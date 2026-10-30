import { client } from "./db";
import { id, monthKey } from "./core";

export type RegistrationResult =
  | { ok: true; applicationId: string; duplicate: boolean }
  | {
      ok: false;
      code: "NOT_LIVE" | "FULL" | "TASKS_REQUIRED" | "IDEMPOTENCY_CONFLICT";
      message: string;
    };

type RegistrationInput = {
  campaignId: string;
  walletId: string;
  address: string;
  chainId: number;
  idempotencyKey?: string;
};
export async function registerApplication(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await registerOnce(input);
    } catch (error) {
      if (
        !(error instanceof Error && error.message.includes("SQLITE_BUSY")) ||
        attempt === 7
      )
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  throw new Error("Registration retry exhausted.");
}
async function registerOnce(
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const tx = await client.transaction("write");
  try {
    const campaignRows = await tx.execute({
      sql: "SELECT id, organization_id, status, starts_at, ends_at, max_applicants, accepted_count, chain_id FROM campaigns WHERE id=?",
      args: [input.campaignId],
    });
    const c = campaignRows.rows[0];
    if (!c || Number(c.chain_id) !== input.chainId) {
      await tx.rollback();
      return {
        ok: false,
        code: "NOT_LIVE",
        message: "Campaign is not accepting applications.",
      };
    }
    const existing = await tx.execute({
      sql: "SELECT id FROM applications WHERE campaign_id=? AND chain_id=? AND address=?",
      args: [input.campaignId, input.chainId, input.address],
    });
    if (existing.rows[0]) {
      await tx.execute({
        sql: "UPDATE campaigns SET duplicate_attempts=duplicate_attempts+1 WHERE id=?",
        args: [input.campaignId],
      });
      await tx.commit();
      return {
        ok: true,
        applicationId: String(existing.rows[0].id),
        duplicate: true,
      };
    }
    if (
      c.status !== "live" ||
      (c.starts_at && Number(c.starts_at) > Date.now()) ||
      (c.ends_at && Number(c.ends_at) <= Date.now())
    ) {
      await tx.rollback();
      return {
        ok: false,
        code: "NOT_LIVE",
        message: "Campaign is not accepting applications.",
      };
    }
    if (input.idempotencyKey) {
      const prior = await tx.execute({
        sql: "SELECT id FROM applications WHERE campaign_id=? AND idempotency_key=?",
        args: [input.campaignId, input.idempotencyKey],
      });
      if (prior.rows[0]) {
        await tx.rollback();
        return {
          ok: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key belongs to another wallet.",
        };
      }
    }
    const missing = await tx.execute({
      sql: `SELECT t.id FROM campaign_tasks t LEFT JOIN task_verifications v ON v.task_id=t.id AND v.wallet_identity_id=? AND v.status='verified' WHERE t.campaign_id=? AND t.required=1 AND v.id IS NULL LIMIT 1`,
      args: [input.walletId, input.campaignId],
    });
    if (missing.rows[0]) {
      await tx.rollback();
      return {
        ok: false,
        code: "TASKS_REQUIRED",
        message: "Complete all required verified tasks before applying.",
      };
    }
    const slot = await tx.execute({
      sql: `UPDATE campaigns SET accepted_count=accepted_count+1, updated_at=? WHERE id=? AND accepted_count<max_applicants`,
      args: [Date.now(), input.campaignId],
    });
    if (slot.rowsAffected !== 1) {
      await tx.rollback();
      return {
        ok: false,
        code: "FULL",
        message: "This campaign has reached its applicant limit.",
      };
    }
    const applicationId = id();
    await tx.execute({
      sql: `INSERT INTO applications (id,organization_id,campaign_id,wallet_identity_id,chain_id,address,eligibility,accepted_at,idempotency_key) VALUES (?,?,?,?,?,?,'eligible',?,?)`,
      args: [
        applicationId,
        String(c.organization_id),
        input.campaignId,
        input.walletId,
        input.chainId,
        input.address,
        Date.now(),
        input.idempotencyKey || null,
      ],
    });
    await tx.execute({
      sql: `INSERT INTO usage_counters (organization_id,month,applicants,verifications,api_calls) VALUES (?,?,1,0,0) ON CONFLICT(organization_id,month) DO UPDATE SET applicants=applicants+1`,
      args: [String(c.organization_id), monthKey()],
    });
    await tx.execute({
      sql: `INSERT INTO audit_logs (id,organization_id,actor,action,target_id,detail,created_at) VALUES (?,?,?,'application.accepted',?,'{}',?)`,
      args: [
        id(),
        String(c.organization_id),
        input.address,
        applicationId,
        Date.now(),
      ],
    });
    const endpoints = await tx.execute({
      sql: "SELECT id,events FROM webhook_endpoints WHERE organization_id=? AND active=1",
      args: [String(c.organization_id)],
    });
    for (const event of [
      "application.accepted",
      ...(Number(c.accepted_count) + 1 >= Number(c.max_applicants)
        ? ["campaign.full"]
        : []),
    ]) {
      const payload = JSON.stringify({
        id: id(),
        event,
        createdAt: new Date().toISOString(),
        data: {
          applicationId,
          campaignId: input.campaignId,
          address: input.address,
        },
      });
      for (const endpoint of endpoints.rows)
        if (JSON.parse(String(endpoint.events)).includes(event))
          await tx.execute({
            sql: `INSERT INTO webhook_deliveries (id,organization_id,endpoint_id,event,payload,attempts,status,next_attempt_at,created_at) VALUES (?,?,?,?,?,0,'pending',?,?)`,
            args: [
              id(),
              String(c.organization_id),
              String(endpoint.id),
              event,
              payload,
              Date.now(),
              Date.now(),
            ],
          });
    }
    await tx.commit();
    return { ok: true, applicationId, duplicate: false };
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      /* already closed */
    }
    throw error;
  }
}
