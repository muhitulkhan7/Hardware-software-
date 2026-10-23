import { NextResponse } from "next/server";
import { receiveStockSchema } from "@/schemas/receiving";
import { requireRole } from "@/server/auth/guard";
import { receiveStock } from "@/server/services/receiving";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const parsed = receiveStockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the receiving details." }, { status: 400 });
  const result = receiveStock(parsed.data, session.data.id);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
