import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  durationDays: integer("duration_days").notNull().default(30),
  maxCircles: integer("max_circles").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
