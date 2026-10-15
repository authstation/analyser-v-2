import { relations } from "drizzle-orm";
import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/database/models/user.js";

/**
 * Why: §3.1 — durable, database-backed job records so long-running work
 *      (bulk imports, post-import maintenance) survives a request ending and is
 *      observable/retryable. Unlike the BullMQ queue this needs no Redis.
 * When: Created by `enqueueJob`, mutated by the job runner.
 * Where: src/modules/jobs/database/models/job.ts.
 * How: Plain table; `payload`/`result` are jsonb. Status is one of
 *      pending | running | completed | failed.
 */
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    status: text("status").default("pending").notNull(),
    payload: jsonb("payload"),
    result: jsonb("result"),
    error: text("error"),
    progress: integer("progress").default(0).notNull(),
    total: integer("total"),
    message: text("message"),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at")
  },
  (table) => [
    index("background_jobs_status_idx").on(table.status, table.createdAt),
    index("background_jobs_type_idx").on(table.type, table.createdAt)
  ]
);

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  createdByUser: one(users, {
    fields: [backgroundJobs.createdBy],
    references: [users.id]
  })
}));

/**
 * Why: §3.1 — the `background_jobs` table is new app DDL; register it through
 *      the model migration-hook mechanism (the same path used for other new
 *      tables) instead of the framework's hardcoded bootstrap DDL.
 * When: `runModelMigrationHooks()` during startup.
 * Where: src/modules/jobs/database/models/job.ts.
 * How: Postgres-only, idempotent DDL.
 */
export const backgroundJobsMigrationHook = {
  __migrationSql: true as const,
  postgresql: [
    `CREATE TABLE IF NOT EXISTS "background_jobs" (
       "id" serial PRIMARY KEY,
       "type" text NOT NULL,
       "status" text DEFAULT 'pending' NOT NULL,
       "payload" jsonb,
       "result" jsonb,
       "error" text,
       "progress" integer DEFAULT 0 NOT NULL,
       "total" integer,
       "message" text,
       "attempts" integer DEFAULT 0 NOT NULL,
       "max_attempts" integer DEFAULT 3 NOT NULL,
       "created_by" integer,
       "created_at" timestamp DEFAULT now() NOT NULL,
       "updated_at" timestamp DEFAULT now() NOT NULL,
       "started_at" timestamp,
       "finished_at" timestamp
     )`,
    `CREATE INDEX IF NOT EXISTS "background_jobs_status_idx" ON "background_jobs" ("status", "created_at")`,
    `CREATE INDEX IF NOT EXISTS "background_jobs_type_idx" ON "background_jobs" ("type", "created_at")`
  ]
};
