import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaigns,
  organizations,
  subscriptionPlans,
  auditLogs,
} from "@/lib/db/schema";
import {
  adminMember,
  id,
  jsonError,
  now,
  parseJson,
  safeOrigin,
} from "@/lib/core";

const schema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(3).max(100),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/),
  description: z.string().max(3000).default(""),
  logoUrl: z.url().optional(),
  projectUrl: z.url().optional(),
  chainId: z.number().int().positive(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  maxApplicants: z.number().int().min(1).max(1000000),
  status: z
    .enum(["draft", "scheduled", "live", "paused", "closed"])
    .default("draft"),
  requirements: z.string().max(3000).default(""),
  reward: z.string().max(1000).default(""),
  termsUrl: z.url().optional(),
  privacyUrl: z.url().optional(),
});
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const input = schema.safeParse(await parseJson(req));
  if (!input.success) return jsonError("Campaign fields are invalid.");
  if (!(await adminMember(input.data.organizationId, "admin")))
    return jsonError("Forbidden.", 403);
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, input.data.organizationId),
  });
  const plan =
    org &&
    (await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, org.planId),
    }));
  const existing = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.organizationId, input.data.organizationId));
  if (plan && existing.length >= plan.maxCampaigns)
    return jsonError("Plan campaign limit reached.", 403, "PLAN_LIMIT");
  const campaignId = id();
  try {
    await db.insert(campaigns).values({
      id: campaignId,
      organizationId: input.data.organizationId,
      name: input.data.name,
      slug: input.data.slug,
      description: input.data.description,
      logoUrl: input.data.logoUrl,
      projectUrl: input.data.projectUrl,
      chainId: input.data.chainId,
      startsAt: input.data.startsAt ? new Date(input.data.startsAt) : null,
      endsAt: input.data.endsAt ? new Date(input.data.endsAt) : null,
      maxApplicants: input.data.maxApplicants,
      status: input.data.status,
      requirements: input.data.requirements,
      reward: input.data.reward,
      termsUrl: input.data.termsUrl,
      privacyUrl: input.data.privacyUrl,
      createdAt: now(),
      updatedAt: now(),
    });
  } catch {
    return jsonError("Campaign slug is already in use.", 409, "CONFLICT");
  }
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: input.data.organizationId,
    actor: "admin",
    action: "campaign.created",
    targetId: campaignId,
    createdAt: now(),
  });
  return Response.json(
    { id: campaignId, hostedUrl: `/c/${input.data.slug}` },
    { status: 201 },
  );
}
