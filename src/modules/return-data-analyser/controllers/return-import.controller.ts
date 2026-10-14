import * as xlsx from "xlsx";
import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { eq, inArray, sql } from "drizzle-orm";
import { columnMappings, binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import {
  getSettings,
  parseNumeric,
  parseTaxPeriod,
  DEFAULT_RETURN_DATA_MAPPINGS,
  getUserApprovedCircleIds
} from "../utils/helpers.js";

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
    const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return c.json({ error: "No sheets found in Excel file." }, 400);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return c.json({ error: "Sheet could not be read." }, 400);

    const rawMatrix = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: false });
    const rawMatrixDates = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null, raw: true });

    if (!rawMatrix || rawMatrix.length === 0) {
      return c.json({ error: "The uploaded file is empty." }, 400);
    }

    if (rawMatrix.length > maxRows + 5) {
      return c.json({ error: `File contains too many rows. Maximum allowed is ${maxRows.toLocaleString()} data rows.` }, 400);
    }

    let dbMappings = await db.query.columnMappings.findMany({
      where: (mappings: any, { or, eq }: any) => or(eq(mappings.module, "return_data"), eq(mappings.module, "return"))
    });

    const defaultEntries = Object.entries(DEFAULT_RETURN_DATA_MAPPINGS).map(([dbColumn, excelHeader]) => ({
      id: 0,
      module: "return_data",
      dbColumn,
      excelHeader,
      createdAt: new Date()
    }));

    if (dbMappings.length === 0) {
      dbMappings = Object.entries(DEFAULT_RETURN_DATA_MAPPINGS).map(([dbColumn, excelHeader]) => ({
        id: 0,
        module: "return_data",
        dbColumn,
        excelHeader,
        createdAt: new Date()
      }));
    }

    const mappingValues = dbMappings.map((m: any) => (m.excelHeader || "").trim().toLowerCase()).filter(Boolean);

    let headerRowIndex = 0;
    let maxMatches = 0;
    for (let i = 0; i < Math.min(20, rawMatrix.length); i++) {
      const row = rawMatrix[i];
      if (!Array.isArray(row)) continue;
      let matches = 0;
      for (const cell of row) {
        if (typeof cell === "string") {
          if (
            mappingValues.includes(
              cell
                .replace(/\r?\n|\r/g, " ")
                .trim()
                .toLowerCase()
            )
          )
            matches++;
        }
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        headerRowIndex = i;
      }
    }
    if (maxMatches === 0) headerRowIndex = 0;

    const headers = rawMatrix[headerRowIndex] || [];
    let dataStartIndex = headerRowIndex + 1;
    if (dataStartIndex < rawMatrix.length) {
      const nextRow = rawMatrix[dataStartIndex];
      let parenthesisPatternCount = 0;
      if (Array.isArray(nextRow)) {
        for (const cell of nextRow) {
          if (typeof cell === "string" && /^\(\s*\d+\s*\)$/.test(cell.trim())) parenthesisPatternCount++;
          else if (typeof cell === "number" && cell < 0) parenthesisPatternCount++;
        }
      }
      if (parenthesisPatternCount >= 2) dataStartIndex++;
    }

    const rawData = [];
    for (let i = dataStartIndex; i < rawMatrix.length; i++) {
      const rowArr = rawMatrix[i];
      const rowArrDates = rawMatrixDates[i] || [];
      if (!Array.isArray(rowArr)) continue;
      if (rowArr.every((cell) => cell === null || cell === "")) continue;
      const rowObj: any = {};
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        if (header && typeof header === "string") {
          const cleanHeader = header.replace(/\r?\n|\r/g, " ").trim();
          let cellValue = rowArr[j];
          if (rowArrDates[j] instanceof Date && !isNaN(rowArrDates[j].getTime())) {
            const dObj = new Date(rowArrDates[j].getTime() + 4 * 60 * 60 * 1000);
            const yyyy = dObj.getFullYear();
            const mm = String(dObj.getMonth() + 1).padStart(2, "0");
            const dd = String(dObj.getDate()).padStart(2, "0");
            cellValue = `${yyyy}-${mm}-${dd}`;
          }
          rowObj[cleanHeader] = cellValue;
        }
      }
      rawData.push(rowObj);
    }

    const processedData = [];
    for (const row of rawData) {
      // Filter: Only include rows where return form is "Mushak-9.1: Value Added Tax Return"
      const formKey = Object.keys(row).find((k) => {
        const lower = k.trim().toLowerCase();
        return lower === "name of return form" || lower === "return form" || lower === "form name";
      });
      if (formKey) {
        const formVal = String(row[formKey] || "").trim();
        if (formVal !== "Mushak-9.1: Value Added Tax Return") {
          continue;
        }
      }

      const mappedRow: any = {};
      let hasValidData = false;
      if (dbMappings.length > 0) {
        dbMappings.forEach((mapping: any) => {
          const targetHeaders = mapping.excelHeader.split(",").map((s: string) => s.trim().toLowerCase());
          const combinedValues: string[] = [];
          targetHeaders.forEach((th: string) => {
            const rowKey = Object.keys(row).find((k) => k.trim().toLowerCase() === th);
            if (rowKey && row[rowKey] !== undefined && row[rowKey] !== null) {
              combinedValues.push(String(row[rowKey]));
            }
          });
          if (combinedValues.length > 0) {
            mappedRow[mapping.dbColumn] = combinedValues.join(", ");
            hasValidData = true;
          }
        });
      } else {
        hasValidData = true;
      }
      if (!hasValidData) continue;
      mappedRow.rawJson = JSON.stringify(row);
      mappedRow.tempId = Math.random().toString(36).substring(2, 11);
      processedData.push(mappedRow);
    }

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
          totalSalesValue: parseNumeric(row.total_sales_value),
          totalPayableVat: parseNumeric(row.total_payable_vat),
          totalPayableSd: parseNumeric(row.total_payable_sd),
          totalInputTaxCreditValue: parseNumeric(row.total_input_tax_credit_value),
          totalInputTaxCreditVat: parseNumeric(row.total_input_tax_credit_vat),
          increasingAdjustment: parseNumeric(row.increasing_adjustment),
          decreasingAdjustment: parseNumeric(row.decreasing_adjustment),
          netPayableVat: parseNumeric(row.net_payable_vat),
          netPayableSd: parseNumeric(row.net_payable_sd),
          finePenalty: parseNumeric(row.fine_penalty),
          depositedVat: parseNumeric(row.deposited_vat),
          depositedSd: parseNumeric(row.deposited_sd),
          closingBalanceVat: parseNumeric(row.closing_balance_vat),
          closingBalanceSd: parseNumeric(row.closing_balance_sd),
          vdsIncreasing: parseNumeric(row.vds_increasing),
          vdsDecreasing: parseNumeric(row.vds_decreasing),
          advancedTaxPaid: parseNumeric(row.advanced_tax_paid),
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

      const batchSize = 500;
      for (let i = 0; i < deduplicatedReturns.length; i += batchSize) {
        const batch = deduplicatedReturns.slice(i, i + batchSize);
        await db
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

      return c.json({ message: "Data saved successfully.", insertedRows: deduplicatedReturns.length });
    }

    return c.json({ message: "Data saved successfully.", insertedRows: 0 });
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
      return c.json({ message: `Deleted ${result.length} records successfully.`, deletedCount: result.length });
    } else {
      const result = await db.delete(returnData).where(eq(returnData.uploadedBy, user.id)).returning({ id: returnData.id });
      return c.json({ message: `Deleted ${result.length} of your uploaded records.`, deletedCount: result.length });
    }
  } catch (error: any) {
    console.error("Delete Error:", error);
    return c.json({ error: error.message || "Failed to delete data" }, 500);
  }
};
