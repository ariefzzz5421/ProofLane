import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations, auditLogs } from "@/lib/db/schema";
import {
  adminMember,
  id,
  jsonError,
  now,
  parseJson,
  safeOrigin,
} from "@/lib/core";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const organizationId = (await params).id;
  const member = await adminMember(organizationId);
  if (member?.role !== "owner") return jsonError("Owner role required.", 403);
  const input = z
    .object({
      name: z.string().min(2).max(100),
      slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid organization fields.");
  try {
    await db
      .update(organizations)
      .set(input.data)
      .where(eq(organizations.id, organizationId));
  } catch {
    return jsonError("Organization slug is already in use.", 409, "CONFLICT");
  }
  await db
    .insert(auditLogs)
    .values({
      id: id(),
      organizationId,
      actor: member.userId,
      action: "organization.updated",
      targetId: organizationId,
      detail: JSON.stringify(input.data),
      createdAt: now(),
    });
  return Response.json({ ok: true });
}
