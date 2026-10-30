import { createPublicClient, http, parseAbi, type Hex } from "viem";
import { eq, and } from "drizzle-orm";
import { db, client } from "./db";
import {
  campaignTasks,
  taskVerifications,
  verificationEvidence,
} from "./db/schema";
import { id, now, monthKey } from "./core";
import { queueEvent } from "./webhooks";

type Task = typeof campaignTasks.$inferSelect;
export type Check = {
  status: "verified" | "pending" | "rejected" | "unsupported";
  detail: string;
  evidence?: string;
};
const hexAddress = (v: unknown): v is `0x${string}` =>
  typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

export async function checkTask(
  task: Task,
  walletAddress: string,
  evidence?: string,
): Promise<Check> {
  const config: Record<string, unknown> = JSON.parse(task.config);
  if (task.type === "wallet")
    return {
      status: "verified",
      detail: "Authenticated EVM wallet signature.",
    };
  if (task.type === "manual")
    return evidence && evidence.trim().length >= 3 && evidence.length <= 2000
      ? {
          status: "pending",
          detail: "Evidence submitted for administrator review.",
          evidence: evidence.trim(),
        }
      : {
          status: "rejected",
          detail: "Provide evidence between 3 and 2000 characters.",
        };
  if (task.type === "discord")
    return {
      status: "unsupported",
      detail:
        "Discord OAuth and bot credentials are not configured for this campaign.",
    };
  if (task.type === "x")
    return {
      status: "unsupported",
      detail:
        "Official X API permissions are not configured. No social action is automatically verified.",
    };
  if (task.type === "custom")
    return {
      status: "pending",
      detail: "Awaiting signed project backend verification.",
    };
  const chainId = Number(config.chainId);
  const rpc = process.env[`RPC_URL_${chainId}`];
  if (!rpc)
    return {
      status: "unsupported",
      detail: `RPC_URL_${chainId} is not configured.`,
    };
  if (!hexAddress(config.contract))
    return {
      status: "unsupported",
      detail: "Task contract is not configured.",
    };
  const contract = config.contract;
  const publicClient = createPublicClient({
    transport: http(rpc, { timeout: 10000 }),
  });
  try {
    if ((await publicClient.getChainId()) !== chainId)
      return {
        status: "unsupported",
        detail: "Configured RPC returned a different chain.",
      };
    if (task.type === "token" || task.type === "nft") {
      const balance = await publicClient.readContract({
        address: contract,
        abi: parseAbi([
          "function balanceOf(address owner) view returns (uint256)",
        ]),
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      });
      const minimum = BigInt(String(config.minimum || "1"));
      return balance >= minimum
        ? {
            status: "verified",
            detail: `On-chain balance ${balance.toString()} meets minimum ${minimum.toString()}.`,
          }
        : {
            status: "rejected",
            detail: "Required on-chain balance was not found.",
          };
    }
    if (task.type === "transaction") {
      if (!evidence || !/^0x[0-9a-fA-F]{64}$/.test(evidence))
        return {
          status: "rejected",
          detail: "A transaction hash is required.",
        };
      const hash = evidence as Hex;
      const [transaction, receipt, block] = await Promise.all([
        publicClient.getTransaction({ hash }),
        publicClient.getTransactionReceipt({ hash }),
        publicClient.getBlockNumber(),
      ]);
      const confirmations = Math.max(1, Number(config.confirmations || 12));
      if (
        transaction.from.toLowerCase() !== walletAddress.toLowerCase() ||
        transaction.to?.toLowerCase() !== contract.toLowerCase() ||
        receipt.status !== "success"
      )
        return {
          status: "rejected",
          detail: "Transaction sender, contract or execution does not match.",
        };
      if (block - receipt.blockNumber + 1n < BigInt(confirmations))
        return {
          status: "pending",
          detail: `Waiting for ${confirmations} confirmations.`,
          evidence: hash,
        };
      if (
        config.eventTopic &&
        !receipt.logs.some(
          (log) =>
            log.address.toLowerCase() === contract.toLowerCase() &&
            log.topics[0]?.toLowerCase() ===
              String(config.eventTopic).toLowerCase(),
        )
      )
        return {
          status: "rejected",
          detail: "Required event was not emitted.",
        };
      return {
        status: "verified",
        detail: "Transaction and confirmations verified on-chain.",
        evidence: hash,
      };
    }
    return { status: "unsupported", detail: "Unknown task type." };
  } catch {
    return {
      status: "pending",
      detail: "RPC verification failed. Retry when the provider is available.",
    };
  }
}

export async function saveVerification(
  task: Task,
  walletId: string,
  result: Check,
) {
  const existing = await db.query.taskVerifications.findFirst({
    where: and(
      eq(taskVerifications.taskId, task.id),
      eq(taskVerifications.walletIdentityId, walletId),
    ),
  });
  const verificationId = existing?.id || id();
  await db
    .insert(taskVerifications)
    .values({
      id: verificationId,
      organizationId: task.organizationId,
      campaignId: task.campaignId,
      taskId: task.id,
      walletIdentityId: walletId,
      status: result.status,
      detail: result.detail,
      verifiedAt: result.status === "verified" ? now() : null,
      createdAt: now(),
    })
    .onConflictDoUpdate({
      target: [taskVerifications.taskId, taskVerifications.walletIdentityId],
      set: {
        status: result.status,
        detail: result.detail,
        verifiedAt: result.status === "verified" ? now() : null,
      },
    });
  if (result.evidence)
    await db.insert(verificationEvidence).values({
      id: id(),
      organizationId: task.organizationId,
      verificationId,
      kind: task.type === "transaction" ? "tx_hash" : "submission",
      value: result.evidence,
      createdAt: now(),
    });
  await client.execute({
    sql: "INSERT INTO usage_counters (organization_id,month,applicants,verifications,api_calls) VALUES (?,?,0,1,0) ON CONFLICT(organization_id,month) DO UPDATE SET verifications=verifications+1",
    args: [task.organizationId, monthKey()],
  });
  if (result.status === "verified" || result.status === "rejected")
    await queueEvent(task.organizationId, `task.${result.status}`, {
      campaignId: task.campaignId,
      taskId: task.id,
      walletIdentityId: walletId,
    });
  return verificationId;
}
