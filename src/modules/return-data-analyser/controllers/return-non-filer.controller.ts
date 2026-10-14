import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { and, eq, inArray, sql, or } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { returnData } from "@/modules/return-data-analyser/database/models/return-data.js";
import { circles, policeStations } from "@/modules/settings/database/models/settings.js";
import { getUserApprovedCircleIds, parseTaxPeriodRange, parseAreaParam } from "../utils/helpers.js";

export const nonFilerList: Handler = async (c: any) => {
  const user = c.get("auth");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const approvedCircleIds = await getUserApprovedCircleIds(user);
    const filterCircles = c.req.query("circles") || c.req.query("circle");
    const filterPs = c.req.query("ps") || c.req.query("policeStation");
    const filterStatus = c.req.query("status");
    const filterReg = c.req.query("reg") || c.req.query("forcedRegistration");
    const filterMajor = c.req.query("major") || c.req.query("majorArea");
    const filterMfg = c.req.query("mfg") || c.req.query("manufacturingArea");
    const filterService = c.req.query("service") || c.req.query("serviceArea");
    const filterFromDate = c.req.query("fromIssueDate") || c.req.query("fromDate");
    const filterToDate = c.req.query("toIssueDate") || c.req.query("toDate");
    const filterFromTaxPeriod = c.req.query("fromTaxPeriod");
    const filterToTaxPeriod = c.req.query("toTaxPeriod");
    const q = c.req.query("q");

    const taxRange = parseTaxPeriodRange(filterFromTaxPeriod, filterToTaxPeriod);

    // 1. Find the latest tax period in return_data
    const maxPeriodRow = await db
      .select({
        maxPeriod: sql`max(${returnData.taxPeriod})`
      })
      .from(returnData);
    const maxPeriodStr = maxPeriodRow[0]?.maxPeriod ? String(maxPeriodRow[0].maxPeriod) : null;
    let latestYr = new Date().getFullYear();
    let latestMo = new Date().getMonth() + 1;
    if (maxPeriodStr) {
      const match = maxPeriodStr.match(/^(\d{4})-(\d{2})/);
      if (match) {
        latestYr = Number(match[1]);
        latestMo = Number(match[2]);
      } else {
        const d = new Date(maxPeriodStr);
        latestYr = d.getFullYear();
        latestMo = d.getMonth() + 1;
      }
    }

    // 2. Fetch all matching entities from binData
    const conditions: any[] = [];
    if (approvedCircleIds !== null) {
      if (approvedCircleIds.length === 0) return c.json({ data: [], total: 0 });
      conditions.push(inArray(binData.circleId, approvedCircleIds));
    }

    if (filterCircles && filterCircles !== "All") {
      const arr = filterCircles
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (arr.length > 0) {
        const circleRows = await db.select({ id: circles.id }).from(circles).where(inArray(circles.name, arr));
        const cids = circleRows.map((r: any) => r.id);
        conditions.push(cids.length > 0 ? inArray(binData.circleId, cids) : sql`1 = 0`);
      }
    }

    if (filterPs && filterPs !== "All") {
      const arr = filterPs
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (arr.length > 0) {
        const psRows = await db.select({ id: policeStations.id }).from(policeStations).where(inArray(policeStations.name, arr));
        const psIds = psRows.map((r: any) => r.id);
        conditions.push(psIds.length > 0 ? inArray(binData.policeStationId, psIds) : sql`1 = 0`);
      }
    }

    if (filterStatus && filterStatus !== "All") {
      const arr = filterStatus
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (arr.length > 0) conditions.push(inArray(binData.binStatus, arr));
    }

    if (filterReg && filterReg !== "All") {
      const arr = filterReg
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (arr.length > 0) {
        const regValues = arr.map((v: string) => (v === "Forced" ? "Yes" : v === "Regular" ? "No" : v));
        conditions.push(inArray(binData.forcedRegistration, regValues));
      }
    }

    const majorList = parseAreaParam(filterMajor);
    if (majorList.length > 0) {
      const orClauses = majorList.map((v) => sql`${binData.majorAreaOfEconomicActivity} ILIKE ${"%" + v + "%"}`);
      conditions.push(or(...orClauses)!);
    }

    const mfgList = parseAreaParam(filterMfg);
    if (mfgList.length > 0) {
      const orClauses = mfgList.map((v) => sql`${binData.areasOfManufacturing} ILIKE ${"%" + v + "%"}`);
      conditions.push(or(...orClauses)!);
    }

    const serviceList = parseAreaParam(filterService);
    if (serviceList.length > 0) {
      const orClauses = serviceList.map((v) => sql`${binData.areasOfService} ILIKE ${"%" + v + "%"}`);
      conditions.push(or(...orClauses)!);
    }

    if (filterFromDate && filterFromDate.trim()) {
      conditions.push(sql`${binData.binIssueDate} >= cast(${filterFromDate.trim() + " 00:00:00"} as timestamp)`);
    }

    if (filterToDate && filterToDate.trim()) {
      conditions.push(sql`${binData.binIssueDate} <= cast(${filterToDate.trim() + " 23:59:59"} as timestamp)`);
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(
        sql`(${binData.bin} ILIKE ${term} OR ${binData.entityName} ILIKE ${term} OR ${binData.mobile} ILIKE ${term} OR ${binData.eTin} ILIKE ${term})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const entities = await db
      .select({
        bin: binData.bin,
        name: binData.entityName,
        address: binData.address,
        mobile: binData.mobile,
        eTin: binData.eTin,
        binIssueDate: binData.binIssueDate,
        binStatus: binData.binStatus,
        forcedRegistration: binData.forcedRegistration,
        majorArea: binData.majorAreaOfEconomicActivity,
        manufacturingArea: binData.areasOfManufacturing,
        serviceArea: binData.areasOfService,
        circleName: circles.name,
        policeStationName: policeStations.name
      })
      .from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
      .where(whereClause)
      .limit(50000);

    if (entities.length === 0) {
      return c.json({ data: [], total: 0, summary: [], totalSummary: null });
    }

    // 3. Count returns submitted for each entity
    const returnCountConditions: any[] = [];
    if (taxRange) {
      returnCountConditions.push(
        sql`${returnData.taxPeriod} >= cast(${taxRange.startIso} as timestamp)`,
        sql`${returnData.taxPeriod} <= cast(${taxRange.endIso} as timestamp)`
      );
    }

    const returnCountsQuery = db
      .select({
        bin: returnData.bin,
        submittedCount: sql<number>`count(distinct ${returnData.taxPeriod})`
      })
      .from(returnData);

    const returnCounts =
      returnCountConditions.length > 0
        ? await returnCountsQuery.where(and(...returnCountConditions)).groupBy(returnData.bin)
        : await returnCountsQuery.groupBy(returnData.bin);

    const submissionMap = new Map<string, number>();
    for (const row of returnCounts) {
      if (row.bin) submissionMap.set(row.bin, Number(row.submittedCount) || 0);
    }

    // 4. Calculate Non-Filed Months for each entity
    const results = [];
    for (const ent of entities) {
      if (!ent.bin) continue;

      let totalDue = 1;
      if (taxRange) {
        let issueYear = taxRange.startYear;
        let issueMonth = taxRange.startMonth;
        if (ent.binIssueDate) {
          const issueD = new Date(ent.binIssueDate);
          if (!isNaN(issueD.getTime())) {
            issueYear = issueD.getFullYear();
            issueMonth = issueD.getMonth() + 1;
          }
        }

        const issueIndex = issueYear * 12 + issueMonth;
        const startIndex = taxRange.startYear * 12 + taxRange.startMonth;
        const endIndex = taxRange.endYear * 12 + taxRange.endMonth;

        if (issueIndex > endIndex) {
          totalDue = 0;
        } else {
          const effectiveStartIndex = Math.max(issueIndex, startIndex);
          totalDue = endIndex - effectiveStartIndex + 1;
        }
      } else {
        if (ent.binIssueDate) {
          const issueD = new Date(ent.binIssueDate);
          if (!isNaN(issueD.getTime())) {
            const issueYear = issueD.getFullYear();
            const issueMonth = issueD.getMonth() + 1;
            const diffMonths = (latestYr - issueYear) * 12 + (latestMo - issueMonth) + 1;
            totalDue = Math.max(diffMonths, 1);
          }
        }
      }

      if (totalDue <= 0) continue;

      const submitted = submissionMap.get(ent.bin) || 0;
      const nonFiledMonths = Math.max(0, totalDue - submitted);

      if (nonFiledMonths > 0) {
        results.push({
          bin: ent.bin,
          name: ent.name || "N/A",
          address: ent.address || "N/A",
          mobile: ent.mobile || "-",
          eTin: ent.eTin || "",
          issueDate: ent.binIssueDate,
          grandTotalMonths: nonFiledMonths,
          totalDueMonths: totalDue,
          submittedCount: submitted,
          forcedRegistration: ent.forcedRegistration,
          majorArea: ent.majorArea,
          manufacturingArea: ent.manufacturingArea,
          serviceArea: ent.serviceArea,
          circleName: ent.circleName,
          policeStationName: ent.policeStationName,
          binStatus: ent.binStatus
        });
      }
    }

    // Sort descending by unfiled months
    results.sort((a, b) => b.grandTotalMonths - a.grandTotalMonths);

    // 5. Generate Monthly Breakdown Summary (Active BINs, Filers, Non-Filers, Rate)
    const monthMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      activeBins: number;
      filers: number;
      nonFilers: number;
    }>();

    let totalActiveBins = 0;
    let totalFilers = 0;
    let totalNonFilers = 0;

    for (const ent of entities) {
      if (!ent.bin) continue;

      let mKey = "Unknown";
      let mLabel = "Unknown Period";
      if (ent.binIssueDate) {
        const d = new Date(ent.binIssueDate);
        if (!isNaN(d.getTime())) {
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, "0");
          mKey = `${yr}-${mo}`;
          const monthName = d.toLocaleString("en-US", { month: "long" });
          mLabel = `${monthName} ${yr}`;
        }
      }

      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, {
          monthKey: mKey,
          monthLabel: mLabel,
          activeBins: 0,
          filers: 0,
          nonFilers: 0
        });
      }

      const m = monthMap.get(mKey)!;
      const isActive = ent.binStatus === "Active";
      const countThis = isActive || (filterStatus && filterStatus !== "All");

      if (countThis) {
        m.activeBins++;
        totalActiveBins++;

        const submitted = submissionMap.get(ent.bin) || 0;
        if (submitted > 0) {
          m.filers++;
          totalFilers++;
        } else {
          m.nonFilers++;
          totalNonFilers++;
        }
      }
    }

    const summaryList = Array.from(monthMap.values())
      .filter((m) => m.monthKey !== "Unknown")
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => {
        const rate = m.activeBins > 0 ? ((m.nonFilers / m.activeBins) * 100).toFixed(2) + "%" : "0.00%";
        return {
          month: m.monthLabel,
          monthKey: m.monthKey,
          activeBins: m.activeBins,
          filers: m.filers,
          nonFilers: m.nonFilers,
          nonFilerRate: rate
        };
      });

    const totalRate = totalActiveBins > 0 ? ((totalNonFilers / totalActiveBins) * 100).toFixed(2) + "%" : "0.00%";
    const totalSummary = {
      month: "Total",
      activeBins: totalActiveBins,
      filers: totalFilers,
      nonFilers: totalNonFilers,
      nonFilerRate: totalRate
    };

    return c.json({
      data: results,
      total: results.length,
      summary: summaryList,
      totalSummary
    });
  } catch (error) {
    console.error("Non Filer List Error:", error);
    return c.json({ error: "Failed to fetch non filer list" }, 500);
  }
};
