import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { ibasOffices } from '@/modules/settings/database/models/settings.js';
import { users } from '@/modules/auth/database/models/user.js';

export const ibasData = pgTable('ibas_data', {
  id: serial('id').primaryKey(),
  date: timestamp('date'),
  item: text('item').notNull(),
  rawOffice: text('raw_office').notNull(),
  officeId: integer('office_id').references(() => ibasOffices.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  tempId: text('temp_id'),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow()
});
