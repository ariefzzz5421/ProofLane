import { campaignById } from "@/lib/campaign";
import {
  jsonError,
  parseJson,
  rateLimit,
  safeOrigin,
  wallet,
} from "@/lib/core";
import { registerApplication } from "@/lib/registration";
import { z } from "zod";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!safeOrigin(req) || !(await rateLimit(req, "application", 15)))
    return jsonError("Request blocked.", 429);
  const campaign = await campaignById((await params).id);
  if (!campaign) return jsonError("Campaign not found.", 404);
  const identity = await wallet();
  if (!identity || identity.chainId !== campaign.chainId)
    return jsonError(
      "Authenticate the campaign wallet first.",
      401,
      "WALLET_REQUIRED",
    );
  const input = z
    .object({ idempotencyKey: z.string().min(8).max(128).optional() })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid idempotency key.");
  const result = await registerApplication({
    campaignId: campaign.id,
    walletId: identity.id,
    address: identity.address,
    chainId: identity.chainId,
    idempotencyKey: input.data.idempotencyKey,
  });
  if (!result.ok)
    return jsonError(
      result.message,
      result.code === "FULL" ? 409 : 400,
      result.code,
    );
  return Response.json(
    {
      applicationId: result.applicationId,
      status: "accepted",
      duplicate: result.duplicate,
    },
    { status: result.duplicate ? 200 : 201 },
  );
}
