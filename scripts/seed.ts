import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "../lib/db";
import {
  campaigns,
  organizations,
  organizationMembers,
  subscriptionPlans,
  users,
  campaignTasks,
} from "../lib/db/schema";
import { id, now } from "../lib/core";
const plans = [
  {
    id: "free",
    name: "Free",
    maxCampaigns: 2,
    monthlyApplicants: 5000,
    monthlyVerifications: 10000,
    teamSeats: 3,
    whiteLabel: false,
  },
  {
    id: "growth",
    name: "Growth (billing unavailable)",
    maxCampaigns: 20,
    monthlyApplicants: 100000,
    monthlyVerifications: 300000,
    teamSeats: 10,
    whiteLabel: true,
  },
];
async function main() {
  for (const plan of plans)
    await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: subscriptionPlans.id,
        set: {
          name: plan.name,
          maxCampaigns: plan.maxCampaigns,
          monthlyApplicants: plan.monthlyApplicants,
          monthlyVerifications: plan.monthlyVerifications,
          teamSeats: plan.teamSeats,
          whiteLabel: plan.whiteLabel,
        },
      });
  const orgId = "00000000-0000-4000-8000-000000000001";
  const campaignId = "00000000-0000-4000-8000-000000000002";
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: "QuestKernel Demo",
      slug: "questkernel-demo",
      createdAt: now(),
    })
    .onConflictDoNothing();
  await db
    .insert(campaigns)
    .values({
      id: campaignId,
      organizationId: orgId,
      name: "Demo: Builder Registration",
      slug: "demo-builder-registration",
      description:
        "A real local campaign for testing wallet sign-in and capacity rules. No token distribution is promised.",
      chainId: 1,
      maxApplicants: 5000,
      status: "live",
      requirements: "Sign in with an EVM wallet and verify the signature task.",
      reward: "Demo environment. No real rewards.",
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoNothing();
  await db
    .insert(campaignTasks)
    .values({
      id: "00000000-0000-4000-8000-000000000003",
      organizationId: orgId,
      campaignId,
      title: "Verify wallet ownership",
      description: "Sign a SIWE message. No gas or token approval.",
      type: "wallet",
      config: "{}",
      required: true,
      createdAt: now(),
    })
    .onConflictDoNothing();
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    if (process.env.SEED_ADMIN_PASSWORD.length < 12)
      throw new Error("SEED_ADMIN_PASSWORD needs at least 12 characters.");
    const email = process.env.SEED_ADMIN_EMAIL.toLowerCase();
    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    const userId = existing?.id || id();
    if (!existing)
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD, 12),
        createdAt: now(),
      });
    await db
      .insert(organizationMembers)
      .values({
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: now(),
      })
      .onConflictDoNothing();
  }
  console.log(
    "Demo organization and campaign seeded. Admin access requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
