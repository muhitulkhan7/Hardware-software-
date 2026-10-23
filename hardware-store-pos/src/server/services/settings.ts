import { eq } from "drizzle-orm";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/schemas/settings";
import { db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import type { ServiceResult } from "./result";

export function updateSettings(input: UpdateSettingsInput): ServiceResult<{ updated: true }> {
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION", message: "Check the settings." };
  db.update(settings).set({ ...parsed.data, updatedAt: new Date().toISOString() }).where(eq(settings.id, 1)).run();
  return { ok: true, data: { updated: true } };
}
