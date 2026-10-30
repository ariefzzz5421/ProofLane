import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationMembers, auditLogs } from "@/lib/db/schema";
import { adminMember, id, jsonError, now, safeOrigin } from "@/lib/core";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember();
  if (member?.role !== "owner") return jsonError("Owner role required.", 403);
  const target = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, member.organizationId),
      eq(organizationMembers.userId, (await params).userId),
    ),
  });
  if (!target) return jsonError("Member not found.", 404);
  if (target.role === "owner") return jsonError("Cannot remove an owner.", 409);
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, member.organizationId),
        eq(organizationMembers.userId, target.userId),
      ),
    );
  await db
    .insert(auditLogs)
    .values({
      id: id(),
      organizationId: member.organizationId,
      actor: member.userId,
      action: "member.removed",
      targetId: target.userId,
      createdAt: now(),
    });
  return Response.json({ ok: true });
}
