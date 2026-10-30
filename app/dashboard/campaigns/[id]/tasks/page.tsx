import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignTasks,
  taskVerifications,
  verificationEvidence,
  walletIdentities,
} from "@/lib/db/schema";
import { adminMember } from "@/lib/core";
import { Card, CardContent } from "@/components/ui/card";
import { TaskForm } from "@/components/task-form";
import { ReviewButtons } from "@/components/review-buttons";
import { DeleteTaskButton } from "@/components/delete-task-button";
export default async function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = (await adminMember())!;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c || c.organizationId !== member.organizationId) notFound();
  const [tasks, pending] = await Promise.all([
    db.select().from(campaignTasks).where(eq(campaignTasks.campaignId, id)),
    db
      .select({
        id: taskVerifications.id,
        title: campaignTasks.title,
        address: walletIdentities.address,
        evidence: verificationEvidence.value,
      })
      .from(taskVerifications)
      .innerJoin(campaignTasks, eq(campaignTasks.id, taskVerifications.taskId))
      .innerJoin(
        walletIdentities,
        eq(walletIdentities.id, taskVerifications.walletIdentityId),
      )
      .leftJoin(
        verificationEvidence,
        eq(verificationEvidence.verificationId, taskVerifications.id),
      )
      .where(
        and(
          eq(taskVerifications.campaignId, id),
          eq(taskVerifications.status, "pending"),
          eq(campaignTasks.type, "manual"),
        ),
      ),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{c.name}</div>
          <h1>Verification tasks</h1>
          <p className="muted">
            Required tasks must be verified by the server before registration.
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        <Card>
          <CardContent>
            <h3>Configured tasks</h3>
            <div className="stack">
              {tasks.map((t) => (
                <div className="notice" key={t.id}>
                  <div className="row between">
                    <strong>{t.title}</strong>
                    <span className="status">{t.type}</span>
                  </div>
                  <div className="small muted">
                    {t.required ? "Required" : "Optional"} ·{" "}
                    {t.description || "No description"}
                  </div>
                  {member.role !== "viewer" && c.acceptedCount === 0 && (
                    <DeleteTaskButton campaignId={id} taskId={t.id} />
                  )}
                </div>
              ))}
              {!tasks.length && <p className="muted">No tasks yet.</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h3>Add task</h3>
            {member.role === "viewer" ? (
              <p className="notice">Viewer access is read-only.</p>
            ) : c.acceptedCount > 0 ? (
              <p className="notice">
                Task rules are locked after the first accepted application.
              </p>
            ) : (
              <TaskForm campaignId={id} />
            )}
          </CardContent>
        </Card>
      </div>
      <section className="section">
        <h2>Manual review queue</h2>
        {pending.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>Task</th>
                  <th>Evidence</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((v) => (
                  <tr key={v.id}>
                    <td className="code">{v.address}</td>
                    <td>{v.title}</td>
                    <td className="small">{v.evidence || "No evidence"}</td>
                    <td>
                      {member.role !== "viewer" && (
                        <ReviewButtons campaignId={id} verificationId={v.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">No evidence awaiting review.</div>
        )}
      </section>
    </>
  );
}
