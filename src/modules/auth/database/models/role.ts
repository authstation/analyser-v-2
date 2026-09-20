import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

