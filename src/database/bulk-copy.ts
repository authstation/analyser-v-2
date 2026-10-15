import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { databaseDialect, databasePool } from "@/framework/database/connection.js";

/**
 * Why: §3.3 — row-by-row / 500-row `INSERT ... ON CONFLICT` batches pay a
 *      parse + plan + round-trip cost per statement, which dominates large
 *      imports. Loading into an UNLOGGED staging table over the wire protocol
 *      (`COPY ... FROM STDIN`) is dramatically faster, then a single
 *      set-based `INSERT ... SELECT ... ON CONFLICT` merges it.
 * When: Bulk upserts of ~thousands of rows (imports) on PostgreSQL.
 * Where: Module import controllers.
 * How: Values are rendered to CSV (NULL = unquoted empty, arrays = `{...}`,
 *      empty string = `""`) streamed into an UNLOGGED staging table inside one
 *      transaction that also raises `statement_timeout` for the load, then a
 *      single merge statement and a staging TRUNCATE.
 *
 * Callers on non-PostgreSQL dialects must keep their own batched insert path
 * (see `bulkCopySupported()`).
 */

export type BulkValue = string | number | boolean | Date | string[] | null | undefined;

/** True when the active connection supports the COPY fast path. */
export function bulkCopySupported(): boolean {
  return databaseDialect() === "postgresql";
}

/**
 * Render one value as a CSV field.
 * - null/undefined            -> unquoted empty  (COPY reads it as NULL)
 * - []                        -> unquoted empty  (mirrors `splitAreas` -> NULL)
 * - string[]                  -> a Postgres array literal, CSV-escaped
 * - ""                        -> `""`            (a literal empty string)
 * - Date                      -> ISO-8601
 */
function csvField(value: BulkValue): string {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    const inner = value
      .map((element) => `"${String(element).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
      .join(",");
    return `"${`{${inner}}`.replace(/"/g, '""')}"`;
  }

  const text = value instanceof Date ? value.toISOString() : String(value);
  if (text === "") return '""';
  return `"${text.replace(/"/g, '""')}"`;
}

export type CopyUpsertOptions = {
  /** UNLOGGED staging table (same loadable columns as the target). */
  stagingTable: string;
  /** Destination table. */
  targetTable: string;
  /** Loadable columns, in the same order as each row array. */
  columns: string[];
  /** Conflict target columns (must have a unique index on the target). */
  conflictColumns: string[];
  /** Columns to overwrite on conflict with the staged value. */
  updateColumns: string[];
  /** Raw values, each array matching `columns` order. */
  rows: BulkValue[][];
  /** Max milliseconds allowed for the transaction (default 5 min). */
  statementTimeoutMs?: number;
};

/**
 * COPY rows into an UNLOGGED staging table and merge them into the target in
 * one transaction. Returns the number of staged rows.
 *
 * The caller is responsible for de-duplicating on the conflict key first:
 * `ON CONFLICT DO UPDATE` cannot touch the same target row twice in one
 * statement.
 */
export async function copyUpsert(options: CopyUpsertOptions): Promise<number> {
  if (!bulkCopySupported()) {
    throw new Error("copyUpsert requires a PostgreSQL connection");
  }
  if (options.rows.length === 0) return 0;

  const pool = databasePool();
  const columnSql = options.columns.map((column) => `"${column}"`).join(", ");
  const conflictSql = options.conflictColumns.map((column) => `"${column}"`).join(", ");
  const updateSql = options.updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(", ");
  const mergeSql = `INSERT INTO "${options.targetTable}" (${columnSql}) SELECT ${columnSql} FROM "${options.stagingTable}" ON CONFLICT (${conflictSql}) DO UPDATE SET ${updateSql}`;

  await pool.begin(async (tx: any) => {
    // Bulk loads may legitimately exceed the per-statement guardrail.
    await tx.unsafe(`SET LOCAL statement_timeout = ${Number(options.statementTimeoutMs ?? 300_000)}`);
    // WAL flush is pointless for a load we are about to merge and then reset.
    await tx.unsafe("SET LOCAL synchronous_commit = off");
    await tx.unsafe(`TRUNCATE TABLE "${options.stagingTable}"`);

    const writable = await tx
      .unsafe(`COPY "${options.stagingTable}" (${columnSql}) FROM STDIN WITH (FORMAT csv)`)
      .writable();

    async function* csvChunks() {
      let buffer = "";
      for (const row of options.rows) {
        buffer += `${row.map(csvField).join(",")}\n`;
        // Bound memory: flush roughly every 64 KiB.
        if (buffer.length >= 65_536) {
          yield buffer;
          buffer = "";
        }
      }
      if (buffer.length > 0) yield buffer;
    }

    await pipeline(Readable.from(csvChunks()), writable);

    await tx.unsafe(mergeSql);
    await tx.unsafe(`TRUNCATE TABLE "${options.stagingTable}"`);
  });

  return options.rows.length;
}
