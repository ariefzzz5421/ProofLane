import { verifyMessage } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authChallenges, walletIdentities } from "@/lib/db/schema";
import {
  addressKey,
  appUrl,
  id,
  issueSession,
  jsonError,
  now,
  parseJson,
  rateLimit,
  safeOrigin,
  sha256,
} from "@/lib/core";

export async function POST(req: Request) {
  if (!safeOrigin(req) || !(await rateLimit(req, "verify-siwe", 20)))
    return jsonError("Request blocked.", 429);
  const parsed = z
    .object({
      message: z.string().max(3000),
      signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
    })
    .safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("Invalid signature request.");
  let siwe;
  try {
    siwe = parseSiweMessage(parsed.data.message);
  } catch {
    return jsonError("Malformed SIWE message.", 400);
  }
  if (
    !siwe.address ||
    !siwe.nonce ||
    !siwe.chainId ||
    siwe.domain !== new URL(appUrl()).host ||
    siwe.uri !== new URL(appUrl()).origin ||
    siwe.version !== "1"
  )
    return jsonError("SIWE domain, chain or nonce is invalid.", 401);
  const challenge = await db.query.authChallenges.findFirst({
    where: and(
      eq(authChallenges.nonceHash, sha256(siwe.nonce)),
      eq(authChallenges.address, addressKey(siwe.address)),
      eq(authChallenges.chainId, siwe.chainId),
      eq(authChallenges.domain, siwe.domain),
      gt(authChallenges.expiresAt, now()),
      isNull(authChallenges.consumedAt),
    ),
  });
  if (!challenge) return jsonError("Challenge expired or already used.", 401);
  const valid = await verifyMessage({
    address: siwe.address as `0x${string}`,
    message: parsed.data.message,
    signature: parsed.data.signature as `0x${string}`,
  }).catch(() => false);
  if (!valid) return jsonError("Signature verification failed.", 401);
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
  if (consumed.length !== 1) return jsonError("Challenge already used.", 401);
  await db
    .insert(walletIdentities)
    .values({
      id: id(),
      chainId: siwe.chainId,
      address: addressKey(siwe.address),
      createdAt: now(),
    })
    .onConflictDoNothing();
  const identity = await db.query.walletIdentities.findFirst({
    where: and(
      eq(walletIdentities.chainId, siwe.chainId),
      eq(walletIdentities.address, addressKey(siwe.address)),
    ),
  });
  if (!identity) return jsonError("Wallet identity could not be stored.", 500);
  await issueSession("wallet", identity.id);
  return Response.json({
    address: identity.address,
    chainId: identity.chainId,
  });
}
