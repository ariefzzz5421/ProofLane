import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, auditLogs } from "@/lib/db/schema";
import { adminMember, id, jsonError, now, safeOrigin } from "@/lib/core";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember(undefined, "admin");
  if (!member) return jsonError("Forbidden.", 403);
  const keyId = (await params).id;
  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: now() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.organizationId, member.organizationId),
      ),
    )
    .returning({ id: apiKeys.id });
  if (!updated.length) return jsonError("Key not found.", 404);
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: member.organizationId,
    actor: member.userId,
    action: "api_key.revoked",
    targetId: keyId,
    createdAt: now(),
  });
  return Response.json({ ok: true });
}
