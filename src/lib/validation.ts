import { z } from "zod";
import { config } from "@/lib/config";

export const createUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif"]),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(config.upload.maxFileSizeBytes),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Consent to process this photo is required." }),
  }),
  ageConfirmed18: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you are 18 or older." }),
  }),
});

export const createGenerationSchema = z.object({
  uploadId: z.string().min(1),
  styleId: z.string().min(1),
  userNote: z.string().max(config.userNoteMaxLength).optional().nullable(),
});

export const addToCartSchema = z.object({
  generationId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const shippingAddressSchema = z.object({
  name: z.string().min(1).max(200),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional().nullable(),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(2).max(2), // ISO 3166-1 alpha-2
  email: z.string().email(),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
});
