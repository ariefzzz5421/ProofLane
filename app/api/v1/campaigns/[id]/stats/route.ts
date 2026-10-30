import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  applications,
  campaignTasks,
  taskVerifications,
  usageCounters,
} from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { adminOrKey, jsonError } from "@/lib/core";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const c = await campaignById((await params).id);
  if (!c) return jsonError("Campaign not found.", 404);
  if (!(await adminOrKey(req, c.organizationId, "stats:read")))
    return jsonError("Forbidden.", 403);
  const [eligibility, tasks, daily, verificationStates, usage] =
    await Promise.all([
      db
        .select({
          eligibility: applications.eligibility,
          count: sql<number>`count(*)`,
        })
        .from(applications)
        .where(eq(applications.campaignId, c.id))
        .groupBy(applications.eligibility),
      db
        .select({
          taskId: campaignTasks.id,
          title: campaignTasks.title,
          verified: sql<number>`sum(case when ${taskVerifications.status}='verified' then 1 else 0 end)`,
          attempted: sql<number>`count(${taskVerifications.id})`,
        })
        .from(campaignTasks)
        .leftJoin(
          taskVerifications,
          eq(taskVerifications.taskId, campaignTasks.id),
        )
        .where(eq(campaignTasks.campaignId, c.id))
        .groupBy(campaignTasks.id),
      db
        .select({
          day: sql<string>`strftime('%Y-%m-%d', ${applications.acceptedAt}/1000, 'unixepoch')`,
          count: sql<number>`count(*)`,
        })
        .from(applications)
        .where(eq(applications.campaignId, c.id))
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
        .where(eq(taskVerifications.campaignId, c.id))
        .groupBy(taskVerifications.status),
      db
        .select()
        .from(usageCounters)
        .where(eq(usageCounters.organizationId, c.organizationId)),
    ]);
  return Response.json({
    accepted: c.acceptedCount,
    maxApplicants: c.maxApplicants,
    remaining: Math.max(0, c.maxApplicants - c.acceptedCount),
    duplicateAttempts: c.duplicateAttempts,
    eligibility,
    taskCompletion: tasks.map((task) => ({
      ...task,
      completionRate: task.attempted
        ? Number(task.verified) / Number(task.attempted)
        : 0,
    })),
    applicationsOverTime: daily,
    verificationStates,
    organizationUsage: usage,
  });
}
