import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { campaigns, campaignTasks } from "./db/schema";
export async function campaignById(id: string) {
  return db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
}
export async function publicCampaign(id: string) {
  const campaign = await campaignById(id);
  if (!campaign || campaign.status === "draft") return null;
  return {
    id: campaign.id,
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description,
    logoUrl: campaign.logoUrl,
    projectUrl: campaign.projectUrl,
    chainId: campaign.chainId,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    status: campaign.status,
    maxApplicants: campaign.maxApplicants,
    acceptedCount: campaign.acceptedCount,
    remaining: Math.max(0, campaign.maxApplicants - campaign.acceptedCount),
    reward: campaign.reward,
    requirements: campaign.requirements,
    termsUrl: campaign.termsUrl,
    privacyUrl: campaign.privacyUrl,
  };
}
export async function publicTasks(id: string) {
  return db
    .select({
      id: campaignTasks.id,
      title: campaignTasks.title,
      description: campaignTasks.description,
      type: campaignTasks.type,
      required: campaignTasks.required,
    })
    .from(campaignTasks)
    .where(eq(campaignTasks.campaignId, id));
}
export async function privateTasks(id: string, organizationId: string) {
  return db
    .select()
    .from(campaignTasks)
    .where(
      and(
        eq(campaignTasks.campaignId, id),
        eq(campaignTasks.organizationId, organizationId),
      ),
    );
}
