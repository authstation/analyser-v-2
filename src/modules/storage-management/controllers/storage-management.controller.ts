import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Handler } from "hono";
import { db } from "@/framework/facade.js";

/**
 * Helper to parse DATABASE_URL
 */
function parseDbUrl() {
  const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5433/analyser_db";
  try {
    const url = new URL(dbUrl);
    return {
      user: url.username || "postgres",
      password: url.password || "postgres",
      host: url.hostname || "localhost",
      port: url.port || "5433",
      database: url.pathname.replace(/^\//, "") || "analyser_db"
    };
  } catch {
    return {
      user: "postgres",
      password: "123",
      host: "localhost",
      port: "5433",
      database: "analyser_db"
    };
  }
}

/**
 * GET /api/storage-management/overview
 * Returns DB total size, table sizes, and per-user storage usage (sorted top-to-bottom)
 */
export const getOverview: Handler = async (c: any) => {
  try {
    // 1. Total Database Size
    const totalSizeRes: any = await db.execute(sql`
      SELECT 
        pg_database_size(current_database()) as raw_bytes,
        pg_size_pretty(pg_database_size(current_database())) as pretty_size
    `);
    const totalRows = Array.isArray(totalSizeRes) ? totalSizeRes : totalSizeRes?.rows || [];
    const totalRow = totalRows[0] || {};
    const totalBytes = Number(totalRow.raw_bytes || 0);
    const prettySize = String(totalRow.pretty_size || "0 MB");

    // 2. Main Tables Size Breakdown
    const tablesSizeRes: any = await db.execute(sql`
      SELECT
        relname AS table_name,
        pg_total_relation_size(relid) AS raw_bytes,
        pg_size_pretty(pg_total_relation_size(relid)) AS pretty_size,
        n_live_tup AS estimated_rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 10
    `);
    const tableRows = Array.isArray(tablesSizeRes) ? tablesSizeRes : tablesSizeRes?.rows || [];
    const tables = tableRows.map((r: any) => ({
      tableName: r.table_name,
      rawBytes: Number(r.raw_bytes || 0),
      prettySize: r.pretty_size,
      rows: Number(r.estimated_rows || 0)
    }));

    // 3. User Storage Usage (top to bottom by usage/records)
    const userUsageRes: any = await db.execute(sql`
      SELECT 
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        COALESCE(rd.return_count, 0) as return_records,
        COALESCE(bd.bin_count, 0) as bin_records,
        (COALESCE(rd.return_count, 0) + COALESCE(bd.bin_count, 0)) as total_records
      FROM users u
      LEFT JOIN (
        SELECT uploaded_by, count(*) as return_count 
        FROM return_data 
        WHERE uploaded_by IS NOT NULL 
        GROUP BY uploaded_by
      ) rd ON u.id = rd.uploaded_by
      LEFT JOIN (
        SELECT uploaded_by, count(*) as bin_count 
        FROM bin_data 
        WHERE uploaded_by IS NOT NULL 
        GROUP BY uploaded_by
      ) bd ON u.id = bd.uploaded_by
      ORDER BY total_records DESC, u.id ASC
    `);

    const userRows = Array.isArray(userUsageRes) ? userUsageRes : userUsageRes?.rows || [];

    // Estimate storage per user: average row size in DB
    const allUsers = userRows.map((u: any) => {
      const records = Number(u.total_records || 0);
      // Rough average ~ 1.5 KB per record including raw_json and indexes
      const estimatedBytes = records * 1536;
      let estSizeStr = "0 KB";
      if (estimatedBytes >= 1024 * 1024) {
        estSizeStr = `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`;
      } else if (estimatedBytes >= 1024) {
        estSizeStr = `${(estimatedBytes / 1024).toFixed(1)} KB`;
      }

      return {
        userId: u.user_id,
        name: u.user_name || "Unknown",
        email: u.user_email,
        role: u.user_role,
        returnRecords: Number(u.return_records || 0),
        binRecords: Number(u.bin_records || 0),
        totalRecords: records,
        estimatedBytes,
        prettySize: estSizeStr
      };
    });

    return c.json({
      success: true,
      database: {
        totalBytes,
        prettySize,
        totalMb: (totalBytes / (1024 * 1024)).toFixed(2)
      },
      tables,
      users: allUsers
    });
  } catch (error: any) {
    console.error("Storage overview error:", error);
    return c.json({ error: "Failed to fetch storage overview", details: error?.message }, 500);
  }
};

/**
 * GET /api/storage-management/backup/download
 * Generates full database SQL dump using pg_dump and streams it as download
 */
export const downloadBackup: Handler = async (c: any) => {
  try {
    const dbConfig = parseDbUrl();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dumpFileName = `analyser_backup_${timestamp}.sql`;
    const tempFilePath = path.join(os.tmpdir(), dumpFileName);

    await new Promise<void>((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      const args = [
        "-h",
        dbConfig.host,
        "-p",
        dbConfig.port,
        "-U",
        dbConfig.user,
        "-d",
        dbConfig.database,
        "--clean",
        "--if-exists",
        "-f",
        tempFilePath
      ];

      const dumpProcess = spawn("pg_dump", args, { env });

      dumpProcess.on("error", (err) => reject(err));
      dumpProcess.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exited with code ${code}`));
      });
    });

    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.on("close", () => {
      fs.unlink(tempFilePath, () => {});
    });

    return new Response(fileStream as any, {
      headers: {
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="${dumpFileName}"`
      }
    });
  } catch (error: any) {
    console.error("Backup failed:", error);
    return c.json({ error: "Backup generation failed", details: error?.message }, 500);
  }
};

/**
 * POST /api/storage-management/backup/restore
 * Accepts SQL file upload and restores it to database using psql
 */
export const restoreBackup: Handler = async (c: any) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || typeof file === "string") {
      return c.json({ error: "No valid SQL backup file provided" }, 400);
    }

    const dbConfig = parseDbUrl();
    const tempFilePath = path.join(os.tmpdir(), `restore_${Date.now()}.sql`);

    const arrayBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    await new Promise<void>((resolve, reject) => {
      const env = { ...process.env, PGPASSWORD: dbConfig.password };
      const args = ["-h", dbConfig.host, "-p", dbConfig.port, "-U", dbConfig.user, "-d", dbConfig.database, "-f", tempFilePath];

      const psqlProcess = spawn("psql", args, { env });

      psqlProcess.on("error", (err) => reject(err));
      psqlProcess.on("close", (code) => {
        fs.unlink(tempFilePath, () => {});
        if (code === 0) resolve();
        else reject(new Error(`psql restore exited with code ${code}`));
      });
    });

    return c.json({ success: true, message: "Database restored successfully!" });
  } catch (error: any) {
    console.error("Restore failed:", error);
    return c.json({ error: "Database restore failed", details: error?.message }, 500);
  }
};
