import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { publicCampaign, publicTasks } from "@/lib/campaign";
import { ParticipantFlow } from "@/components/participant-flow";
export default async function HostedCampaign({
  params,
  searchParams,
}: {
  params: Promise<{ campaignSlug: string }>;
  searchParams: Promise<{ discord?: string }>;
}) {
  const { campaignSlug } = await params;
  const row = await db.query.campaigns.findFirst({
    where: eq(campaigns.slug, campaignSlug),
  });
  if (!row || row.status === "draft") notFound();
  const [campaign, tasks] = await Promise.all([
    publicCampaign(row.id),
    publicTasks(row.id),
  ]);
  if (!campaign) notFound();
  return (
    <>
      <header className="container nav">
        <Link href="/" className="brand">
          <span className="brand-mark">Q</span>QuestKernel
        </Link>
        <Link href="/docs" className="small muted">
          How verification works ↗
        </Link>
      </header>
      <ParticipantFlow
        campaign={campaign}
        tasks={tasks}
        discordResult={(await searchParams).discord}
      />
      <footer className="footer">
        <div className="container small">
          QuestKernel stores registration and eligibility. Token distribution is
          outside this service.
        </div>
      </footer>
    </>
  );
}
