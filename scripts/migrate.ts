import "dotenv/config";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "../lib/db";
async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  if ((process.env.DATABASE_URL || "file:local.db").startsWith("file:"))
    await client.execute("PRAGMA journal_mode=WAL");
  console.log("Migrations applied.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
