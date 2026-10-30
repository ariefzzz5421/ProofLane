import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, client } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { adminMember, adminOrKey, id, jsonError, safeOrigin } from "@/lib/core";
import { campaignById } from "@/lib/campaign";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Not found.", 404);
  if (!(await adminMember(c.organizationId, "admin")))
    return jsonError("Forbidden.", 403);
  const tx = await client.transaction("write");
  try {
    const current = (
      await tx.execute({
        sql: "SELECT rules_version FROM campaigns WHERE id=?",
        args: [c.id],
      })
    ).rows[0];
    const rows = await tx.execute({
      sql: `SELECT chain_id,address,accepted_at FROM applications WHERE campaign_id=? AND eligibility='eligible' ORDER BY chain_id,address`,
      args: [c.id],
    });
    const csv =
      [
        "chain_id,wallet_address,accepted_at",
        ...rows.rows.map(
          (r) =>
            `${r.chain_id},${r.address},${new Date(Number(r.accepted_at)).toISOString()}`,
        ),
      ].join("\n") + "\n";
    const checksum = createHash("sha256").update(csv).digest("hex");
    const snapshotId = id();
    await tx.execute({
      sql: "INSERT INTO snapshots (id,organization_id,campaign_id,rules_version,checksum,row_count,csv,created_at) VALUES (?,?,?,?,?,?,?,?)",
      args: [
        snapshotId,
        c.organizationId,
        c.id,
        Number(current.rules_version),
        checksum,
        rows.rows.length,
        csv,
        Date.now(),
      ],
    });
    await tx.commit();
    return Response.json(
      {
        id: snapshotId,
        checksum,
        rowCount: rows.rows.length,
        rulesVersion: Number(current.rules_version),
        downloadUrl: `/api/v1/campaigns/${c.id}/snapshot/${snapshotId}`,
      },
      { status: 201 },
    );
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c || !(await adminOrKey(req, c.organizationId, "applicants:read")))
    return jsonError("Forbidden.", 403);
  const rows = await db
    .select({
      id: snapshots.id,
      checksum: snapshots.checksum,
      rowCount: snapshots.rowCount,
      rulesVersion: snapshots.rulesVersion,
      createdAt: snapshots.createdAt,
    })
    .from(snapshots)
    .where(eq(snapshots.campaignId, c.id));
  return Response.json({ snapshots: rows });
}
