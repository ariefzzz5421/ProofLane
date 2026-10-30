import { cookies } from "next/headers";
import { z } from "zod";
import { adminMember, jsonError, parseJson, safeOrigin } from "@/lib/core";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return jsonError("Invalid origin.", 403);
  const input = z
    .object({ organizationId: z.string().uuid() })
    .safeParse(await parseJson(req));
  if (!input.success) return jsonError("Invalid organization.");
  if (!(await adminMember(input.data.organizationId)))
    return jsonError("Forbidden.", 403);
  (await cookies()).set("qk_org", input.data.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return Response.json({ ok: true });
}
