import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, auditLogs } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import {
  adminMember,
  id,
  jsonError,
  now,
  parseJson,
  safeOrigin,
} from "@/lib/core";
import { queueEvent } from "@/lib/webhooks";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; applicationId: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const { id: campaignId, applicationId } = await params;
  const c = await campaignById(campaignId);
  if (!c || !(await adminMember(c.organizationId, "admin")))
    return jsonError("Forbidden.", 403);
  const input = z
    .object({
      eligibility: z.enum(["eligible", "pending", "rejected"]),
      reason: z.string().min(3).max(500),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Decision and reason are required.");
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, applicationId),
      eq(applications.campaignId, c.id),
      eq(applications.organizationId, c.organizationId),
    ),
  });
  if (!application) return jsonError("Application not found.", 404);
  await db
    .update(applications)
    .set({ eligibility: input.data.eligibility })
    .where(eq(applications.id, applicationId));
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: c.organizationId,
    actor: "admin",
    action: `application.${input.data.eligibility}`,
    targetId: applicationId,
    detail: JSON.stringify({
      reason: input.data.reason,
      previous: application.eligibility,
    }),
    createdAt: now(),
  });
  if (
    input.data.eligibility === "rejected" &&
    application.eligibility !== "rejected"
  )
    await queueEvent(c.organizationId, "application.rejected", {
      campaignId: c.id,
      applicationId,
      address: application.address,
    });
  return Response.json({ eligibility: input.data.eligibility });
}
