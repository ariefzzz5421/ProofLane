import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  applications,
  taskVerifications,
  campaignTasks,
} from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { jsonError, wallet } from "@/lib/core";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  const identity = await wallet();
  if (!identity || identity.chainId !== c.chainId)
    return jsonError("Authenticate the campaign wallet first.", 401);
  const application = await db.query.applications.findFirst({
    where: and(
      eq(applications.campaignId, c.id),
      eq(applications.walletIdentityId, identity.id),
    ),
  });
  const tasks = await db
    .select({
      taskId: campaignTasks.id,
      title: campaignTasks.title,
      status: taskVerifications.status,
      detail: taskVerifications.detail,
    })
    .from(campaignTasks)
    .leftJoin(
      taskVerifications,
      and(
        eq(taskVerifications.taskId, campaignTasks.id),
        eq(taskVerifications.walletIdentityId, identity.id),
      ),
    )
    .where(eq(campaignTasks.campaignId, c.id));
  return Response.json({
    wallet: { address: identity.address, chainId: identity.chainId },
    application: application
      ? {
          id: application.id,
          status: "accepted",
          eligibility: application.eligibility,
          acceptedAt: application.acceptedAt,
        }
      : null,
    tasks: tasks.map((t) => ({ ...t, status: t.status || "not_started" })),
  });
}
