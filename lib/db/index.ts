import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:local.db";
if (process.env.VERCEL && url.startsWith("file:"))
  throw new Error("Production requires a persistent Turso DATABASE_URL.");
export const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});
export const db = drizzle(client, { schema });
