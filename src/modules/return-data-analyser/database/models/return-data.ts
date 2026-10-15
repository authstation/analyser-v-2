import { pgTable, serial, text, timestamp, integer, numeric, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { divisions, circles } from '@/modules/settings/database/models/settings.js';
import { users } from '@/modules/auth/database/models/user.js';

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
  // Composite indexes matching the real dashboard predicates (circle scope +
  // month range kept the column bare — see utils/helpers.monthRange).
  circlePeriodIdx: index('return_data_circle_period_idx').on(t.circleId, t.taxPeriod),
  periodCircleIdx: index('return_data_period_circle_idx').on(t.taxPeriod, t.circleId),
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

/** Immutable per-row risk score, kept in sync by a generated column. */
const RISK_SCORE_EXPRESSION = `(
  CASE WHEN COALESCE("vds_increasing",0) > 0 AND COALESCE("deposited_vat",0) < COALESCE("vds_increasing",0) THEN 10 ELSE 0 END +
  CASE WHEN COALESCE("net_payable_vat",0) < 0 AND COALESCE("deposited_vat",0) > 0 THEN 10 ELSE 0 END +
  CASE WHEN COALESCE("closing_balance_vat",0) > 500000 THEN 10 ELSE 0 END +
  CASE WHEN COALESCE("net_payable_vat",0) < -100000 THEN 5 ELSE 0 END +
  CASE WHEN COALESCE("net_payable_vat",0) > 100000 THEN 5 ELSE 0 END +
  CASE WHEN COALESCE("closing_balance_vat",0) > 100000 AND COALESCE("closing_balance_vat",0) <= 500000 THEN 5 ELSE 0 END +
  CASE WHEN COALESCE("vds_decreasing",0) > 0 THEN 5 ELSE 0 END +
  CASE WHEN COALESCE("advanced_tax_paid",0) < COALESCE("increasing_adjustment",0) THEN 5 ELSE 0 END +
  CASE WHEN COALESCE("total_sales_value",0) > 0 AND COALESCE("total_payable_vat",0) = 0 THEN 2 ELSE 0 END +
  CASE WHEN COALESCE("decreasing_adjustment",0) > 0 THEN 2 ELSE 0 END +
  CASE WHEN COALESCE("total_input_tax_credit_value",0) > 0 THEN 2 ELSE 0 END
)`;

/**
 * Why: Performance hook for the return-data analyser.
 *      Adds composite indexes, a precomputed row risk score, and the
 *      per-(bin, month) rollup materialized view that backs the dashboard.
 * When: Automatically on server start and on `bun maker db:migrate:run`.
 * Where: src/modules/return-data-analyser/database/models/return-data.ts.
 * How: Postgres-only, idempotent DDL.
 */
export const returnDataPerfHook = {
  __migrationSql: true as const,
  postgresql: [
    // §3.3 — UNLOGGED landing table for `COPY ... FROM STDIN` bulk imports. It is
    // truncated after every load; only the loadable columns exist (no serial id
    // and no generated `risk_score`), so a plain COPY works.
    `CREATE UNLOGGED TABLE IF NOT EXISTS "return_data_staging" (
       "division_id" integer,
       "circle_id" integer,
       "bin" text,
       "submission_id" text,
       "tax_period" timestamp,
       "has_activities" text,
       "total_sales_value" numeric(20,2),
       "total_payable_vat" numeric(20,2),
       "total_payable_sd" numeric(20,2),
       "total_input_tax_credit_value" numeric(20,2),
       "total_input_tax_credit_vat" numeric(20,2),
       "increasing_adjustment" numeric(20,2),
       "decreasing_adjustment" numeric(20,2),
       "net_payable_vat" numeric(20,2),
       "net_payable_sd" numeric(20,2),
       "fine_penalty" numeric(20,2),
       "deposited_vat" numeric(20,2),
       "deposited_sd" numeric(20,2),
       "closing_balance_vat" numeric(20,2),
       "closing_balance_sd" numeric(20,2),
       "vds_increasing" numeric(20,2),
       "vds_decreasing" numeric(20,2),
       "advanced_tax_paid" numeric(20,2),
       "submission_date" text,
       "last_amendment_date" text,
       "raw_json" text,
       "uploaded_by" integer
     )`,
    `CREATE INDEX IF NOT EXISTS "return_data_circle_period_idx" ON "return_data" ("circle_id", "tax_period")`,
    `CREATE INDEX IF NOT EXISTS "return_data_period_circle_idx" ON "return_data" ("tax_period", "circle_id")`,
    `ALTER TABLE "return_data" ADD COLUMN IF NOT EXISTS "risk_score" integer GENERATED ALWAYS AS ${RISK_SCORE_EXPRESSION} STORED`,
    `CREATE INDEX IF NOT EXISTS "return_data_risk_idx" ON "return_data" ("circle_id", "tax_period") INCLUDE ("bin", "risk_score")`,
    `DO $body$
     BEGIN
       IF to_regclass('public.return_data') IS NOT NULL
          AND to_regclass('public.mv_return_bin_month') IS NULL THEN
         CREATE MATERIALIZED VIEW "mv_return_bin_month" AS
           SELECT
             COALESCE("circle_id", -1) AS "circle_id",
             COALESCE("division_id", -1) AS "division_id",
             "bin",
             date_trunc('month', "tax_period")::date AS "month",
             count(*)::bigint AS "submissions",
             bool_or(COALESCE("total_sales_value",0) > 0 AND COALESCE("total_payable_vat",0) > 0) AS "m3",
             bool_or(COALESCE("total_sales_value",0) > 0 AND COALESCE("total_payable_vat",0) = 0) AS "m4",
             bool_or(COALESCE("total_payable_sd",0) > 0) AS "m5",
             bool_or(COALESCE("total_input_tax_credit_value",0) > 0) AS "m6",
             bool_or(COALESCE("increasing_adjustment",0) > 0) AS "m7",
             bool_or(COALESCE("decreasing_adjustment",0) > 0) AS "m8",
             bool_or(COALESCE("net_payable_vat",0) < 0) AS "m9",
             bool_or(COALESCE("net_payable_vat",0) < -100000) AS "m10",
             bool_or(COALESCE("net_payable_vat",0) < 0 AND COALESCE("deposited_vat",0) > 0) AS "m11",
             bool_or(COALESCE("net_payable_vat",0) > 100000 AND COALESCE("deposited_vat",0) > 0) AS "m12",
             bool_or(COALESCE("net_payable_sd",0) < 0) AS "m13",
             bool_or(COALESCE("closing_balance_vat",0) > 0 AND COALESCE("closing_balance_vat",0) <= 100000) AS "m14",
             bool_or(COALESCE("closing_balance_vat",0) > 100000 AND COALESCE("closing_balance_vat",0) <= 500000) AS "m15",
             bool_or(COALESCE("closing_balance_vat",0) > 500000) AS "m16",
             bool_or(COALESCE("vds_increasing",0) > 0) AS "m17",
             bool_or(COALESCE("vds_decreasing",0) > 0) AS "m18",
             bool_or(COALESCE("advanced_tax_paid",0) > 0) AS "m19",
             bool_or(COALESCE("advanced_tax_paid",0) < COALESCE("increasing_adjustment",0)) AS "m20",
             bool_or(COALESCE("fine_penalty",0) > 0 AND COALESCE("fine_penalty",0) = COALESCE("decreasing_adjustment",0)) AS "m21",
             bool_or(COALESCE("vds_increasing",0) > 0 AND COALESCE("deposited_vat",0) < COALESCE("vds_increasing",0)) AS "m22",
             bool_or(COALESCE("total_input_tax_credit_vat",0) > 0) AS "m23_return"
           FROM "return_data"
           WHERE "tax_period" IS NOT NULL
           GROUP BY 1, 2, 3, 4;
       END IF;
     END
     $body$`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "mv_return_bin_month_uidx" ON "mv_return_bin_month" ("circle_id", "division_id", "bin", "month")`
  ]
};
