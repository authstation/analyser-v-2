import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, timestamp, unique, index, boolean } from 'drizzle-orm/pg-core';
import { users } from '@/modules/auth/database/models/user.js';

export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const circles = pgTable('circles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unqNameDiv: unique().on(t.name, t.divisionId),
}));

export const policeStations = pgTable('police_stations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  circleId: integer('circle_id').references(() => circles.id, { onDelete: 'cascade' }).notNull(),
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unqNameCircle: unique().on(t.name, t.circleId),
}));

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  circleId: integer('circle_id').references(() => circles.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').default('pending').notNull(),
  trxId: text('trx_id'),
  paymentMethod: text('payment_method'),
  isAddon: boolean('is_addon').default(false).notNull(),
  addonPrice: integer('addon_price').default(300).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userCircleStatusIdx: index('subscriptions_user_circle_status_idx').on(t.userId, t.circleId, t.status),
}));

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const itemMappings = pgTable('item_mappings', {
  id: serial('id').primaryKey(),
  moduleName: text('module_name').notNull(),
  itemName: text('item_name').notNull(),
  commonItem: text('common_item').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.moduleName, t.itemName)
}));

export const ibasOffices = pgTable('ibas_offices', {
  id: serial('id').primaryKey(),
  officeName: text('office_name').notNull(),
  areaName: text('area_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});



export const penaltyRules = pgTable('penalty_rules', {
  id: serial('id').primaryKey(),
  amount: integer('amount').notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const divisionRelations = relations(divisions, ({ many }) => ({
  circles: many(circles),
}));

export const circleRelations = relations(circles, ({ one, many }) => ({
  division: one(divisions, {
    fields: [circles.divisionId],
    references: [divisions.id]
  }),
  policeStations: many(policeStations),
  subscriptions: many(subscriptions)
}));

export const policeStationRelations = relations(policeStations, ({ one }) => ({
  circle: one(circles, {
    fields: [policeStations.circleId],
    references: [circles.id]
  }),
  division: one(divisions, {
    fields: [policeStations.divisionId],
    references: [divisions.id]
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id]
  }),
  circle: one(circles, {
    fields: [subscriptions.circleId],
    references: [circles.id]
  })
}));
