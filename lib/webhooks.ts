import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { webhookEndpoints, webhookDeliveries } from "./db/schema";
import { id, now } from "./core";

const blocked = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, bits, "ipv4");
for (const [address, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["::ffff:0:0", 96],
] as const)
  blocked.addSubnet(address, bits, "ipv6");
export async function publicWebhookUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local")
  )
    throw new Error("Webhook requires a public HTTPS hostname on port 443.");
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) =>
      blocked.check(item.address, item.family === 4 ? "ipv4" : "ipv6"),
    )
  )
    throw new Error(
      "Webhook hostname resolves to a private or reserved address.",
    );
  return url.toString();
}
async function publicWebhookAddress(hostname: string) {
  const addresses = await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) =>
      blocked.check(item.address, item.family === 4 ? "ipv4" : "ipv6"),
    )
  )
    throw new Error(
      "Webhook hostname resolves to a private or reserved address.",
    );
  return addresses[0];
}
function encryptionKey() {
  const key = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error("WEBHOOK_ENCRYPTION_KEY must be 64 hex characters.");
  return Buffer.from(key, "hex");
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}
export function decryptSecret(value: string) {
  const [iv, tag, ciphertext] = value.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
export async function queueEvent(
  organizationId: string,
  event: string,
  data: Record<string, unknown>,
) {
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.organizationId, organizationId),
        eq(webhookEndpoints.active, true),
      ),
    );
  const payload = JSON.stringify({
    id: id(),
    event,
    createdAt: new Date().toISOString(),
    data,
  });
  for (const endpoint of endpoints) {
    if (!JSON.parse(endpoint.events).includes(event)) continue;
    await db.insert(webhookDeliveries).values({
      id: id(),
      organizationId,
      endpointId: endpoint.id,
      event,
      payload,
      nextAttemptAt: now(),
      createdAt: now(),
    });
  }
}
export async function deliverWebhook(
  delivery: typeof webhookDeliveries.$inferSelect,
  endpoint: typeof webhookEndpoints.$inferSelect,
) {
  const url = new URL(await publicWebhookUrl(endpoint.url));
  const address = await publicWebhookAddress(url.hostname);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac(
    "sha256",
    decryptSecret(endpoint.secretEncrypted),
  )
    .update(`${timestamp}.${delivery.payload}`)
    .digest("hex");
  const status = await new Promise<number>((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: address.address,
        servername: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        timeout: 10000,
        headers: {
          host: url.host,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(delivery.payload),
          "x-qk-timestamp": timestamp,
          "x-qk-signature": `v1=${signature}`,
          "x-qk-delivery-id": delivery.id,
          "idempotency-key": delivery.id,
        },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode || 0);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Webhook timed out.")));
    req.on("error", reject);
    req.end(delivery.payload);
  });
  return { ok: status >= 200 && status < 300, status };
}
