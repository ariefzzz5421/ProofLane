import { campaignById, publicCampaign } from "@/lib/campaign";
import {
  adminOrKey,
  id as newId,
  jsonError,
  now,
  parseJson,
  safeOrigin,
} from "@/lib/core";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { queueEvent } from "@/lib/webhooks";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaign = await campaignById(id);
  if (!campaign) return jsonError("Campaign not found.", 404);
  const publicData = await publicCampaign(id);
  if (publicData) return Response.json({ campaign: publicData });
  if (!(await adminOrKey(req, campaign.organizationId, "campaigns:read")))
    return jsonError("Campaign not found.", 404);
  return Response.json({ campaign });
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await adminOrKey(req, c.organizationId, "campaigns:write", true)))
    return jsonError("Forbidden.", 403);
  const input = z
    .object({
      status: z
        .enum(["draft", "scheduled", "live", "paused", "closed"])
        .optional(),
      name: z.string().min(3).max(100).optional(),
      description: z.string().max(3000).optional(),
      maxApplicants: z.number().int().min(1).optional(),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid campaign update.");
  if (input.data.maxApplicants && input.data.maxApplicants < c.acceptedCount)
    return jsonError("Capacity cannot be below accepted count.");
  await db
    .update(campaigns)
    .set({ ...input.data, rulesVersion: c.rulesVersion + 1, updatedAt: now() })
    .where(eq(campaigns.id, c.id));
  await db.insert(auditLogs).values({
    id: newId(),
    organizationId: c.organizationId,
    actor: "admin",
    action: `campaign.updated`,
    targetId: c.id,
    detail: JSON.stringify(input.data),
    createdAt: now(),
  });
  if (input.data.status === "closed" && c.status !== "closed")
    await queueEvent(c.organizationId, "campaign.closed", { campaignId: c.id });
  return Response.json({ ok: true });
}
