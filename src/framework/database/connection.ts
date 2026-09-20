import fs from "node:fs/promises";
import path from "node:path";
import { databaseConfig } from "@/config/index.js";
import * as schema from "@/database/schema.js";

export type Dialect = "sqlite" | "mysql" | "postgresql";

let databaseInstance: any;
let pool: any;
let dialect: Dialect;

async function optionalImport<T = any>(name: string): Promise<T> {
  return import(name) as Promise<T>;
}

/**
 * Why: Resolves the active DB driver from DATABASE_URL.
 * When: Called during bootstrap and dialect-specific branching.
 * Where: Used by init/close and schema generation helpers.
 * How: Checks DATABASE_URL prefix and maps to sqlite/mysql/postgresql.
 */
export function detectDialect(): Dialect {
  const url = databaseConfig.url.toLowerCase();
  if (url.startsWith("mysql")) return "mysql";
  if (url.startsWith("postgres")) return "postgresql";
  return "sqlite";
}

/**
 * Why: Creates a singleton Drizzle connection for the current dialect.
 * When: Called once at app/worker/scheduler startup.
 * Where: Framework bootstrap entry points.
 * How: Builds dialect-specific pool/client and stores it in module state.
 */
export async function initDatabase() {
  if (databaseInstance) return databaseInstance;

  dialect = detectDialect();

  if (dialect === "sqlite") {
    let drizzleSqlite: any;
    let createClient: any;
    try {
      [{ drizzle: drizzleSqlite }, { createClient }] = await Promise.all([
        optionalImport("drizzle-orm/libsql"),
        optionalImport("@libsql/client")
      ]);
    } catch {
      throw new Error("Missing sqlite dependencies. Install with: bun add drizzle-orm @libsql/client");
    }

    const file = path.resolve(process.cwd(), databaseConfig.url.replace(/^sqlite:/, ""));
    await fs.mkdir(path.dirname(file), { recursive: true });
    pool = createClient({ url: `file:${file.replace(/\\/g, "/")}` });
    databaseInstance = drizzleSqlite(pool, { schema });
    return databaseInstance;
  }

  if (dialect === "mysql") {
    let drizzleMysql: any;
    let mysql: any;
    try {
      [{ drizzle: drizzleMysql }, mysql] = await Promise.all([optionalImport("drizzle-orm/mysql2"), optionalImport("mysql2/promise")]);
    } catch {
      throw new Error("Missing mysql dependencies. Install with: bun add drizzle-orm mysql2");
    }

    pool = mysql.createPool({ uri: databaseConfig.url, connectionLimit: 10, enableKeepAlive: true });
    databaseInstance = drizzleMysql(pool, { schema, mode: "default" });
    return databaseInstance;
  }

  let drizzlePg: any;
  let postgres: any;
  try {
    [{ drizzle: drizzlePg }, { default: postgres }] = await Promise.all([
      optionalImport("drizzle-orm/postgres-js"),
      optionalImport("postgres")
    ]);
  } catch {
    throw new Error("Missing postgres dependencies. Install with: bun add drizzle-orm postgres");
  }

  pool = postgres(databaseConfig.url);
  databaseInstance = drizzlePg(pool, { schema });

  try {
    await ensurePostgresTables(pool);
    console.log("[Database] Schema & tables initialized successfully for PostgreSQL");
  } catch (migErr: any) {
    console.warn("[Database] Schema init warning:", migErr?.message || migErr);
  }

  return databaseInstance;
}

async function ensurePostgresTables(sql: any) {
  await sql.unsafe(`
    DO $$ BEGIN
      CREATE TYPE "role" AS ENUM ('admin', 'user');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "plans" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "price" integer DEFAULT 0 NOT NULL,
      "duration_days" integer DEFAULT 30 NOT NULL,
      "max_circles" integer DEFAULT 1 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY,
      "name" text,
      "email" text NOT NULL UNIQUE,
      "password" text NOT NULL,
      "role" "role" DEFAULT 'user' NOT NULL,
      "plan_id" integer,
      "plan_start_date" timestamp,
      "trx_id" text,
      "payment_status" text DEFAULT 'none',
      "has_changed_circle" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "role" DEFAULT 'user' NOT NULL;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_id" integer;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_start_date" timestamp;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trx_id" text;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'none';
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_changed_circle" boolean DEFAULT false NOT NULL;

    CREATE TABLE IF NOT EXISTS "divisions" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL UNIQUE,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "circles" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "division_id" integer REFERENCES "divisions"("id") ON DELETE cascade NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE ("name", "division_id")
    );

    CREATE TABLE IF NOT EXISTS "police_stations" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "circle_id" integer REFERENCES "circles"("id") ON DELETE cascade NOT NULL,
      "division_id" integer REFERENCES "divisions"("id") ON DELETE cascade NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE ("name", "circle_id")
    );

    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" serial PRIMARY KEY,
      "user_id" integer REFERENCES "users"("id") ON DELETE cascade NOT NULL,
      "circle_id" integer REFERENCES "circles"("id") ON DELETE cascade NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "trx_id" text,
      "payment_method" text,
      "is_addon" boolean DEFAULT false NOT NULL,
      "addon_price" integer DEFAULT 300 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "app_settings" (
      "id" serial PRIMARY KEY,
      "key" text NOT NULL UNIQUE,
      "value" text NOT NULL,
      "description" text,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "item_mappings" (
      "id" serial PRIMARY KEY,
      "module_name" text NOT NULL,
      "item_name" text NOT NULL,
      "common_item" text NOT NULL,
      "status" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      UNIQUE ("module_name", "item_name")
    );

    CREATE TABLE IF NOT EXISTS "ibas_offices" (
      "id" serial PRIMARY KEY,
      "office_name" text NOT NULL,
      "area_name" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "penalty_rules" (
      "id" serial PRIMARY KEY,
      "amount" integer NOT NULL,
      "effective_date" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "column_mappings" (
      "id" serial PRIMARY KEY,
      "module" text DEFAULT 'bin_analyser' NOT NULL,
      "excel_header" text NOT NULL,
      "db_column" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "bin_data" (
      "id" serial PRIMARY KEY,
      "bin" text UNIQUE,
      "entity_name" text,
      "bin_issue_date" timestamp,
      "bin_status" text DEFAULT 'Active',
      "forced_registration" text,
      "major_area" text,
      "manufacturing_area" text,
      "service_area" text,
      "email" text,
      "mobile" text,
      "address" text,
      "hq_address" text,
      "circle_id" integer REFERENCES "circles"("id"),
      "division_id" integer REFERENCES "divisions"("id"),
      "police_station_id" integer REFERENCES "police_stations"("id"),
      "e_tin" text,
      "raw_json" text,
      "uploaded_by" integer REFERENCES "users"("id"),
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "return_data" (
      "id" serial PRIMARY KEY,
      "division_id" integer REFERENCES "divisions"("id"),
      "circle_id" integer REFERENCES "circles"("id"),
      "bin" text NOT NULL,
      "submission_id" text,
      "tax_period" timestamp,
      "has_activities" text,
      "total_sales_value" numeric(20, 2),
      "total_payable_vat" numeric(20, 2),
      "total_payable_sd" numeric(20, 2),
      "total_input_tax_credit_value" numeric(20, 2),
      "total_input_tax_credit_vat" numeric(20, 2),
      "increasing_adjustment" numeric(20, 2),
      "decreasing_adjustment" numeric(20, 2),
      "net_payable_vat" numeric(20, 2),
      "net_payable_sd" numeric(20, 2),
      "fine_penalty" numeric(20, 2),
      "deposited_vat" numeric(20, 2),
      "deposited_sd" numeric(20, 2),
      "closing_balance_vat" numeric(20, 2),
      "closing_balance_sd" numeric(20, 2),
      "vds_increasing" numeric(20, 2),
      "vds_decreasing" numeric(20, 2),
      "advanced_tax_paid" numeric(20, 2),
      "submission_date" text,
      "last_amendment_date" text,
      "raw_json" text,
      "uploaded_by" integer REFERENCES "users"("id"),
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "return_data_bin_tax_period_uniq" UNIQUE ("bin", "tax_period")
    );

    CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
      "id" serial PRIMARY KEY,
      "email" varchar(255) NOT NULL,
      "token" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "password_resets" (
      "id" serial PRIMARY KEY,
      "user_id" integer REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade,
      "email" text NOT NULL,
      "token" text NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "refresh_tokens" (
      "id" serial PRIMARY KEY,
      "user_id" integer REFERENCES "users"("id") ON UPDATE cascade ON DELETE cascade,
      "jti" varchar(191) NOT NULL UNIQUE,
      "revoked" boolean DEFAULT false,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" serial PRIMARY KEY,
      "user_id" integer REFERENCES "users"("id") ON DELETE cascade,
      "title" text NOT NULL,
      "message" text NOT NULL,
      "is_read" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "roles" (
      "id" integer PRIMARY KEY,
      "name" varchar(255) NOT NULL UNIQUE,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    -- Insert default plans if none exist
    INSERT INTO "plans" ("name", "price", "duration_days", "max_circles", "is_active")
    SELECT 'Free Trial', 0, 30, 1, true
    WHERE NOT EXISTS (SELECT 1 FROM "plans");
  `);
}

/**
 * Why: Returns initialized Drizzle instance for queries.
 * When: Used by app code after bootstrap.
 * Where: Facade `db` proxy and direct internal consumers.
 * How: Throws if initDatabase has not completed.
 */
export function database() {
  if (!databaseInstance) throw new Error("Database is not initialized");
  return databaseInstance;
}

/**
 * Why: Exposes low-level pool/client for advanced operations.
 * When: Needed by internals that require native pool behavior.
 * Where: Scheduler lock and infrastructure helpers.
 * How: Returns shared pool and guards against uninitialized access.
 */
export function databasePool() {
  if (!pool) throw new Error("Database pool is not initialized");
  return pool;
}

/**
 * Why: Gracefully closes DB resources during shutdown/reset flows.
 * When: Server stop, worker stop, migration/reset commands.
 * Where: Runtime lifecycle scripts.
 * How: Detects dialect, closes pool, and clears singleton state.
 */
export async function closeDatabase() {
  if (!pool) return;

  const activeDialect = databaseDialect();

  if (activeDialect === "sqlite") {
    pool.close?.();
    pool = undefined;
    databaseInstance = undefined;
    return;
  }

  if (activeDialect === "mysql") {
    await pool.end();
    pool = undefined;
    databaseInstance = undefined;
    return;
  }

  await pool.end();
  pool = undefined;
  databaseInstance = undefined;
}

/**
 * Why: Returns active dialect for conditional SQL/runtime behavior.
 * When: Dialect-specific features are required.
 * Where: Locking, schema, and shutdown helpers.
 * How: Uses initialized dialect or falls back to detection.
 */
export function databaseDialect() {
  return dialect || detectDialect();
}

/**
 * Why: Normalizes raw query results into a consistent { rows } shape.
 * When: Drivers differ in what db.execute() returns:
 *   - postgres-js / libsql return a plain array of rows
 *   - mysql2 returns a [rows, fields] tuple
 *   - pg node clients already wrap rows in { rows }
 * Consumers across modules read `result.rows`.
 * Where: Applied to every db.execute() call.
 * How: Wraps arrays of row objects (and the mysql2 tuple) into { rows },
 * leaves object shapes untouched.
 */
function normalizeExecuteResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    if (result.length === 2 && Array.isArray(result[1])) {
      return { rows: result[0], fields: result[1] };
    }
    const isRowList = result.length === 0 || result.every((row) => row != null && typeof row === "object" && !Array.isArray(row));
    if (isRowList) {
      return { rows: result };
    }
  }
  return result;
}

/**
 * Why: Provides ergonomic global query surface without calling database().
 * When: Used by modules, seeders, and facade consumers.
 * Where: Exposed via framework facade as `db`.
 * How: Proxy forwards property access to the initialized Drizzle instance.
 */
export const db = new Proxy(
  {},
  {
    get(_target, property) {
      const instance = database();
      if (property === "execute") {
        return async (query: unknown, params?: unknown) => {
          const raw = instance.execute ? await instance.execute(query, params) : await instance.all(query);
          return normalizeExecuteResult(raw);
        };
      }
      const value = instance[property as keyof typeof instance];
      return typeof value === "function" ? value.bind(instance) : value;
    }
  }
) as any;
