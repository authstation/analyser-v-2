import { relations } from "drizzle-orm";
import { pgTable, serial, text, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

export const letterTemplates = pgTable("letter_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").default("non-filer-notice").notNull(),
  description: text("description"),
  subject: text("subject"),
  reference: text("reference"),
  officeName: text("office_name"),
  officeAddress: text("office_address"),
  officeEmail: text("office_email"),
  defaultFileNo: text("default_file_no"),
  secondaryLogo: text("secondary_logo"),
  bodyHtml: text("body_html").notNull(),
  signatoryTitle: text("signatory_title"),
  signatorySubtitle: text("signatory_subtitle"),
  ccSignatoryTitle: text("cc_signatory_title"),
  ccSignatorySubtitle: text("cc_signatory_subtitle"),
  ccItems: jsonb("cc_items").$type<any[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const userLetterDrafts = pgTable("user_letter_drafts", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => letterTemplates.id, { onDelete: "set null" }),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  entityBin: text("entity_bin"),
  customData: jsonb("custom_data")
    .$type<{
      officeName?: string;
      officeAddress?: string;
      officeEmail?: string;
      defaultFileNo?: string;
      secondaryLogo?: string;
      fileNo?: string;
      letterDate?: string;
      subject?: string;
      reference?: string;
      bodyHtml?: string;
      signatoryName?: string;
      signatoryDesignation?: string;
      signatoryDepartment?: string;
      recipientName?: string;
      recipientAddress?: string;
      recipientBin?: string;
      includeCc?: boolean;
      ccHeading?: string;
      ccItems?: any[];
      ccSignatoryName?: string;
      ccSignatoryDesignation?: string;
    }>()
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const letterTemplatesRelations = relations(letterTemplates, ({ many }) => ({
  drafts: many(userLetterDrafts)
}));

export const userLetterDraftsRelations = relations(userLetterDrafts, ({ one }) => ({
  template: one(letterTemplates, {
    fields: [userLetterDrafts.templateId],
    references: [letterTemplates.id]
  }),
  user: one(users, {
    fields: [userLetterDrafts.userId],
    references: [users.id]
  })
}));
