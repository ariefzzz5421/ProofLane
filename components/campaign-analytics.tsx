import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, taskVerifications } from "@/lib/db/schema";
import { Card, CardContent } from "./ui/card";

export async function CampaignAnalytics({ id }: { id: string }) {
  const [daily, states] = await Promise.all([
    db
      .select({
        day: sql<string>`strftime('%Y-%m-%d', ${applications.acceptedAt}/1000, 'unixepoch')`,
        count: sql<number>`count(*)`,
      })
      .from(applications)
      .where(eq(applications.campaignId, id))
      .groupBy(
        sql`strftime('%Y-%m-%d', ${applications.acceptedAt}/1000, 'unixepoch')`,
      )
      .orderBy(
        sql`strftime('%Y-%m-%d', ${applications.acceptedAt}/1000, 'unixepoch')`,
      ),
    db
      .select({
        status: taskVerifications.status,
        count: sql<number>`count(*)`,
      })
      .from(taskVerifications)
      .where(eq(taskVerifications.campaignId, id))
      .groupBy(taskVerifications.status),
  ]);
  const peak = Math.max(1, ...daily.map((row) => Number(row.count)));
  return (
    <section className="section grid grid-2">
      <Card>
        <CardContent>
          <h3>Applications over time</h3>
          {daily.length ? (
            <div className="stack">
              {daily.slice(-14).map((row) => (
                <div className="analytics-row" key={row.day}>
                  <span className="small muted">{row.day}</span>
                  <div className="progress">
                    <span
                      style={{ width: `${(Number(row.count) / peak) * 100}%` }}
                    />
                  </div>
                  <strong className="small">{row.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No applications yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h3>Verification outcomes</h3>
          {states.length ? (
            <div className="stack">
              {states.map((state) => (
                <div className="row between" key={state.status}>
                  <span className={`status ${state.status}`}>
                    {state.status}
                  </span>
                  <strong>{state.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No verification attempts yet.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
