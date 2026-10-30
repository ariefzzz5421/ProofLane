import { and, eq, lte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import { jsonError, now } from "@/lib/core";
import { deliverWebhook } from "@/lib/webhooks";
export async function POST(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return jsonError("Forbidden.", 403);
  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextAttemptAt, now()),
        lt(webhookDeliveries.attempts, 8),
      ),
    )
    .limit(25);
  let delivered = 0;
  for (const item of deliveries) {
    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, item.endpointId),
    });
    if (!endpoint?.active) continue;
    let result = "Network error";
    let ok = false;
    try {
      const r = await deliverWebhook(item, endpoint);
      ok = r.ok;
      result = String(r.status);
    } catch (err) {
      result = err instanceof Error ? err.message : "Network error";
    }
    const attempts = item.attempts + 1;
    await db
      .update(webhookDeliveries)
      .set({
        attempts,
        status: ok ? "delivered" : attempts >= 8 ? "failed" : "pending",
        lastResponse: result,
        nextAttemptAt: new Date(
          Date.now() + Math.min(86400000, 2 ** attempts * 60000),
        ),
      })
      .where(eq(webhookDeliveries.id, item.id));
    if (ok) delivered++;
  }
  return Response.json({ processed: deliveries.length, delivered });
}
