import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, client } from "@/lib/db";
import {
  organizationMembers,
  users,
  organizations,
  subscriptionPlans,
} from "@/lib/db/schema";
import { adminMember, id, jsonError, parseJson, safeOrigin } from "@/lib/core";
export async function GET() {
  const member = await adminMember();
  if (!member) return jsonError("Forbidden.", 403);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      role: organizationMembers.role,
      createdAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, member.organizationId));
  return Response.json({ members: rows });
}
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember();
  if (member?.role !== "owner") return jsonError("Owner role required.", 403);
  const input = z
    .object({ email: z.email(), role: z.enum(["admin", "viewer"]) })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid member.");
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.data.email.toLowerCase()),
  });
  if (!user)
    return jsonError(
      "This person must create a QuestKernel account first.",
      404,
    );
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, member.organizationId),
  });
  const plan =
    org &&
    (await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, org.planId),
    }));
  const tx = await client.transaction("write");
  try {
    const count = await tx.execute({
      sql: "SELECT count(*) n FROM organization_members WHERE organization_id=?",
      args: [member.organizationId],
    });
    if (Number(count.rows[0]?.n || 0) >= Number(plan?.teamSeats || 1)) {
      await tx.rollback();
      return jsonError("Team seat limit reached.", 403, "PLAN_LIMIT");
    }
    await tx.execute({
      sql: "INSERT INTO organization_members (organization_id,user_id,role,created_at) VALUES (?,?,?,?)",
      args: [member.organizationId, user.id, input.data.role, Date.now()],
    });
    await tx.execute({
      sql: "INSERT INTO audit_logs (id,organization_id,actor,action,target_id,detail,created_at) VALUES (?,?,?,'member.added',?,?,?)",
      args: [
        id(),
        member.organizationId,
        member.userId,
        user.id,
        JSON.stringify({ role: input.data.role }),
        Date.now(),
      ],
    });
    await tx.commit();
    return Response.json(
      { userId: user.id, role: input.data.role },
      { status: 201 },
    );
  } catch (error) {
    await tx.rollback().catch(() => {});
    return jsonError(
      error instanceof Error && error.message.includes("UNIQUE")
        ? "Already a member."
        : "Member could not be added.",
      409,
    );
  }
}
