import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, varchar, serial, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "user"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default("user").notNull(),
  planId: integer("plan_id"), // .references(() => plans.id)
  planStartDate: timestamp("plan_start_date"),
  trxId: text("trx_id"),
  paymentStatus: text("payment_status").default("none"),
  hasChangedCircle: boolean("has_changed_circle").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const passwordResetTokens = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onUpdate: "cascade", onDelete: "cascade" }),
  jti: varchar("jti", { length: 191 }).notNull().unique(),
  revoked: boolean("revoked").default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const usersRelations = relations(users, ({ many }) => ({
  // Define relations if needed
}));
