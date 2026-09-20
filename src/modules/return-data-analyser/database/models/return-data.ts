import { pgTable, serial, text, timestamp, integer, numeric, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { divisions, circles } from '@/modules/settings/database/models/settings.js';
import { users } from '@/modules/auth/database/models/user.js';
import { binData } from '@/modules/bin-analyser/database/models/bin-analyser.js';

export const returnData = pgTable('return_data', {
  id: serial('id').primaryKey(),
  divisionId: integer('division_id').references(() => divisions.id),
  circleId: integer('circle_id').references(() => circles.id),
  bin: text('bin').notNull(),
  submissionId: text('submission_id'),
  taxPeriod: timestamp('tax_period'), // e.g. "August, 2026"
  hasActivities: text('has_activities'), // "Any activities in this Tax Period?"
  totalSalesValue: numeric('total_sales_value', { precision: 20, scale: 2 }),
  totalPayableVat: numeric('total_payable_vat', { precision: 20, scale: 2 }),
  totalPayableSd: numeric('total_payable_sd', { precision: 20, scale: 2 }),
  totalInputTaxCreditValue: numeric('total_input_tax_credit_value', { precision: 20, scale: 2 }),
  totalInputTaxCreditVat: numeric('total_input_tax_credit_vat', { precision: 20, scale: 2 }),
  increasingAdjustment: numeric('increasing_adjustment', { precision: 20, scale: 2 }),
  decreasingAdjustment: numeric('decreasing_adjustment', { precision: 20, scale: 2 }),
  netPayableVat: numeric('net_payable_vat', { precision: 20, scale: 2 }),
  netPayableSd: numeric('net_payable_sd', { precision: 20, scale: 2 }),
  finePenalty: numeric('fine_penalty', { precision: 20, scale: 2 }),
  depositedVat: numeric('deposited_vat', { precision: 20, scale: 2 }),
  depositedSd: numeric('deposited_sd', { precision: 20, scale: 2 }),
  closingBalanceVat: numeric('closing_balance_vat', { precision: 20, scale: 2 }),
  closingBalanceSd: numeric('closing_balance_sd', { precision: 20, scale: 2 }),
  vdsIncreasing: numeric('vds_increasing', { precision: 20, scale: 2 }),
  vdsDecreasing: numeric('vds_decreasing', { precision: 20, scale: 2 }),
  advancedTaxPaid: numeric('advanced_tax_paid', { precision: 20, scale: 2 }),
  submissionDate: text('submission_date'),
  lastAmendmentDate: text('last_amendment_date'),
  rawJson: text('raw_json'),
  uploadedBy: integer('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  binIdx: index('return_data_bin_idx').on(t.bin),
  circleIdIdx: index('return_data_circle_id_idx').on(t.circleId),
  divisionIdIdx: index('return_data_division_id_idx').on(t.divisionId),
  taxPeriodIdx: index('return_data_tax_period_idx').on(t.taxPeriod),
  hasActivitiesIdx: index('return_data_has_activities_idx').on(t.hasActivities),
  // BIN + TaxPeriod একই হলে duplicate হবে না — upsert এ ব্যবহার হবে
  binTaxPeriodUniq: unique('return_data_bin_tax_period_uniq').on(t.bin, t.taxPeriod),
}));

export const returnDataRelations = relations(returnData, ({ one }) => ({
  division: one(divisions, {
    fields: [returnData.divisionId],
    references: [divisions.id]
  }),
  circle: one(circles, {
    fields: [returnData.circleId],
    references: [circles.id]
  }),
  user: one(users, {
    fields: [returnData.uploadedBy],
    references: [users.id]
  })
}));
