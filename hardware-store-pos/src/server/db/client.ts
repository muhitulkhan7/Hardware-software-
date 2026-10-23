import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH ?? "./data/hardware-store.db";
const databaseDirectory = path.dirname(path.resolve(databasePath));
fs.mkdirSync(databaseDirectory, { recursive: true });
const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
