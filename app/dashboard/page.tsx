import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, applications, organizations } from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export default async function Dashboard() {
  const member = (await adminMember())!;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, member.organizationId),
  });
  const items = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, member.organizationId));
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.organizationId, member.organizationId));
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{org?.name}</div>
          <h1>Overview</h1>
          <p className="muted">Live metrics from your organization database.</p>
        </div>
        {member.role !== "viewer" && (
          <Button asChild>
            <Link href="/dashboard/campaigns/new">New campaign</Link>
          </Button>
        )}
      </div>
      <div className="grid grid-3">
        <Card>
          <CardContent>
            <span className="muted">Campaigns</span>
            <div className="metric">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <span className="muted">Accepted applications</span>
            <div className="metric">{count[0]?.count || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <span className="muted">Available capacity</span>
            <div className="metric">
              {items.reduce(
                (sum, c) =>
                  sum + Math.max(0, c.maxApplicants - c.acceptedCount),
                0,
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="section">
        <div className="section-head">
          <h2>Recent campaigns</h2>
          <Link href="/dashboard/campaigns">View all →</Link>
        </div>
        {items.length ? (
          <div className="grid grid-2">
            {items.slice(0, 4).map((c) => (
              <Card key={c.id}>
                <CardContent>
                  <div className="row between">
                    <h3>
                      <Link href={`/dashboard/campaigns/${c.id}`}>
                        {c.name}
                      </Link>
                    </h3>
                    <span className={`status ${c.status}`}>{c.status}</span>
                  </div>
                  <p className="muted">
                    {c.acceptedCount} / {c.maxApplicants} accepted
                  </p>
                  <div className="progress">
                    <span
                      style={{
                        width: `${Math.min(100, (c.acceptedCount / c.maxApplicants) * 100)}%`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="notice">
            No campaigns yet. Create your first campaign to start accepting
            wallets.
          </div>
        )}
      </section>
    </>
  );
}
