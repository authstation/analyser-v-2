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
  // Normalized (semicolon split) forms of the three activity columns above.
  // They back the exact multi-select filters via GIN overlap (`&&`) instead of
  // an un-indexable `ILIKE '%x%'` OR-chain. Populated on import and backfilled
  // once by binDataPerfHook.
  majorAreas: text('major_areas').array(),
  manufacturingAreas: text('manufacturing_areas').array(),
  serviceAreas: text('service_areas').array(),
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
  // GIN indexes backing the `&&` activity filters.
  majorAreasGin: index('bin_data_major_areas_gin').using('gin', t.majorAreas),
  manufacturingAreasGin: index('bin_data_manufacturing_areas_gin').using('gin', t.manufacturingAreas),
  serviceAreasGin: index('bin_data_service_areas_gin').using('gin', t.serviceAreas),
  // Composite indexes for the "eligible entities for a circle" scans and the
  // police-station + circle drilldowns.
  circleStatusIdx: index('bin_data_circle_status_idx').on(t.circleId, t.binStatus),
  policeStationCircleIdx: index('bin_data_police_station_circle_idx').on(t.policeStationId, t.circleId),
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

/**
 * Why: Adds the normalized activity array columns plus the GIN/composite
 *      indexes the analyser dashboards rely on, and backfills the arrays from
 *      the legacy semicolon-joined text exactly once.
 * When: Automatically on server start and on `bun maker db:migrate:run`.
 * Where: Consumed by src/framework/database/migrate-hooks.ts (module scan).
 * How: Postgres-only, idempotent DDL (IF NOT EXISTS + backfill predicates).
 *      For very large tables, create the indexes with CONCURRENTLY out-of-band.
 */
export const binDataPerfHook = {
  __migrationSql: true as const,
  postgresql: [
    // §3.3 — UNLOGGED landing table for the `COPY ... FROM STDIN` bulk import
    // fast path (truncated after every load; no serial id column).
    `CREATE UNLOGGED TABLE IF NOT EXISTS "bin_data_staging" (
       "bin" text,
       "entity_name" text,
       "bin_issue_date" timestamp,
       "bin_status" text,
       "forced_registration" text,
       "major_area" text,
       "manufacturing_area" text,
       "service_area" text,
       "major_areas" text[],
       "manufacturing_areas" text[],
       "service_areas" text[],
       "email" text,
       "mobile" text,
       "address" text,
       "hq_address" text,
       "circle_id" integer,
       "division_id" integer,
       "police_station_id" integer,
       "e_tin" text,
       "raw_json" text,
       "uploaded_by" integer
     )`,
    `ALTER TABLE "bin_data" ADD COLUMN IF NOT EXISTS "major_areas" text[]`,
    `ALTER TABLE "bin_data" ADD COLUMN IF NOT EXISTS "manufacturing_areas" text[]`,
    `ALTER TABLE "bin_data" ADD COLUMN IF NOT EXISTS "service_areas" text[]`,
    `UPDATE "bin_data" AS bd SET "major_areas" = COALESCE((
        SELECT array_agg(DISTINCT btrim(x) ORDER BY btrim(x))
        FROM unnest(string_to_array(bd."major_area", ';')) AS x
        WHERE btrim(x) <> '' AND btrim(x) NOT IN ('None', 'N/A')
      ), '{}'::text[])
      WHERE "major_areas" IS NULL AND "major_area" IS NOT NULL`,
    `UPDATE "bin_data" AS bd SET "manufacturing_areas" = COALESCE((
        SELECT array_agg(DISTINCT btrim(x) ORDER BY btrim(x))
        FROM unnest(string_to_array(bd."manufacturing_area", ';')) AS x
        WHERE btrim(x) <> '' AND btrim(x) NOT IN ('None', 'N/A')
      ), '{}'::text[])
      WHERE "manufacturing_areas" IS NULL AND "manufacturing_area" IS NOT NULL`,
    `UPDATE "bin_data" AS bd SET "service_areas" = COALESCE((
        SELECT array_agg(DISTINCT btrim(x) ORDER BY btrim(x))
        FROM unnest(string_to_array(bd."service_area", ';')) AS x
        WHERE btrim(x) <> '' AND btrim(x) NOT IN ('None', 'N/A')
      ), '{}'::text[])
      WHERE "service_areas" IS NULL AND "service_area" IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS "bin_data_major_areas_gin" ON "bin_data" USING gin ("major_areas")`,
    `CREATE INDEX IF NOT EXISTS "bin_data_manufacturing_areas_gin" ON "bin_data" USING gin ("manufacturing_areas")`,
    `CREATE INDEX IF NOT EXISTS "bin_data_service_areas_gin" ON "bin_data" USING gin ("service_areas")`,
    `CREATE INDEX IF NOT EXISTS "bin_data_circle_status_idx" ON "bin_data" ("circle_id", "bin_status")`,
    `CREATE INDEX IF NOT EXISTS "bin_data_police_station_circle_idx" ON "bin_data" ("police_station_id", "circle_id")`,
    // §2.3 filter-options dimension: the dashboard's area dropdowns used to
    // unnest the `*_areas` arrays across every BIN row on each cold request.
    // This small table holds the distinct (major, mfg, service) relation tuples
    // once; it is rebuilt after every BIN import (rebuildBinAreaDimension).
    `CREATE TABLE IF NOT EXISTS "bin_area_dimension" ("major" text, "mfg" text, "service" text)`,
    `DO $body$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM "bin_area_dimension") THEN
         INSERT INTO "bin_area_dimension" ("major", "mfg", "service")
         SELECT DISTINCT "major", "mfg", "service" FROM (
           SELECT maj AS "major", mf AS "mfg", NULL::text AS "service"
           FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."manufacturing_areas", '{}'::text[])) AS mf
           UNION
           SELECT maj AS "major", NULL::text AS "mfg", sv AS "service"
           FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj, unnest(COALESCE(b."service_areas", '{}'::text[])) AS sv
           UNION
           SELECT maj AS "major", NULL::text AS "mfg", NULL::text AS "service"
           FROM "bin_data" b, unnest(COALESCE(b."major_areas", '{}'::text[])) AS maj
           WHERE COALESCE(cardinality(b."manufacturing_areas"), 0) = 0
             AND COALESCE(cardinality(b."service_areas"), 0) = 0
         ) rel;
       END IF;
     END $body$`
  ]
};
