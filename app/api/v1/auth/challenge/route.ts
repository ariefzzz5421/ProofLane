import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { getAddress } from "viem";
import { z } from "zod";
import { db } from "@/lib/db";
import { authChallenges } from "@/lib/db/schema";
import {
  appUrl,
  id,
  jsonError,
  now,
  parseJson,
  rateLimit,
  safeOrigin,
  sha256,
} from "@/lib/core";

export async function POST(req: Request) {
  if (!safeOrigin(req) || !(await rateLimit(req, "challenge", 15)))
    return jsonError("Request blocked.", 429);
  const parsed = z
    .object({ address: z.string(), chainId: z.number().int().positive() })
    .safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("Invalid wallet or chain.");
  let address: `0x${string}`;
  try {
    address = getAddress(parsed.data.address) as `0x${string}`;
  } catch {
    return jsonError("Invalid EVM address.");
  }
  const base = new URL(appUrl());
  const nonce = generateSiweNonce();
  const expiresAt = new Date(Date.now() + 5 * 60000);
  await db.insert(authChallenges).values({
    id: id(),
    nonceHash: sha256(nonce),
    address: address.toLowerCase(),
    chainId: parsed.data.chainId,
    domain: base.host,
    expiresAt,
    createdAt: now(),
  });
  const message = createSiweMessage({
    address,
    chainId: parsed.data.chainId,
    domain: base.host,
    uri: base.origin,
    version: "1",
    nonce,
    issuedAt: new Date(),
    expirationTime: expiresAt,
    statement:
      "Sign in to QuestKernel. No transaction or token approval is requested.",
  });
  return Response.json({ message, expiresAt: expiresAt.toISOString() });
}
