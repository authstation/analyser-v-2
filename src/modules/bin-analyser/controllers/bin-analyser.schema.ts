import { z } from "@/framework/facade.js";

export const BinAnalyserItemSchema = z.object({
  id: z.number(),
  name: z.string()
});

export const CreateBinAnalyserSchema = z.object({
  name: z.string().min(1)
});

export const UpdateBinAnalyserSchema = z.object({
  name: z.string().min(1)
});

export const BinAnalyserIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const BinAnalyserListResponseSchema = z.object({
  message: z.string(),
  data: z.array(BinAnalyserItemSchema)
});

export const BinAnalyserResponseSchema = z.object({
  message: z.string(),
  data: BinAnalyserItemSchema
});

export const BinAnalyserMessageSchema = z.object({
  message: z.string()
});

