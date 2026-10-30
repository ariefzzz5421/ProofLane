import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  issueSession,
  jsonError,
  parseJson,
  rateLimit,
  safeOrigin,
} from "@/lib/core";

export async function POST(req: Request) {
  if (!safeOrigin(req) || !(await rateLimit(req, "admin-login", 10, 900)))
    return jsonError("Request blocked.", 429);
  const parsed = z
    .object({ email: z.email(), password: z.string() })
    .safeParse(await parseJson(req));
  if (!parsed.success) return jsonError("Invalid credentials.", 401);
  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email.toLowerCase()),
  });
  if (!user || !(await compare(parsed.data.password, user.passwordHash)))
    return jsonError("Invalid credentials.", 401);
  await issueSession("admin", user.id);
  return Response.json({ ok: true });
}
