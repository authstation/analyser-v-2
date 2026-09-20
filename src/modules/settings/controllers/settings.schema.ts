import { z } from "@/framework/facade.js";

export const SettingsItemSchema = z.object({
  id: z.number(),
  name: z.string()
});

export const CreateSettingsSchema = z.object({
  name: z.string().min(1)
});

export const UpdateSettingsSchema = z.object({
  name: z.string().min(1)
});

export const SettingsIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const SettingsListResponseSchema = z.object({
  message: z.string(),
  data: z.array(SettingsItemSchema)
});

export const SettingsResponseSchema = z.object({
  message: z.string(),
  data: SettingsItemSchema
});

export const SettingsMessageSchema = z.object({
  message: z.string()
});

