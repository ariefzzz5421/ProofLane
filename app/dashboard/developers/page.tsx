import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, webhookEndpoints, webhookDeliveries } from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { DeveloperTools } from "@/components/developer-tools";
import { RevokeButton } from "@/components/revoke-button";
export default async function Developers() {
  const member = (await adminMember())!;
  const [keys, endpoints, deliveries] = await Promise.all([
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, member.organizationId)),
    db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        active: webhookEndpoints.active,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.organizationId, member.organizationId)),
    db
      .select({
        id: webhookDeliveries.id,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        lastResponse: webhookDeliveries.lastResponse,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, member.organizationId))
      .limit(20),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Integrations</div>
          <h1>Developers</h1>
          <p className="muted">
            Scoped credentials, signed events and delivery logs.
          </p>
        </div>
      </div>
      {member.role !== "viewer" && <DeveloperTools />}
      <section className="section">
        <h2>API keys</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td className="code">{k.prefix}…</td>
                  <td className="small">{k.scopes}</td>
                  <td>
                    <span className="status">
                      {k.revokedAt ? "revoked" : "active"}
                    </span>
                  </td>
                  <td>
                    {member.role !== "viewer" && !k.revokedAt && (
                      <RevokeButton kind="keys" id={k.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!keys.length && <p className="muted">No keys yet.</p>}
      </section>
      <section className="section">
        <h2>Webhook endpoints</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.id}>
                  <td className="code">{e.url}</td>
                  <td>{e.active ? "Active" : "Disabled"}</td>
                  <td>
                    {member.role !== "viewer" && e.active && (
                      <RevokeButton kind="webhooks" id={e.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!endpoints.length && <p className="muted">No webhooks yet.</p>}
      </section>
      <section className="section">
        <h2>Recent deliveries</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.event}</td>
                  <td>
                    <span className={`status ${d.status}`}>{d.status}</span>
                  </td>
                  <td>{d.attempts}</td>
                  <td>{d.lastResponse || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!deliveries.length && <p className="muted">No deliveries yet.</p>}
      </section>
    </>
  );
}
