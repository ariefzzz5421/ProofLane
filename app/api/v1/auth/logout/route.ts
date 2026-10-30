import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { session, safeOrigin, jsonError } from "@/lib/core";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const current = await session("wallet");
  if (current) await db.delete(sessions).where(eq(sessions.id, current.id));
  (await cookies()).delete("qk_wallet");
  return Response.json({ ok: true });
}
