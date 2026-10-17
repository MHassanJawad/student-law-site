// Validate the editable fields of a personal saved citation.
import { z } from "zod";

export const SAVED_UPDATE_SCHEMA = z.object({
  note: z.string().trim().max(2000).nullable().optional(),
  folder: z.string().trim().max(80).nullable().optional(),
}).strict().refine((value) => value.note !== undefined || value.folder !== undefined);

/** Turns cleared text fields into null without changing omitted fields. */
export function normalizeSavedUpdate(value: z.infer<typeof SAVED_UPDATE_SCHEMA>) {
  return {
    ...(value.note !== undefined ? { note: value.note || null } : {}),
    ...(value.folder !== undefined ? { folder: value.folder || null } : {}),
  };
}
