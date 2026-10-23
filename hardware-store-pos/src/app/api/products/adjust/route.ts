import { NextResponse } from "next/server";
import { adjustStockSchema } from "@/schemas/product";
import { requireRole } from "@/server/auth/guard";
import { adjustStock } from "@/server/services/stock";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = adjustStockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the adjustment details." }, { status: 400 });
  const result = adjustStock(parsed.data, session.data.id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400 });
}
