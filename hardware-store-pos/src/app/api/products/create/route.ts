import { NextResponse } from "next/server";
import { createProductSchema } from "@/schemas/product";
import { requireRole } from "@/server/auth/guard";
import { createProduct } from "@/server/services/product";

export async function POST(request: Request): Promise<NextResponse> {
  const session = await requireRole("ADMIN");
  if (!session.ok) return NextResponse.json(session, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Check the product details." }, { status: 400 });
  const result = createProduct(parsed.data, session.data.id);
  return NextResponse.json(result, { status: result.ok ? 201 : 400 });
}
