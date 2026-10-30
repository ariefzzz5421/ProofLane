import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { Button } from "@/components/ui/button";
export default async function Campaigns() {
  const member = (await adminMember())!;
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, member.organizationId));
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>Campaigns</h1>
          <p className="muted">
            Manage registration, verification, and eligibility.
          </p>
        </div>
        {member.role !== "viewer" && (
          <Button asChild>
            <Link href="/dashboard/campaigns/new">New campaign</Link>
          </Button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Chain</th>
              <th>Accepted</th>
              <th>Public URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/dashboard/campaigns/${c.id}`}>
                    <strong>{c.name}</strong>
                  </Link>
                </td>
                <td>
                  <span className={`status ${c.status}`}>
                    {c.acceptedCount >= c.maxApplicants ? "full" : c.status}
                  </span>
                </td>
                <td>{c.chainId}</td>
                <td>
                  {c.acceptedCount} / {c.maxApplicants}
                </td>
                <td>
                  <Link href={`/c/${c.slug}`}>/c/{c.slug}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No campaigns yet.</p>}
    </>
  );
}
