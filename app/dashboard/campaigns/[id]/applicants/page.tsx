import { notFound } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, campaigns } from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { SnapshotButton } from "@/components/snapshot-button";
import { EligibilityControl } from "@/components/eligibility-control";
export default async function Applicants({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { id } = await params;
  const { cursor } = await searchParams;
  const member = (await adminMember())!;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c || c.organizationId !== member.organizationId) notFound();
  const rows = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.campaignId, id),
        cursor ? gt(applications.id, cursor) : undefined,
      ),
    )
    .orderBy(applications.id)
    .limit(51);
  const next = rows.length > 50 ? rows[49].id : null;
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{c.name}</div>
          <h1>Applicants</h1>
          <p className="muted">
            {c.acceptedCount} accepted applications from the database.
          </p>
        </div>
        {member.role !== "viewer" && <SnapshotButton campaignId={id} />}
      </div>
      <div className="notice small" style={{ marginBottom: "1rem" }}>
        Snapshots include accepted eligible wallets only, with a checksum and
        rules version. They do not distribute tokens.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Wallet</th>
              <th>Chain</th>
              <th>Eligibility</th>
              <th>Accepted at</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row) => (
              <tr key={row.id}>
                <td className="code">{row.id}</td>
                <td className="code">{row.address}</td>
                <td>{row.chainId}</td>
                <td>
                  <span className={`status ${row.eligibility}`}>
                    {row.eligibility}
                  </span>
                </td>
                <td>{row.acceptedAt.toLocaleString()}</td>
                <td>
                  {member.role !== "viewer" && (
                    <EligibilityControl
                      campaignId={id}
                      applicationId={row.id}
                      initial={row.eligibility}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No accepted applications yet.</p>}
      {next && (
        <a
          className="button button-outline"
          style={{ marginTop: "1rem" }}
          href={`?cursor=${next}`}
        >
          Next page →
        </a>
      )}
    </>
  );
}
