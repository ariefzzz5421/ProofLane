import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, campaigns, campaignTasks } from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignStatus } from "@/components/campaign-status";
import { CampaignAnalytics } from "@/components/campaign-analytics";
export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = (await adminMember())!;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c || c.organizationId !== member.organizationId) notFound();
  const [eligible, tasks] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(applications)
      .where(eq(applications.campaignId, id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(campaignTasks)
      .where(eq(campaignTasks.campaignId, id)),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Campaign analytics</div>
          <h1>{c.name}</h1>
          <p className="muted">
            /c/{c.slug} · Chain {c.chainId}
          </p>
        </div>
        <Link className="button button-outline" href={`/c/${c.slug}`}>
          View hosted page ↗
        </Link>
      </div>
      <div className="grid grid-3">
        <Card>
          <CardContent>
            <span className="muted">Accepted</span>
            <div className="metric">{c.acceptedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <span className="muted">Capacity</span>
            <div className="metric">{c.maxApplicants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <span className="muted">Duplicate attempts</span>
            <div className="metric">{c.duplicateAttempts}</div>
          </CardContent>
        </Card>
      </div>
      <div className="section grid grid-2">
        <Card>
          <CardContent>
            <h3>Registration</h3>
            <p className="muted">
              {eligible[0]?.count || 0} persisted applications ·{" "}
              {tasks[0]?.count || 0} tasks
            </p>
            <div className="progress">
              <span
                style={{
                  width: `${Math.min(100, (c.acceptedCount / c.maxApplicants) * 100)}%`,
                }}
              />
            </div>
            <p className="small muted">
              {Math.max(0, c.maxApplicants - c.acceptedCount)} places remain
            </p>
            {member.role !== "viewer" && (
              <CampaignStatus id={id} status={c.status} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3>Manage</h3>
            <div className="stack">
              <Link href={`/dashboard/campaigns/${id}/applicants`}>
                View applicants and export →
              </Link>
              <Link href={`/dashboard/campaigns/${id}/tasks`}>
                Manage verification tasks →
              </Link>
              <Link href="/dashboard/developers">API keys and webhooks →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <CampaignAnalytics id={id} />
    </>
  );
}
