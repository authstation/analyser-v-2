import { z } from "@/framework/facade.js";

export const PlansItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  durationDays: z.number(),
  maxCircles: z.number(),
  isActive: z.boolean(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional()
});

export const CreatePlansSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0).default(0),
  durationDays: z.number().min(1).default(30),
  maxCircles: z.number().min(1).default(1)
});

export const UpdatePlansSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  durationDays: z.number().min(1).optional(),
  maxCircles: z.number().min(1).optional(),
  isActive: z.boolean().optional()
});

export const PlansIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const PlansListResponseSchema = z.object({
  message: z.string(),
  data: z.array(PlansItemSchema)
});

export const PlansResponseSchema = z.object({
  message: z.string(),
  data: PlansItemSchema
});

export const PlansMessageSchema = z.object({
  message: z.string()
});
