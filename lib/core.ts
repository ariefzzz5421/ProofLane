import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db, client } from "./db";
import {
  apiKeys,
  organizationMembers,
  sessions,
  walletIdentities,
} from "./db/schema";

export const id = () => randomUUID();
export const now = () => new Date();
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export const addressKey = (address: string) => address.toLowerCase();
export const monthKey = () => new Date().toISOString().slice(0, 7);
export const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const jsonError = (
  message: string,
  status = 400,
  code = "BAD_REQUEST",
) => Response.json({ error: { code, message } }, { status });
export const parseJson = async (req: Request) => {
  try {
    return (await req.json()) as unknown;
  } catch {
    return null;
  }
};

export async function issueSession(
  kind: "admin" | "wallet",
  subjectId: string,
) {
  const token = secret();
  await db.insert(sessions).values({
    id: id(),
    tokenHash: sha256(token),
    kind,
    userId: kind === "admin" ? subjectId : null,
    walletIdentityId: kind === "wallet" ? subjectId : null,
    expiresAt: new Date(Date.now() + (kind === "admin" ? 7 : 1) * 86400000),
    createdAt: now(),
  });
  (await cookies()).set(kind === "admin" ? "qk_admin" : "qk_wallet", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: (kind === "admin" ? 7 : 1) * 86400,
  });
}

export async function session(kind: "admin" | "wallet") {
  const token = (await cookies()).get(
    kind === "admin" ? "qk_admin" : "qk_wallet",
  )?.value;
  if (!token) return null;
  const row = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, sha256(token)),
      eq(sessions.kind, kind),
      gt(sessions.expiresAt, now()),
    ),
  });
  return row || null;
}

export async function adminMember(
  organizationId?: string,
  need: "viewer" | "admin" = "viewer",
) {
  const auth = await session("admin");
  if (!auth?.userId) return null;
  const rows = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, auth.userId));
  const preferred = organizationId || (await cookies()).get("qk_org")?.value;
  const selected = rows.find((row) => row.organizationId === preferred);
  if (selected)
    return need === "viewer" || selected.role !== "viewer" ? selected : null;
  if (organizationId) return null;
  return rows.find((row) => need === "viewer" || row.role !== "viewer") || null;
}

export async function wallet() {
  const auth = await session("wallet");
  if (!auth?.walletIdentityId) return null;
  return (
    db.query.walletIdentities.findFirst({
      where: eq(walletIdentities.id, auth.walletIdentityId),
    }) || null
  );
}

export async function apiKey(
  req: Request,
  organizationId: string,
  scope: string,
) {
  const raw =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!raw.startsWith("qk_")) return false;
  const prefix = raw.slice(0, 15);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.organizationId, organizationId),
        eq(apiKeys.prefix, prefix),
      ),
    );
  const valid = rows.some(
    (row) =>
      !row.revokedAt &&
      row.scopes.split(",").includes(scope) &&
      timingSafeEqual(
        Buffer.from(row.secretHash, "hex"),
        Buffer.from(sha256(raw), "hex"),
      ),
  );
  if (valid)
    await client.execute({
      sql: "INSERT INTO usage_counters (organization_id,month,applicants,verifications,api_calls) VALUES (?,?,0,0,1) ON CONFLICT(organization_id,month) DO UPDATE SET api_calls=api_calls+1",
      args: [organizationId, monthKey()],
    });
  return valid;
}

export async function adminOrKey(
  req: Request,
  organizationId: string,
  scope: string,
  write = false,
) {
  if (await adminMember(organizationId, write ? "admin" : "viewer"))
    return true;
  return apiKey(req, organizationId, scope);
}

export async function rateLimit(
  req: Request,
  bucket: string,
  max: number,
  windowSeconds = 60,
) {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const key = sha256(`${bucket}:${ip}`);
  const reset = Date.now() + windowSeconds * 1000;
  await client.execute({
    sql: `INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at < ? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at < ? THEN ? ELSE reset_at END`,
    args: [key, reset, Date.now(), Date.now(), reset],
  });
  const row = await client.execute({
    sql: "SELECT count FROM rate_limits WHERE key=?",
    args: [key],
  });
  return Number(row.rows[0]?.count || 0) <= max;
}

export function safeOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(appUrl()).origin;
  } catch {
    return false;
  }
}
