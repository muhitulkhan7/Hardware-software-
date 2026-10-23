import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

const databasePath = process.env.DATABASE_PATH ?? "./data/hardware-store.db";
fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: databasePath },
});
