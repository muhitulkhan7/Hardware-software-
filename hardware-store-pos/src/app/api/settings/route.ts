import { NextResponse } from "next/server";
import { updateSettingsSchema } from "@/schemas/settings";
import { requireRole, requireSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { updateSettings } from "@/server/services/settings";

export async function GET(): Promise<NextResponse> {
  const session = await requireSession();
  if (!session.ok) return NextResponse.json(session, { status: 401 });
  return NextResponse.json({ ok: true, data: (await db.select().from(settings).limit(1))[0] });
}
export async function PUT(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const parsed = updateSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the settings." }, { status: 400 });
  return NextResponse.json(updateSettings(parsed.data));
}
