import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations, organizationMembers, auditLogs } from "@/lib/db/schema";
import {
  id,
  jsonError,
  now,
  parseJson,
  rateLimit,
  safeOrigin,
  session,
} from "@/lib/core";
export async function POST(req: Request) {
  if (
    !safeOrigin(req) ||
    !(await rateLimit(req, "organization-create", 5, 3600))
  )
    return jsonError("Request blocked.", 429);
  const auth = await session("admin");
  if (!auth?.userId) return jsonError("Sign in required.", 401);
  const input = z
    .object({
      name: z.string().min(2).max(100),
      slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid organization.");
  const owned = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, auth.userId),
        eq(organizationMembers.role, "owner"),
      ),
    );
  if (owned.length >= 5)
    return jsonError("Owner organization limit reached.", 403, "LIMIT");
  const orgId = id();
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(organizations)
        .values({
          id: orgId,
          name: input.data.name,
          slug: input.data.slug,
          createdAt: now(),
        });
      await tx
        .insert(organizationMembers)
        .values({
          organizationId: orgId,
          userId: auth.userId!,
          role: "owner",
          createdAt: now(),
        });
      await tx
        .insert(auditLogs)
        .values({
          id: id(),
          organizationId: orgId,
          actor: auth.userId!,
          action: "organization.created",
          targetId: orgId,
          createdAt: now(),
        });
    });
  } catch {
    return jsonError("Organization slug is already in use.", 409, "CONFLICT");
  }
  (await cookies()).set("qk_org", orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return Response.json({ organizationId: orgId }, { status: 201 });
}
