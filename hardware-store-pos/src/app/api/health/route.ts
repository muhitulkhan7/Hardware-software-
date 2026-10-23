import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

export async function GET(): Promise<NextResponse> {
  try {
    await db.run(sql`select 1`);
    return NextResponse.json({ ok: true, data: { status: "healthy" } });
  } catch {
    return NextResponse.json({ ok: false, code: "DATABASE_UNAVAILABLE", message: "Database is unavailable." }, { status: 503 });
  }
}
