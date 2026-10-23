import { NextResponse } from "next/server";
import { returnItemsSchema } from "@/schemas/return";
import { requireRole } from "@/server/auth/guard";
import { returnItemsForSale } from "@/server/services/return";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const parsed = returnItemsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the return details." }, { status: 400 });
  const result = returnItemsForSale(parsed.data, session.data.id);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
