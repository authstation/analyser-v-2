import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '@/modules/auth/database/models/user.js';
import { divisions, circles, policeStations } from '@/modules/settings/database/models/settings.js';

export const columnMappings = pgTable('column_mappings', {
  id: serial('id').primaryKey(),
  module: text('module').default('bin_analyser').notNull(),
  excelHeader: text('excel_header').notNull(),
  dbColumn: text('db_column').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const binData = pgTable('bin_data', {
  id: serial('id').primaryKey(),
  bin: text('bin').unique(),
  entityName: text('entity_name'),
  binIssueDate: timestamp('bin_issue_date'),
  binStatus: text('bin_status').default('Active'),
  forcedRegistration: text('forced_registration'),
  majorAreaOfEconomicActivity: text('major_area'),
  areasOfManufacturing: text('manufacturing_area'),
  areasOfService: text('service_area'),
  email: text('email'),
  mobile: text('mobile'),
  address: text('address'),
  hqAddress: text('hq_address'),
  circleId: integer('circle_id').references(() => circles.id),
  divisionId: integer('division_id').references(() => divisions.id),
  policeStationId: integer('police_station_id').references(() => policeStations.id),
  eTin: text('e_tin'),
  rawJson: text('raw_json'), // stores unmapped extra data
  uploadedBy: integer('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  circleIdIdx: index('bin_data_circle_id_idx').on(t.circleId),
  policeStationIdIdx: index('bin_data_police_station_id_idx').on(t.policeStationId),
  divisionIdIdx: index('bin_data_division_id_idx').on(t.divisionId),
  binStatusIdx: index('bin_data_bin_status_idx').on(t.binStatus),
  forcedRegIdx: index('bin_data_forced_reg_idx').on(t.forcedRegistration),
  majorAreaIdx: index('bin_data_major_area_idx').on(t.majorAreaOfEconomicActivity),
  binIssueDateIdx: index('bin_data_bin_issue_date_idx').on(t.binIssueDate),
}));

export const binDataRelations = relations(binData, ({ one }) => ({
  division: one(divisions, {
    fields: [binData.divisionId],
    references: [divisions.id]
  }),
  circle: one(circles, {
    fields: [binData.circleId],
    references: [circles.id]
  }),
  policeStation: one(policeStations, {
    fields: [binData.policeStationId],
    references: [policeStations.id]
  }),
  uploader: one(users, {
    fields: [binData.uploadedBy],
    references: [users.id]
  })
}));
