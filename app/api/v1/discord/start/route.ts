import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authChallenges, campaignTasks } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import {
  appUrl,
  id,
  jsonError,
  now,
  rateLimit,
  safeOrigin,
  secret,
  sha256,
  wallet,
} from "@/lib/core";
export async function GET(req: Request) {
  if (!safeOrigin(req) || !(await rateLimit(req, "discord-start", 10)))
    return jsonError("Request blocked.", 429);
  const url = new URL(req.url);
  const input = z
    .object({ campaignId: z.string().uuid(), taskId: z.string().uuid() })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!input.success) return jsonError("Invalid Discord task.");
  const c = await campaignById(input.data.campaignId);
  const identity = await wallet();
  if (!c || !identity || identity.chainId !== c.chainId)
    return jsonError("Authenticate the campaign wallet first.", 401);
  const task = await db.query.campaignTasks.findFirst({
    where: and(
      eq(campaignTasks.id, input.data.taskId),
      eq(campaignTasks.campaignId, c.id),
    ),
  });
  if (task?.type !== "discord")
    return jsonError("Discord task not found.", 404);
  const config = JSON.parse(task.config) as { guildId?: string };
  if (!config.guildId || !/^\d{5,25}$/.test(config.guildId))
    return jsonError("Discord guild is not configured.", 503, "UNSUPPORTED");
  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  )
    return jsonError(
      "Discord OAuth or bot credentials are not configured.",
      503,
      "UNSUPPORTED",
    );
  const state = Buffer.from(
    JSON.stringify({ nonce: secret(), campaignId: c.id, taskId: task.id }),
  ).toString("base64url");
  await db.insert(authChallenges).values({
    id: id(),
    nonceHash: sha256(state),
    address: identity.address,
    chainId: identity.chainId,
    domain: new URL(appUrl()).host,
    expiresAt: new Date(Date.now() + 600000),
    createdAt: now(),
  });
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
  authorize.searchParams.set(
    "redirect_uri",
    `${appUrl()}/api/v1/discord/callback`,
  );
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  return Response.json({ url: authorize.toString() });
}
