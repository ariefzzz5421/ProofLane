import { client } from "@/lib/db";
import { campaignById } from "@/lib/campaign";
import { adminOrKey, id, jsonError, safeOrigin } from "@/lib/core";
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const { id: campaignId, taskId } = await params;
  const c = await campaignById(campaignId);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await adminOrKey(req, c.organizationId, "tasks:write", true)))
    return jsonError("Forbidden.", 403);
  const tx = await client.transaction("write");
  try {
    const state = await tx.execute({
      sql: "SELECT accepted_count FROM campaigns WHERE id=?",
      args: [c.id],
    });
    if (Number(state.rows[0]?.accepted_count || 0) > 0) {
      await tx.rollback();
      return jsonError("Tasks are locked after registration begins.", 409);
    }
    const task = await tx.execute({
      sql: "SELECT id FROM campaign_tasks WHERE id=? AND campaign_id=? AND organization_id=?",
      args: [taskId, c.id, c.organizationId],
    });
    if (!task.rows.length) {
      await tx.rollback();
      return jsonError("Task not found.", 404);
    }
    await tx.execute({
      sql: "DELETE FROM verification_evidence WHERE verification_id IN (SELECT id FROM task_verifications WHERE task_id=?)",
      args: [taskId],
    });
    await tx.execute({
      sql: "DELETE FROM task_verifications WHERE task_id=?",
      args: [taskId],
    });
    await tx.execute({
      sql: "DELETE FROM campaign_tasks WHERE id=?",
      args: [taskId],
    });
    await tx.execute({
      sql: "UPDATE campaigns SET rules_version=rules_version+1,updated_at=? WHERE id=?",
      args: [Date.now(), c.id],
    });
    await tx.execute({
      sql: "INSERT INTO audit_logs (id,organization_id,actor,action,target_id,detail,created_at) VALUES (?,?,?,'task.deleted',?,'{}',?)",
      args: [id(), c.organizationId, "admin", taskId, Date.now()],
    });
    await tx.commit();
    return Response.json({ ok: true });
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}
