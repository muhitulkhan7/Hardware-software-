import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return NextResponse.json({ ok: true, data: session });
}
