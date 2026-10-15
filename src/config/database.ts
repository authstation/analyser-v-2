import { env } from "@/env.js";

/**
 * Why: Database connection settings for Drizzle.
 * When: Database bootstrap and dialect detection.
 * Where: src/config/database.ts.
 * How: The connection URL contains credentials, so it stays in .env
 *      (`DATABASE_URL`). Dialect is derived from the URL prefix.
 */
export const databaseConfig = {
  url: env.DATABASE_URL,
  /**
   * Connection pool size. The analytics/dashboard endpoints fan out several
   * queries per request, so the old hard-coded `max: 10` saturated quickly and
   * made concurrent users queue behind each other. Sized per instance; when
   * running several app replicas, front Postgres with PgBouncer (transaction
   * pooling) and account for the aggregate limit.
   */
  poolMax: env.DB_POOL_MAX ?? 20,
  /**
   * Server-side guardrail so a runaway analytics query cannot pin a connection
   * forever. 0 disables the timeout. Override with DB_STATEMENT_TIMEOUT_MS.
   */
  statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS ?? 15000
};

export type DatabaseConfig = typeof databaseConfig;

/**
 * Why: Maps a connection URL to its Drizzle dialect.
 * When: Selecting the pool driver and dialect-specific branching.
 * Where: Framework database connection helpers.
 * How: Matches the URL prefix; anything that isn't mysql/postgres is sqlite.
 */
export function detectDialectFrom(url: string): "sqlite" | "mysql" | "postgresql" {
  const value = url.toLowerCase();
  if (value.startsWith("mysql")) return "mysql";
  if (value.startsWith("postgres")) return "postgresql";
  return "sqlite";
}

export const databaseDialect = detectDialectFrom(databaseConfig.url);
