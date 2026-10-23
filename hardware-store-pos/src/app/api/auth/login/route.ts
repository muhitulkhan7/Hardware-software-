import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { loginSchema } from "@/schemas/auth";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";

export async function POST(request: Request): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, code: "VALIDATION", message: "Enter a valid email and password." }, { status: 400 });

  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, passwordHash: users.passwordHash, isActive: users.isActive })
    .from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || !user.isActive || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }, { status: 401 });
  }

  await createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
}
