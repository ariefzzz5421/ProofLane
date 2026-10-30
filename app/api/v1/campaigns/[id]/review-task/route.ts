import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskVerifications, campaignTasks, auditLogs } from "@/lib/db/schema";
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
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const c = await campaignById((await params).id);
  if (!c || !(await adminMember(c.organizationId, "admin")))
    return jsonError("Forbidden.", 403);
  const input = z
    .object({
      verificationId: z.string().uuid(),
      status: z.enum(["verified", "rejected"]),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid review.");
  const verification = await db.query.taskVerifications.findFirst({
    where: and(
      eq(taskVerifications.id, input.data.verificationId),
      eq(taskVerifications.campaignId, c.id),
    ),
  });
  if (!verification) return jsonError("Verification not found.", 404);
  const task = await db.query.campaignTasks.findFirst({
    where: eq(campaignTasks.id, verification.taskId),
  });
  if (task?.type !== "manual" || verification.status !== "pending")
    return jsonError("Only pending manual tasks can be reviewed.", 409);
  await db
    .update(taskVerifications)
    .set({
      status: input.data.status,
      detail: `Manually ${input.data.status} by organization administrator.`,
      verifiedAt: input.data.status === "verified" ? now() : null,
    })
    .where(eq(taskVerifications.id, verification.id));
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: c.organizationId,
    actor: "admin",
    action: `task.${input.data.status}`,
    targetId: verification.id,
    createdAt: now(),
  });
  await queueEvent(c.organizationId, `task.${input.data.status}`, {
    campaignId: c.id,
    taskId: task.id,
    verificationId: verification.id,
  });
  return Response.json({ ok: true });
}
