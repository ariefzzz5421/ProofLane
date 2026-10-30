import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import {
  adminMember,
  id,
  jsonError,
  now,
  parseJson,
  safeOrigin,
  secret,
  sha256,
} from "@/lib/core";
import { encryptSecret, publicWebhookUrl } from "@/lib/webhooks";
const events = [
  "application.accepted",
  "application.rejected",
  "task.verified",
  "task.rejected",
  "campaign.full",
  "campaign.closed",
] as const;
export async function GET() {
  const member = await adminMember();
  if (!member) return jsonError("Forbidden.", 403);
  const rows = await db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      events: webhookEndpoints.events,
      active: webhookEndpoints.active,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, member.organizationId));
  return Response.json({ webhooks: rows });
}
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember(undefined, "admin");
  if (!member) return jsonError("Forbidden.", 403);
  const input = z
    .object({ url: z.url(), events: z.array(z.enum(events)).min(1) })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid webhook.");
  let url: string;
  try {
    url = await publicWebhookUrl(input.data.url);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid webhook URL.",
    );
  }
  const raw = `whsec_${secret()}`;
  let encrypted: string;
  try {
    encrypted = encryptSecret(raw);
  } catch {
    return jsonError(
      "Webhook encryption is not configured.",
      503,
      "UNCONFIGURED",
    );
  }
  const webhookId = id();
  await db.insert(webhookEndpoints).values({
    id: webhookId,
    organizationId: member.organizationId,
    url,
    secretHash: sha256(raw),
    secretEncrypted: encrypted,
    events: JSON.stringify(input.data.events),
    createdAt: now(),
  });
  return Response.json({ id: webhookId, signingSecret: raw }, { status: 201 });
}
