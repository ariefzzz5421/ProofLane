import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaignTasks, taskVerifications } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import {
  jsonError,
  parseJson,
  rateLimit,
  safeOrigin,
  wallet,
} from "@/lib/core";
import { checkTask, saveVerification } from "@/lib/verification";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req) || !(await rateLimit(req, "verify-task", 30)))
    return jsonError("Request blocked.", 429);
  const c = await campaignById((await params).id);
  if (!c || c.status !== "live") return jsonError("Campaign is not live.", 409);
  const identity = await wallet();
  if (!identity || identity.chainId !== c.chainId)
    return jsonError("Sign in with the campaign wallet and chain.", 401);
  const input = z
    .object({
      taskId: z.string().uuid(),
      evidence: z.string().max(2000).optional(),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid task request.");
  const task = await db.query.campaignTasks.findFirst({
    where: and(
      eq(campaignTasks.id, input.data.taskId),
      eq(campaignTasks.campaignId, c.id),
    ),
  });
  if (!task) return jsonError("Task not found.", 404);
  const prior = await db.query.taskVerifications.findFirst({
    where: and(
      eq(taskVerifications.taskId, task.id),
      eq(taskVerifications.walletIdentityId, identity.id),
    ),
  });
  if (prior?.status === "verified")
    return Response.json({ status: prior.status, detail: prior.detail });
  const result = await checkTask(task, identity.address, input.data.evidence);
  await saveVerification(task, identity.id, result);
  return Response.json({ status: result.status, detail: result.detail });
}
