import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

export const storageBackups = pgTable("storage_backups", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
