import { z } from "@/framework/facade.js";

export const CcGroupItemSchema = z.object({
  heading: z.string().default(""),
  items: z.array(z.string()).default([])
});

export const LetterTemplateSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  description: z.string().nullable().optional(),
  officeName: z.string().nullable().optional(),
  officeAddress: z.string().nullable().optional(),
  officeEmail: z.string().nullable().optional(),
  defaultFileNo: z.string().nullable().optional(),
  secondaryLogo: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  bodyHtml: z.string(),
  signatoryTitle: z.string().nullable().optional(),
  signatorySubtitle: z.string().nullable().optional(),
  ccSignatoryTitle: z.string().nullable().optional(),
  ccSignatorySubtitle: z.string().nullable().optional(),
  ccItems: z.union([z.array(CcGroupItemSchema), z.array(z.string()), z.array(z.any())]).optional().nullable(),
  isActive: z.boolean(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional()
});

export const CreateLetterTemplateSchema = z.object({
  title: z.string().min(1),
  category: z.string().default("non-filer-notice"),
  description: z.string().optional(),
  officeName: z.string().optional().nullable(),
  officeAddress: z.string().optional().nullable(),
  officeEmail: z.string().optional().nullable(),
  defaultFileNo: z.string().optional().nullable(),
  secondaryLogo: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  bodyHtml: z.string().min(1),
  signatoryTitle: z.string().optional().nullable(),
  signatorySubtitle: z.string().optional().nullable(),
  ccSignatoryTitle: z.string().optional().nullable(),
  ccSignatorySubtitle: z.string().optional().nullable(),
  ccItems: z.union([z.array(CcGroupItemSchema), z.array(z.string()), z.array(z.any())]).optional().nullable(),
  isActive: z.boolean().default(true)
});

export const UpdateLetterTemplateSchema = CreateLetterTemplateSchema.partial();

export const LetterTemplateIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const SaveDraftSchema = z.object({
  templateId: z.number().optional().nullable(),
  entityBin: z.string().optional().nullable(),
  customData: z.record(z.string(), z.any())
});
