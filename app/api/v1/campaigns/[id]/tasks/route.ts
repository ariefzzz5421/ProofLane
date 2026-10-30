import { z } from "zod";
import { client } from "@/lib/db";
import { campaignById, publicTasks } from "@/lib/campaign";
import { adminOrKey, id, jsonError, parseJson, safeOrigin } from "@/lib/core";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c || c.status === "draft") return jsonError("Campaign not found.", 404);
  return Response.json({ tasks: await publicTasks(c.id) });
}
const schema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(1000).default(""),
  type: z.enum([
    "wallet",
    "token",
    "nft",
    "transaction",
    "discord",
    "x",
    "custom",
    "manual",
  ]),
  required: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await adminOrKey(req, c.organizationId, "tasks:write", true)))
    return jsonError("Forbidden.", 403);
  const input = schema.safeParse(await parseJson(req));
  if (!input.success) return jsonError("Task fields are invalid.");
  const { type, config } = input.data;
  if (["token", "nft", "transaction"].includes(type)) {
    if (
      !Number.isInteger(config.chainId) ||
      Number(config.chainId) < 1 ||
      typeof config.contract !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(config.contract)
    )
      return jsonError(
        "On-chain tasks require a valid chain ID and contract address.",
      );
    if (
      config.minimum !== undefined &&
      (!/^\d+$/.test(String(config.minimum)) ||
        BigInt(String(config.minimum)) < 1n)
    )
      return jsonError("Minimum balance must be a positive integer.");
    if (
      config.confirmations !== undefined &&
      (!Number.isInteger(config.confirmations) ||
        Number(config.confirmations) < 1)
    )
      return jsonError("Confirmations must be a positive integer.");
    if (
      config.eventTopic !== undefined &&
      (typeof config.eventTopic !== "string" ||
        !/^0x[0-9a-fA-F]{64}$/.test(config.eventTopic))
    )
      return jsonError("Event topic must be a 32-byte hex value.");
  }
  if (
    type === "discord" &&
    (typeof config.guildId !== "string" || !/^\d{5,25}$/.test(config.guildId))
  )
    return jsonError("Discord tasks require a numeric guild ID.");
  const taskId = id();
  const tx = await client.transaction("write");
  try {
    const state = await tx.execute({
      sql: "SELECT accepted_count FROM campaigns WHERE id=?",
      args: [c.id],
    });
    if (Number(state.rows[0]?.accepted_count || 0) > 0) {
      await tx.rollback();
      return jsonError(
        "Tasks cannot be changed after registrations begin.",
        409,
      );
    }
    await tx.execute({
      sql: "INSERT INTO campaign_tasks (id,organization_id,campaign_id,title,description,type,required,config,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        taskId,
        c.organizationId,
        c.id,
        input.data.title,
        input.data.description,
        input.data.type,
        input.data.required ? 1 : 0,
        JSON.stringify(input.data.config),
        Date.now(),
      ],
    });
    await tx.execute({
      sql: "UPDATE campaigns SET rules_version=rules_version+1,updated_at=? WHERE id=?",
      args: [Date.now(), c.id],
    });
    await tx.execute({
      sql: "INSERT INTO audit_logs (id,organization_id,actor,action,target_id,detail,created_at) VALUES (?,?,?,'task.created',?,'{}',?)",
      args: [id(), c.organizationId, "admin", taskId, Date.now()],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
  return Response.json({ id: taskId }, { status: 201 });
}
