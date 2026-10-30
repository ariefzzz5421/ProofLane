import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { adminOrKey, jsonError } from "@/lib/core";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await adminOrKey(req, c.organizationId, "applicants:read")))
    return jsonError("Forbidden.", 403);
  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || 50)),
  );
  const cursor = url.searchParams.get("cursor");
  const rows = await db
    .select({
      id: applications.id,
      address: applications.address,
      chainId: applications.chainId,
      eligibility: applications.eligibility,
      acceptedAt: applications.acceptedAt,
    })
    .from(applications)
    .where(
      and(
        eq(applications.campaignId, c.id),
        cursor ? gt(applications.id, cursor) : undefined,
      ),
    )
    .orderBy(applications.id)
    .limit(limit + 1);
  return Response.json({
    applicants: rows.slice(0, limit),
    nextCursor: rows.length > limit ? rows[limit - 1].id : null,
  });
}
