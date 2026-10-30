import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  users,
  auditLogs,
} from "@/lib/db/schema";
import {
  id,
  issueSession,
  jsonError,
  now,
  parseJson,
  rateLimit,
  safeOrigin,
} from "@/lib/core";

const input = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  organization: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
});
export async function POST(req: Request) {
  if (!safeOrigin(req) || !(await rateLimit(req, "admin-register", 5, 3600)))
    return jsonError("Request blocked.", 429);
  const parsed = input.safeParse(await parseJson(req));
  if (!parsed.success)
    return jsonError(
      "Enter a valid email, 12-character password, organization and slug.",
    );
  const { email, password, organization, slug } = parsed.data;
  const userId = id(),
    orgId = id();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash: await hash(password, 12),
        createdAt: now(),
      });
      await tx
        .insert(organizations)
        .values({ id: orgId, name: organization, slug, createdAt: now() });
      await tx.insert(organizationMembers).values({
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: now(),
      });
      await tx.insert(auditLogs).values({
        id: id(),
        organizationId: orgId,
        actor: userId,
        action: "organization.created",
        targetId: orgId,
        createdAt: now(),
      });
    });
  } catch {
    return jsonError(
      "Email or organization slug is already in use.",
      409,
      "CONFLICT",
    );
  }
  await issueSession("admin", userId);
  return Response.json({ organizationId: orgId }, { status: 201 });
}
