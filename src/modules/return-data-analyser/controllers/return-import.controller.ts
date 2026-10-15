import type { Handler } from "hono";
import { db, cache, storage } from "@/framework/facade.js";
import { eq, inArray, sql } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { type BulkValue, bulkCopySupported, copyUpsert } from "@/database/bulk-copy.js";
import { parseReturnWorkbook, isParseError } from "@/modules/return-data-analyser/utils/parse-worker.js";
import { enqueueJob } from "@/modules/jobs/services/job-runner.js";
import { RETURN_IMPORT_JOB } from "@/modules/jobs/services/job-types.js";
import { schedulePostImportMaintenance } from "@/modules/jobs/services/maintenance-job.js";
import {
  getSettings,
  parseNumeric,
  parseTaxPeriod,
  DEFAULT_RETURN_DATA_MAPPINGS,
  getUserApprovedCircleIds
} from "../utils/helpers.js";

/**
 * §3.3 — Column contract for the COPY fast path. `columns` order must match
 * `toReturnDataCopyRow`; the conflict target mirrors the model's unique index;
 * `updateColumns` mirrors the previous `onConflictDoUpdate` set exactly (note
 * `uploaded_by` is intentionally not overwritten on update).
 */
export const RETURN_DATA_COPY = {
  stagingTable: "return_data_staging",
  targetTable: "return_data",
  conflictColumns: ["bin", "tax_period"],
  columns: [
    "division_id",
    "circle_id",
    "bin",
    "submission_id",
    "tax_period",
    "has_activities",
    "total_sales_value",
    "total_payable_vat",
    "total_payable_sd",
    "total_input_tax_credit_value",
    "total_input_tax_credit_vat",
    "increasing_adjustment",
    "decreasing_adjustment",
    "net_payable_vat",
    "net_payable_sd",
    "fine_penalty",
    "deposited_vat",
    "deposited_sd",
    "closing_balance_vat",
    "closing_balance_sd",
    "vds_increasing",
    "vds_decreasing",
    "advanced_tax_paid",
    "submission_date",
    "last_amendment_date",
    "raw_json",
    "uploaded_by"
  ],
  updateColumns: [
    "submission_id",
    "has_activities",
    "total_sales_value",
    "total_payable_vat",
    "total_payable_sd",
    "total_input_tax_credit_value",
    "total_input_tax_credit_vat",
    "increasing_adjustment",
    "decreasing_adjustment",
    "net_payable_vat",
    "net_payable_sd",
    "fine_penalty",
    "deposited_vat",
    "deposited_sd",
    "closing_balance_vat",
    "closing_balance_sd",
    "vds_increasing",
    "vds_decreasing",
    "advanced_tax_paid",
    "submission_date",
    "last_amendment_date",
    "circle_id",
    "division_id",
    "raw_json"
  ]
} as const;

/** Project a cleaned row object into the `RETURN_DATA_COPY.columns` order. */
export function toReturnDataCopyRow(row: any): BulkValue[] {
  return [
    row.divisionId ?? null,
    row.circleId ?? null,
    row.bin,
    row.submissionId ?? null,
    row.taxPeriod ?? null,
    row.hasActivities ?? null,
    row.totalSalesValue ?? null,
    row.totalPayableVat ?? null,
    row.totalPayableSd ?? null,
    row.totalInputTaxCreditValue ?? null,
    row.totalInputTaxCreditVat ?? null,
    row.increasingAdjustment ?? null,
    row.decreasingAdjustment ?? null,
    row.netPayableVat ?? null,
    row.netPayableSd ?? null,
    row.finePenalty ?? null,
    row.depositedVat ?? null,
    row.depositedSd ?? null,
    row.closingBalanceVat ?? null,
    row.closingBalanceSd ?? null,
    row.vdsIncreasing ?? null,
    row.vdsDecreasing ?? null,
    row.advancedTaxPaid ?? null,
    row.submissionDate ?? null,
    row.lastAmendmentDate ?? null,
    row.rawJson ?? null,
    row.uploadedBy ?? null
  ];
}

export const parse: Handler = async (c: any) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No valid file uploaded." }, 400);
    }

    const allowedMimeTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    if (!allowedMimeTypes.includes(file.type) && !file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      return c.json({ error: "Only Excel files (.xlsx, .xls) are allowed." }, 400);
    }

    const cfg = await getSettings(["common_max_file_size_mb", "common_max_file_rows", "max_file_size_mb", "max_file_rows"]);
    const maxSizeMb = parseFloat(cfg["common_max_file_size_mb"] || cfg["max_file_size_mb"] || "50");
    const maxRows = parseInt(cfg["common_max_file_rows"] || cfg["max_file_rows"] || "100000", 10);

    if (file.size > maxSizeMb * 1024 * 1024) {
      return c.json({ error: `File size exceeds the maximum allowed ${maxSizeMb}MB.` }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let dbMappings = await db.query.columnMappings.findMany({
      where: (mappings: any, { or, eq }: any) => or(eq(mappings.module, "return_data"), eq(mappings.module, "return"))
    });

    if (dbMappings.length === 0) {
      dbMappings = Object.entries(DEFAULT_RETURN_DATA_MAPPINGS).map(([dbColumn, excelHeader]) => ({
        id: 0,
        module: "return_data",
        dbColumn,
        excelHeader,
        createdAt: new Date()
      }));
    }

    // §3.2 — read + map the workbook on a worker thread so a large file cannot
    // block the HTTP event loop. The worker reproduces the previous inline logic.
    const parsed = await parseReturnWorkbook({
      buffer,
      mappings: dbMappings.map((m: any) => ({ dbColumn: m.dbColumn, excelHeader: m.excelHeader })),
      maxRows
    });

    if (isParseError(parsed)) {
      switch (parsed.code) {
        case "NO_SHEET":
          return c.json({ error: "No sheets found in Excel file." }, 400);
        case "NO_WORKSHEET":
          return c.json({ error: "Sheet could not be read." }, 400);
        case "EMPTY":
          return c.json({ error: "The uploaded file is empty." }, 400);
        case "TOO_MANY_ROWS":
          return c.json({ error: `File contains too many rows. Maximum allowed is ${maxRows.toLocaleString()} data rows.` }, 400);
        default:
          throw new Error(parsed.message || "Failed to process file.");
      }
    }

    const processedData = parsed.data;

    // --- Step 1 Enforcement: Filter uploaded returns to only include BINs registered in bin_data table ---
    const fileBins = Array.from(new Set(processedData.map((r: any) => r.bin).filter(Boolean)));
    let matchedData = processedData;
    let unmatchedBinCount = 0;
    let unmatchedRowCount = 0;
    let unmatchedList: any[] = [];

    if (fileBins.length > 0) {
      const existingBinSet = new Set<string>();
      const batchCheckSize = 2000;
      for (let i = 0; i < fileBins.length; i += batchCheckSize) {
        const slice = fileBins.slice(i, i + batchCheckSize);
        const rows = await db
          .select({ bin: binData.bin })
          .from(binData)
          .where(inArray(binData.bin, slice));
        rows.forEach((r: any) => existingBinSet.add(r.bin));
      }

      const missingBins = fileBins.filter((b) => !existingBinSet.has(b));
      unmatchedBinCount = missingBins.length;

      // Filter only rows whose BIN exists in Master BIN data
      matchedData = processedData.filter((r: any) => r.bin && existingBinSet.has(r.bin));
      const unmatchedRowsList = processedData.filter((r: any) => !r.bin || !existingBinSet.has(r.bin));
      unmatchedRowCount = unmatchedRowsList.length;

      unmatchedList = unmatchedRowsList.map((r: any) => {
        let rawObj: any = {};
        try {
          rawObj = typeof r.rawJson === "string" ? JSON.parse(r.rawJson) : r.rawJson || {};
        } catch {
          rawObj = {};
        }

        const nameKey = Object.keys(rawObj).find((k) => {
          const l = k.trim().toLowerCase();
          return l.includes("taxpayer") || l.includes("entity") || l.includes("name");
        });

        return {
          bin: r.bin || "N/A",
          name: nameKey ? String(rawObj[nameKey] || "") : "",
          submissionId: r.submission_id || "",
          taxPeriod: r.tax_period || "",
          circle: r.circle || "",
          division: r.division || "",
          reason: !r.bin ? "Missing BIN in Return" : "BIN not in Master Database"
        };
      });

      if (matchedData.length === 0) {
        const sampleMissing = missingBins.slice(0, 5).join(", ");
        const moreCount = missingBins.length > 5 ? ` and ${missingBins.length - 5} more` : "";
        return c.json(
          {
            error: `কোনো নিবন্ধিত বিন পাওয়া যায়নি: আপলোডকৃত ফাইলের ${fileBins.length}টি বিনের কোনোটিই মাস্টার ডেটাতে (BIN Analyser) নেই [${sampleMissing}${moreCount}]। অনুগ্রহ করে প্রথমে এই সার্কেল/কমিশনারেটের মাস্টার বিন ডেটা আপলোড করুন।`,
            unmatchedList,
            unmatchedRows: unmatchedRowCount,
            unmatchedBins: unmatchedBinCount
          },
          400
        );
      }
    }

    return c.json({
      message: "File processed successfully.",
      data: matchedData,
      totalRows: processedData.length,
      matchedRows: matchedData.length,
      unmatchedRows: unmatchedRowCount,
      unmatchedBins: unmatchedBinCount,
      unmatchedList
    });
  } catch (error: any) {
    console.error("Parse Error:", error);
    return c.json({ error: "Failed to process file." }, 500);
  }
};

/**
 * §3.1 — Opt-in asynchronous Return import. Stores the upload on the tmp disk and
 * returns a job id immediately; the `return_import` job runs the same parse+save
 * pipeline in the background. Clients poll `GET /api/jobs/:id`.
 */
export const importAsync: Handler = async (c: any) => {
  try {
    const user = c.get("auth");
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No valid file uploaded." }, 400);
    }

    const allowedMimeTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
    if (!allowedMimeTypes.includes(file.type) && !file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      return c.json({ error: "Only Excel files (.xlsx, .xls) are allowed." }, 400);
    }

    const cfg = await getSettings(["common_max_file_size_mb", "max_file_size_mb"]);
    const maxSizeMb = parseFloat(cfg["common_max_file_size_mb"] || cfg["max_file_size_mb"] || "50");
    if (file.size > maxSizeMb * 1024 * 1024) {
      return c.json({ error: `File size exceeds the maximum allowed ${maxSizeMb}MB.` }, 400);
    }

    const fileKey = await storage.disk("tmp").putFile("imports", file);
    const jobId = await enqueueJob(
      RETURN_IMPORT_JOB,
      { fileKey, fileName: file.name, mimeType: file.type, createdBy: user.id },
      { createdBy: user.id, maxAttempts: 2 }
    );

    return c.json({ message: "Import queued.", jobId, status: "pending", statusUrl: `/api/jobs/${jobId}` }, 202);
  } catch (error: any) {
    console.error("Async Import Error:", error);
    return c.json({ error: "Failed to queue import." }, 500);
  }
};

export const save: Handler = async (c: any) => {
  try {
    const { data } = await c.req.json();
    if (!data || !Array.isArray(data) || data.length === 0) {
      return c.json({ error: "No valid data provided." }, 400);
    }

    let [existingDivisions, existingCircles] = await Promise.all([db.query.divisions.findMany(), db.query.circles.findMany()]);

    const uniqueDivisions = new Set<string>();
    const uniqueCircles = new Map<string, { circleName: string; divisionName: string }>();

    const user = c.get("auth");
    const approvedCircleIds = await getUserApprovedCircleIds(user);

    data.forEach((row: any) => {
      const divisionName = row.division?.trim() ?? null;
      const circleName = row.circle?.trim() ?? null;
      if (divisionName) uniqueDivisions.add(divisionName);
      if (divisionName && circleName) {
        uniqueCircles.set(`${divisionName}-${circleName}`, { circleName, divisionName });
      }
    });

    const missingDivs = Array.from(uniqueDivisions).filter(
      (div) => !existingDivisions.some((d: any) => d.name.toLowerCase() === div.toLowerCase())
    );

    const missingCircs: { name: string; division: string }[] = [];
    uniqueCircles.forEach(({ circleName, divisionName }) => {
      const parentDiv = existingDivisions.find((d: any) => d.name.toLowerCase() === divisionName.toLowerCase());
      if (!parentDiv) {
        missingCircs.push({ name: circleName, division: divisionName });
      } else {
        const circExists = existingCircles.some(
          (c: any) => c.name.toLowerCase() === circleName.toLowerCase() && c.divisionId === parentDiv.id
        );
        if (!circExists) {
          missingCircs.push({ name: circleName, division: divisionName });
        }
      }
    });

    if (missingDivs.length > 0 || missingCircs.length > 0) {
      return c.json(
        {
          error: "Master data missing.",
          missingDivisions: missingDivs,
          missingCircles: missingCircs
        },
        400
      );
    }

    const divMap = new Map<string, number>();
    existingDivisions.forEach((d: any) => divMap.set(d.name.toLowerCase(), d.id));

    const circleMap = new Map<string, number>();
    existingCircles.forEach((c: any) => circleMap.set(`${c.name.toLowerCase()}_${c.divisionId}`, c.id));

    // Track numeric cells that had a value but could not be parsed, so silent
    // data loss is visible to the user instead of becoming NULL.
    let skippedNumericFields = 0;
    const toNumeric = (value: any): string | null => {
      const parsed = parseNumeric(value);
      if (parsed === null && value !== null && value !== undefined && String(value).trim() !== "") {
        skippedNumericFields++;
      }
      return parsed;
    };

    const toInsert = data
      .map((row: any) => {
        const divName = (row.division || "").toString().trim();
        const circleName = (row.circle || "").toString().trim();

        let dId = null;
        let cId = null;
        if (divName) dId = divMap.get(divName.toLowerCase()) || null;
        if (circleName && dId) cId = circleMap.get(`${circleName.toLowerCase()}_${dId}`) || null;

        const taxPeriodDate = parseTaxPeriod(row.tax_period || row.taxPeriod || "");

        return {
          divisionId: dId,
          circleId: cId,
          bin: (row.bin || "").toString().trim(),
          submissionId: row.submission_id ? String(row.submission_id).trim() : null,
          taxPeriod: taxPeriodDate,
          hasActivities: row.has_activities ? String(row.has_activities).trim() : null,
          totalSalesValue: toNumeric(row.total_sales_value),
          totalPayableVat: toNumeric(row.total_payable_vat),
          totalPayableSd: toNumeric(row.total_payable_sd),
          totalInputTaxCreditValue: toNumeric(row.total_input_tax_credit_value),
          totalInputTaxCreditVat: toNumeric(row.total_input_tax_credit_vat),
          increasingAdjustment: toNumeric(row.increasing_adjustment),
          decreasingAdjustment: toNumeric(row.decreasing_adjustment),
          netPayableVat: toNumeric(row.net_payable_vat),
          netPayableSd: toNumeric(row.net_payable_sd),
          finePenalty: toNumeric(row.fine_penalty),
          depositedVat: toNumeric(row.deposited_vat),
          depositedSd: toNumeric(row.deposited_sd),
          closingBalanceVat: toNumeric(row.closing_balance_vat),
          closingBalanceSd: toNumeric(row.closing_balance_sd),
          vdsIncreasing: toNumeric(row.vds_increasing),
          vdsDecreasing: toNumeric(row.vds_decreasing),
          advancedTaxPaid: toNumeric(row.advanced_tax_paid),
          submissionDate: row.submission_date ? String(row.submission_date).trim() : null,
          lastAmendmentDate: row.last_amendment_date ? String(row.last_amendment_date).trim() : null,
          rawJson: row.rawJson || null,
          uploadedBy: user?.id ?? null
        };
      })
      .filter((r) => r.bin !== "");

    let validToInsert = toInsert.filter((row) => {
      if (approvedCircleIds === null) return true;
      return row.circleId && approvedCircleIds.includes(row.circleId);
    });

    if (approvedCircleIds !== null && validToInsert.length === 0) {
      return c.json(
        {
          error:
            "None of the uploaded rows correspond to your approved circles. You can only upload data for circles you have an approved subscription for."
        },
        403
      );
    }

    const cfg = await getSettings(["bin_format_regex", "bin_format_description"]);
    const binRegexPattern = cfg["bin_format_regex"] || "^[0-9]{9}-[0-9]{4}$";
    const binDesc = cfg["bin_format_description"] || "000000000-0000";
    const binRegex = new RegExp(binRegexPattern);

    const invalidBins = validToInsert.filter((row) => row.bin && !binRegex.test(row.bin));
    if (invalidBins.length > 0) {
      return c.json({ error: `Found ${invalidBins.length} rows with invalid BIN format. Expected: ${binDesc}` }, 400);
    }

    // --- Step 1 Enforcement: Filter return data to only include BINs that exist in bin_data master table ---
    const uploadedUniqueBins = Array.from(new Set(validToInsert.map((r) => r.bin).filter(Boolean)));
    if (uploadedUniqueBins.length > 0) {
      // Check existing bins from bin_data in batches to avoid query parameter limit
      const existingBinSet = new Set<string>();
      const batchCheckSize = 2000;
      for (let i = 0; i < uploadedUniqueBins.length; i += batchCheckSize) {
        const slice = uploadedUniqueBins.slice(i, i + batchCheckSize);
        const rows = await db
          .select({ bin: binData.bin })
          .from(binData)
          .where(inArray(binData.bin, slice));
        rows.forEach((r: any) => existingBinSet.add(r.bin));
      }

      validToInsert = validToInsert.filter((r) => existingBinSet.has(r.bin));
      if (validToInsert.length === 0) {
        return c.json(
          {
            error: "মাস্টার ডেটায় নিবন্ধিত কোনো বিন পাওয়া যায়নি। অনুগ্রহ করে প্রথমে মাস্টার বিন ডেটা আপলোড করুন।"
          },
          400
        );
      }
    }

    if (validToInsert.length > 0) {
      // Deduplicate by bin and taxPeriod within the batch to prevent PostgresError 21000
      const deduplicatedReturnMap = new Map<string, typeof validToInsert[0]>();
      for (const row of validToInsert) {
        if (row.bin && row.taxPeriod) {
          const key = `${row.bin.trim()}_${new Date(row.taxPeriod).toISOString().slice(0, 10)}`;
          deduplicatedReturnMap.set(key, row);
        }
      }
      const deduplicatedReturns = Array.from(deduplicatedReturnMap.values());

      if (bulkCopySupported()) {
        // §3.3 — One COPY into the UNLOGGED staging table + a single set-based
        // merge. Far fewer round-trips/plans than hundreds of 500-row upserts.
        await copyUpsert({
          stagingTable: RETURN_DATA_COPY.stagingTable,
          targetTable: RETURN_DATA_COPY.targetTable,
          columns: [...RETURN_DATA_COPY.columns],
          conflictColumns: [...RETURN_DATA_COPY.conflictColumns],
          updateColumns: [...RETURN_DATA_COPY.updateColumns],
          rows: deduplicatedReturns.map(toReturnDataCopyRow)
        });
      } else {
        const batchSize = 500;
        // Fallback for non-PostgreSQL dialects: one atomic transaction per import
        // with `synchronous_commit = off`, so a failed batch rolls the whole
        // import back instead of leaving it partial.
        await db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL synchronous_commit = off`);
          for (let i = 0; i < deduplicatedReturns.length; i += batchSize) {
            const batch = deduplicatedReturns.slice(i, i + batchSize);
            await tx
              .insert(returnData)
              .values(batch)
              .onConflictDoUpdate({
                target: [returnData.bin, returnData.taxPeriod],
                set: {
                  submissionId: sql`EXCLUDED.submission_id`,
                  hasActivities: sql`EXCLUDED.has_activities`,
                  totalSalesValue: sql`EXCLUDED.total_sales_value`,
                  totalPayableVat: sql`EXCLUDED.total_payable_vat`,
                  totalPayableSd: sql`EXCLUDED.total_payable_sd`,
                  totalInputTaxCreditValue: sql`EXCLUDED.total_input_tax_credit_value`,
                  totalInputTaxCreditVat: sql`EXCLUDED.total_input_tax_credit_vat`,
                  increasingAdjustment: sql`EXCLUDED.increasing_adjustment`,
                  decreasingAdjustment: sql`EXCLUDED.decreasing_adjustment`,
                  netPayableVat: sql`EXCLUDED.net_payable_vat`,
                  netPayableSd: sql`EXCLUDED.net_payable_sd`,
                  finePenalty: sql`EXCLUDED.fine_penalty`,
                  depositedVat: sql`EXCLUDED.deposited_vat`,
                  depositedSd: sql`EXCLUDED.deposited_sd`,
                  closingBalanceVat: sql`EXCLUDED.closing_balance_vat`,
                  closingBalanceSd: sql`EXCLUDED.closing_balance_sd`,
                  vdsIncreasing: sql`EXCLUDED.vds_increasing`,
                  vdsDecreasing: sql`EXCLUDED.vds_decreasing`,
                  advancedTaxPaid: sql`EXCLUDED.advanced_tax_paid`,
                  submissionDate: sql`EXCLUDED.submission_date`,
                  lastAmendmentDate: sql`EXCLUDED.last_amendment_date`,
                  circleId: sql`EXCLUDED.circle_id`,
                  divisionId: sql`EXCLUDED.division_id`,
                  rawJson: sql`EXCLUDED.raw_json`
                }
              });
          }
        });
      }
      await cache.forgetPattern("return-data:*");
      await schedulePostImportMaintenance("return");
      return c.json({ message: "Data saved successfully.", insertedRows: deduplicatedReturns.length, skippedNumericFields });
    }

    return c.json({ message: "Data saved successfully.", insertedRows: 0, skippedNumericFields });
  } catch (error: any) {
    console.error("Save Error:", error);
    return c.json({ error: error.message || "Failed to save data." }, 500);
  }
};

export const deleteAll: Handler = async (c: any) => {
  try {
    const user = c.get("auth");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const isAdmin = user.role === "admin";

    if (isAdmin) {
      const result = await db.delete(returnData).returning({ id: returnData.id });
      await cache.forgetPattern("return-data:*");
      await schedulePostImportMaintenance("return");
      return c.json({ message: `Deleted ${result.length} records successfully.`, deletedCount: result.length });
    } else {
      const result = await db.delete(returnData).where(eq(returnData.uploadedBy, user.id)).returning({ id: returnData.id });
      await cache.forgetPattern("return-data:*");
      await schedulePostImportMaintenance("return");
      return c.json({ message: `Deleted ${result.length} of your uploaded records.`, deletedCount: result.length });
    }
  } catch (error: any) {
    console.error("Delete Error:", error);
    return c.json({ error: error.message || "Failed to delete data" }, 500);
  }
};
