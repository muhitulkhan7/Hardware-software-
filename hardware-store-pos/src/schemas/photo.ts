import { z } from "zod";

export const photoLookupSchema = z.object({
  image: z.string()
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\s]+$/, "Provide a JPEG, PNG, or WebP image.")
    .max(5_000_000),
});

export const photoChoiceSchema = z.object({
  lookupId: z.number().int().positive(),
  chosenProductId: z.number().int().positive(),
});
