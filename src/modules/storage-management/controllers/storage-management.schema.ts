import { z } from "@/framework/facade.js";

export const StorageManagementItemSchema = z.object({
  id: z.number(),
  name: z.string()
});

export const CreateStorageManagementSchema = z.object({
  name: z.string().min(1)
});

export const UpdateStorageManagementSchema = z.object({
  name: z.string().min(1)
});

export const StorageManagementIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const StorageManagementListResponseSchema = z.object({
  message: z.string(),
  data: z.array(StorageManagementItemSchema)
});

export const StorageManagementResponseSchema = z.object({
  message: z.string(),
  data: StorageManagementItemSchema
});

export const StorageManagementMessageSchema = z.object({
  message: z.string()
});
