import { getSession, type SessionUser } from "./session";
import type { ServiceResult } from "@/server/services/result";

export async function requireSession(): Promise<ServiceResult<SessionUser>> {
  const session = await getSession();
  return session
    ? { ok: true, data: session }
    : { ok: false, code: "FORBIDDEN", message: "You must be signed in." };
}

export async function requireRole(role: "ADMIN" | "CASHIER"): Promise<ServiceResult<SessionUser>> {
  const result = await requireSession();
  if (!result.ok) return result;
  if (result.data.role !== role && role === "ADMIN") {
    return { ok: false, code: "FORBIDDEN", message: "Administrator access is required." };
  }
  return result;
}
