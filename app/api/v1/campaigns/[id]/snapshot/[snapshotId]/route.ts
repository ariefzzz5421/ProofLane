import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { snapshots } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { adminOrKey, jsonError } from "@/lib/core";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; snapshotId: string }> },
) {
  const { id, snapshotId } = await params;
  const c = await campaignById(id);
  if (!c || !(await adminOrKey(req, c.organizationId, "applicants:read")))
    return jsonError("Forbidden.", 403);
  const snapshot = await db.query.snapshots.findFirst({
    where: and(eq(snapshots.id, snapshotId), eq(snapshots.campaignId, c.id)),
  });
  if (!snapshot) return jsonError("Snapshot not found.", 404);
  return new Response(snapshot.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${c.slug}-${snapshot.id}.csv"`,
      "x-qk-checksum-sha256": snapshot.checksum,
      "cache-control": "private, no-store",
    },
  });
}
