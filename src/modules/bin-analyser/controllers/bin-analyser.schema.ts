import { z } from "@/framework/facade.js";

export const BinFilterOptionsSchema = z.object({
  total: z.number().optional(),
  circles: z.array(z.string()).optional(),
  policeStations: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  forcedRegistrations: z.array(z.string()).optional(),
  majorAreas: z.array(z.string()).optional(),
  mfgAreas: z.array(z.string()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  areaRelations: z.array(z.any()).optional(),
  years: z.array(z.string()).optional(),
});

export const BinStatsResponseSchema = z.object({
  summary: z.object({
    total: z.number(),
    active: z.number(),
    suspended: z.number(),
    forced: z.number(),
    cancelled: z.number(),
  }),
  charts: z.object({
    status: z.array(z.any()),
    majorArea: z.array(z.any()),
    mfgArea: z.array(z.any()),
    srvArea: z.array(z.any()),
    pivot: z.array(z.any()),
    trend: z.array(z.any()),
  }),
});

export const BinListResponseSchema = z.object({
  data: z.array(z.any()),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export const BinMessageResponseSchema = z.object({
  message: z.string().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
  insertedRows: z.number().optional(),
});
