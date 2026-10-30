import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEndpoints } from "@/lib/db/schema";
import { adminMember, jsonError, safeOrigin } from "@/lib/core";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember(undefined, "admin");
  if (!member) return jsonError("Forbidden.", 403);
  const result = await db
    .update(webhookEndpoints)
    .set({ active: false })
    .where(
      and(
        eq(webhookEndpoints.id, (await params).id),
        eq(webhookEndpoints.organizationId, member.organizationId),
      ),
    )
    .returning({ id: webhookEndpoints.id });
  return result.length
    ? Response.json({ ok: true })
    : jsonError("Not found.", 404);
}
