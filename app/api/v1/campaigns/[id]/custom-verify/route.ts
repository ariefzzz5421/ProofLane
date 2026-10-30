import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaignTasks,
  walletIdentities,
  taskVerifications,
  auditLogs,
} from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { apiKey, id, jsonError, now, parseJson } from "@/lib/core";
import { queueEvent } from "@/lib/webhooks";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await apiKey(req, c.organizationId, "verifications:write")))
    return jsonError("Scoped API key required.", 403);
  const input = z
    .object({
      taskId: z.string().uuid(),
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      status: z.enum(["verified", "rejected"]),
      detail: z.string().max(500).default("Project backend decision"),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid verification.");
  const task = await db.query.campaignTasks.findFirst({
    where: and(
      eq(campaignTasks.id, input.data.taskId),
      eq(campaignTasks.campaignId, c.id),
    ),
  });
  if (task?.type !== "custom") return jsonError("Custom task not found.", 404);
  const wallet = await db.query.walletIdentities.findFirst({
    where: and(
      eq(walletIdentities.chainId, c.chainId),
      eq(walletIdentities.address, input.data.address.toLowerCase()),
    ),
  });
  if (!wallet) return jsonError("Wallet must authenticate first.", 404);
  await db
    .insert(taskVerifications)
    .values({
      id: id(),
      organizationId: c.organizationId,
      campaignId: c.id,
      taskId: task.id,
      walletIdentityId: wallet.id,
      status: input.data.status,
      detail: input.data.detail,
      verifiedAt: input.data.status === "verified" ? now() : null,
      createdAt: now(),
    })
    .onConflictDoUpdate({
      target: [taskVerifications.taskId, taskVerifications.walletIdentityId],
      set: {
        status: input.data.status,
        detail: input.data.detail,
        verifiedAt: input.data.status === "verified" ? now() : null,
      },
    });
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: c.organizationId,
    actor: "api_key",
    action: `task.${input.data.status}`,
    targetId: task.id,
    createdAt: now(),
  });
  await queueEvent(c.organizationId, `task.${input.data.status}`, {
    campaignId: c.id,
    taskId: task.id,
    address: wallet.address,
  });
  return Response.json({ status: input.data.status });
}
