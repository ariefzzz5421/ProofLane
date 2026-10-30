import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authChallenges, campaignTasks } from "@/lib/db/schema";
import { campaignById } from "@/lib/campaign";
import { appUrl, now, sha256, wallet } from "@/lib/core";
import { saveVerification } from "@/lib/verification";
const stateSchema = z.object({
  nonce: z.string(),
  campaignId: z.string().uuid(),
  taskId: z.string().uuid(),
});
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  let parsed;
  try {
    parsed = stateSchema.parse(
      JSON.parse(Buffer.from(state, "base64url").toString("utf8")),
    );
  } catch {
    return new Response("Invalid OAuth state.", { status: 400 });
  }
  const identity = await wallet();
  const c = await campaignById(parsed.campaignId);
  if (!identity || !c || identity.chainId !== c.chainId)
    return new Response("Wallet session expired.", { status: 401 });
  const challenge = await db.query.authChallenges.findFirst({
    where: and(
      eq(authChallenges.nonceHash, sha256(state)),
      eq(authChallenges.address, identity.address),
      eq(authChallenges.chainId, identity.chainId),
      eq(authChallenges.domain, new URL(appUrl()).host),
      gt(authChallenges.expiresAt, now()),
      isNull(authChallenges.consumedAt),
    ),
  });
  if (!challenge)
    return new Response("OAuth state expired or replayed.", { status: 401 });
  const consumed = await db
    .update(authChallenges)
    .set({ consumedAt: now() })
    .where(
      and(
        eq(authChallenges.id, challenge.id),
        isNull(authChallenges.consumedAt),
      ),
    )
    .returning({ id: authChallenges.id });
  if (!consumed.length)
    return new Response("OAuth state replayed.", { status: 401 });
  const task = await db.query.campaignTasks.findFirst({
    where: and(
      eq(campaignTasks.id, parsed.taskId),
      eq(campaignTasks.campaignId, c.id),
    ),
  });
  if (task?.type !== "discord")
    return new Response("Discord task not found.", { status: 404 });
  const back = (result: string) =>
    Response.redirect(`${appUrl()}/c/${c.slug}?discord=${result}`);
  if (url.searchParams.get("error") || !url.searchParams.get("code"))
    return back("cancelled");
  const config = JSON.parse(task.config) as { guildId?: string };
  if (
    !config.guildId ||
    !/^\d{5,25}$/.test(config.guildId) ||
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_BOT_TOKEN
  )
    return back("unsupported");
  try {
    const tokenResponse = await fetch(
      "https://discord.com/api/v10/oauth2/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: url.searchParams.get("code")!,
          redirect_uri: `${appUrl()}/api/v1/discord/callback`,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!tokenResponse.ok) return back("error");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) return back("error");
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return back("error");
    const user = (await userResponse.json()) as { id?: string };
    if (!user.id || !/^\d{5,25}$/.test(user.id)) return back("error");
    const member = await fetch(
      `https://discord.com/api/v10/guilds/${config.guildId}/members/${user.id}`,
      {
        headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    const status = member.ok
      ? "verified"
      : member.status === 404
        ? "rejected"
        : "pending";
    await saveVerification(task, identity.id, {
      status,
      detail:
        status === "verified"
          ? "Discord guild membership verified via authorized OAuth and bot API."
          : status === "rejected"
            ? "Discord user is not a member of the configured guild."
            : "Discord membership API unavailable; retry later.",
      evidence: user.id,
    });
    return back(status);
  } catch {
    return back("error");
  }
}
