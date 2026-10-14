import { z } from "@/framework/facade.js";

export const ReturnFilterOptionsResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    circles: z.array(z.string()).optional(),
    taxPeriods: z.array(z.string()).optional(),
    years: z.array(z.string()).optional(),
    majorAreas: z.array(z.string()).optional(),
    mfgAreas: z.array(z.string()).optional(),
    serviceAreas: z.array(z.string()).optional(),
    areaRelations: z.array(z.any()).optional(),
  }).optional(),
});

export const ReturnAnalyticsResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.object({
    summary: z.record(z.string(), z.any()).optional(),
    charts: z.record(z.string(), z.any()).optional(),
  }).optional(),
});

export const ReturnListResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
});

export const ReturnMessageResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
  insertedRows: z.number().optional(),
  totalRows: z.number().optional(),
  matchedRows: z.number().optional(),
  unmatchedRows: z.number().optional(),
  unmatchedBins: z.number().optional(),
  unmatchedList: z.array(z.any()).optional(),
}).passthrough();
