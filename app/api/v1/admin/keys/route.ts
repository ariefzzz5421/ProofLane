import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, auditLogs } from "@/lib/db/schema";
import {
  adminMember,
  id,
  jsonError,
  now,
  parseJson,
  safeOrigin,
  secret,
  sha256,
} from "@/lib/core";
const scopes = [
  "campaigns:read",
  "campaigns:write",
  "tasks:write",
  "stats:read",
  "applicants:read",
  "verifications:write",
] as const;
export async function GET() {
  const member = await adminMember();
  if (!member) return jsonError("Forbidden.", 403);
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organizationId, member.organizationId));
  return Response.json({ keys: rows });
}
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const member = await adminMember(undefined, "admin");
  if (!member) return jsonError("Forbidden.", 403);
  const input = z
    .object({
      name: z.string().min(2).max(80),
      scopes: z.array(z.enum(scopes)).min(1),
    })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid key request.");
  const raw = `qk_${secret()}`;
  const keyId = id();
  await db.insert(apiKeys).values({
    id: keyId,
    organizationId: member.organizationId,
    name: input.data.name,
    prefix: raw.slice(0, 15),
    secretHash: sha256(raw),
    scopes: input.data.scopes.join(","),
    createdAt: now(),
  });
  await db.insert(auditLogs).values({
    id: id(),
    organizationId: member.organizationId,
    actor: member.userId,
    action: "api_key.created",
    targetId: keyId,
    createdAt: now(),
  });
  return Response.json({ id: keyId, key: raw }, { status: 201 });
}
