import { db } from "@/framework/facade.js";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { appSettings, subscriptions } from "@/modules/settings/database/models/settings.js";

// ---------------------------------------------------------------------------
// Index-friendly SQL fragments
//
// The historic code wrapped indexed columns in `cast(col as date)` (and used
// `ILIKE '%..%'` on semicolon-joined activity text), which forced sequential
// scans on every dashboard request. These helpers keep the column bare so the
// planner can use a B-tree / GIN index, and express the activity filters as
// array overlap against the normalized `*_areas` columns.
// ---------------------------------------------------------------------------

/** First-day-of-month timestamp for a "YYYY-MM" string (index-friendly). */
function monthStart(ym: string): SQL {
  return sql`(to_date(${`${ym}-01`}, 'YYYY-MM-DD')::timestamp)`;
}

/**
 * Why: `cast(tax_period as date) >= ...` cannot use the index on `tax_period`.
 * When: Any filtered analytics/entity query over a month range.
 * Where: return-data-analyser controllers.
 * How: Half-open range on the bare column: `>= from-01` and `< (to-01 + 1 month)`.
 */
export function monthRange(columnExpr: string, fromYm: string, toYm: string): SQL {
  const col = sql.raw(columnExpr);
  return sql`${col} >= ${monthStart(fromYm)} AND ${col} < (${monthStart(toYm)} + interval '1 month')`;
}

/** `column <= last day of toYm` equivalent, expressed as a strict upper bound. */
export function monthBefore(columnExpr: string, toYm: string): SQL {
  const col = sql.raw(columnExpr);
  return sql`${col} < (${monthStart(toYm)} + interval '1 month')`;
}

/**
 * Why: Economic activities are stored as semicolon-joined text; the old
 *      `ILIKE '%x%'` OR-chain could not use an index and matched substrings.
 * When: Filtering entities/returns by major/manufacturing/service activity.
 * Where: analytics, drilldown and non-filer endpoints.
 * How: `column && ARRAY[...]::text[]` (true when any selected activity is
 *      present) backed by a GIN index on the normalized `*_areas` array column.
 */
export function areaOverlap(columnExpr: string, values: string[]): SQL {
  if (values.length === 0) return sql`TRUE`;
  const col = sql.raw(columnExpr);
  const arr = sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;
  return sql`${col} && ${arr}`;
}

/** Inclusive "YYYY-MM" month list between two months. */
export function listMonths(fromYm: string, toYm: string): string[] {
  const months: string[] = [];
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  if (isNaN(fy) || isNaN(fm) || isNaN(ty) || isNaN(tm)) return months;
  let index = fy * 12 + (fm - 1);
  const end = ty * 12 + (tm - 1);
  while (index <= end) {
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    index++;
  }
  return months;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings).where(inArray(appSettings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function extractRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.rows)) return result.rows;
  return Array.from(result || []);
}

/**
 * Why: Convert spreadsheet money cells into a decimal-safe numeric string.
 * When: Importing return-data rows (all numeric columns).
 * Where: src/modules/return-data-analyser/utils/helpers.ts.
 * How: Understands leading/trailing signs, Excel accounting parentheses
 *      ("(1,234.56)" -> "-1234.56"), thousand separators and currency noise,
 *      and returns a validated string (no parseFloat round-trip) so
 *      numeric(20,2) keeps full precision. Returns null when empty/unparseable.
 */
export function parseNumeric(val: any): string | null {
  if (val === null || val === undefined) return null;

  // xlsx returns real numeric cells as numbers: keep them verbatim so
  // numeric(20,2) stores full precision (no float <-> string round-trip).
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : null;

  let str = String(val).trim();
  if (str === "") return null;

  // Strip currency symbols / common codes so "BDT 1,234" and "Tk 500" parse.
  str = str
    .replace(/[৳$€£¥₹%]/g, "")
    .replace(/\b(BDT|Tk|USD|EUR|GBP|INR)\b/gi, "")
    .trim();
  if (str === "") return null;

  // Excel accounting negatives: (1,234.56) means -1234.56.
  let negative = false;
  const paren = str.match(/\(\s*([^()]*?)\s*\)/);
  if (paren) {
    negative = true;
    const start = paren.index ?? 0;
    str = `${str.slice(0, start)}${paren[1]}${str.slice(start + paren[0].length)}`.trim();
  }

  // Trailing-minus negatives: 1234.56- means -1234.56.
  if (str.endsWith("-")) {
    negative = !negative;
    str = str.slice(0, -1).trim();
  }

  // Drop thousands separators and any remaining spaces.
  str = str.replace(/[,\s]/g, "");
  if (str === "") return null;

  // Validate a plain (optionally signed / exponent) decimal so we never
  // silently store garbage as a number.
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(str)) return null;

  if (str.startsWith("-")) {
    negative = !negative;
    str = str.slice(1);
  } else if (str.startsWith("+")) {
    str = str.slice(1);
  }

  const result = `${negative ? "-" : ""}${str}`;
  return /^-0(\.0+)?$/.test(result) ? "0" : result;
}

export function parseTaxPeriod(val: string): Date | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split("-");
    const y = parseInt(parts[0] || "0");
    const m = parseInt(parts[1] || "1") - 1;
    if (!isNaN(y) && !isNaN(m) && m >= 0 && m < 12) {
      return new Date(Date.UTC(y, m, 1));
    }
  }
  const parts = trimmed.replace(",", "").split(/\s+/);
  if (parts.length >= 2) {
    const monthStr = parts[0];
    if (!monthStr) return null;
    const year = parseInt(parts[1] as string);
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december"
    ];
    const monthIndex = months.findIndex((m) => m.startsWith(monthStr.toLowerCase().substring(0, 3)));
    if (monthIndex !== -1 && !isNaN(year)) {
      return new Date(Date.UTC(year, monthIndex, 1));
    }
  }
  return null;
}

export function parseAreaParam(param: string | null | undefined): string[] {
  if (!param || param === "All") return [];
  if (param.includes("|||")) {
    return param.split("|||").map((s) => s.trim()).filter(Boolean);
  }
  if (param.includes(";")) {
    return param.split(";").map((s) => s.trim()).filter(Boolean);
  }
  let str = param;
  const placeholders: { [k: string]: string } = {};
  if (str.includes("Trading, including e-Commerce")) {
    str = str.replace(/Trading,\s*including e-Commerce/g, "___TRADING_ECOMMERCE___");
    placeholders["___TRADING_ECOMMERCE___"] = "Trading, including e-Commerce";
  }
  if (str.includes("Leather, Leather Products & Footwear")) {
    str = str.replace(/Leather,\s*Leather Products & Footwear/g, "___LEATHER_FOOTWEAR___");
    placeholders["___LEATHER_FOOTWEAR___"] = "Leather, Leather Products & Footwear";
  }
  return str
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => placeholders[s] || s);
}

export const DEFAULT_RETURN_DATA_MAPPINGS: Record<string, string> = {
  division: "Division",
  circle: "Circle",
  bin: "BIN",
  submission_id: "Submission ID",
  tax_period: "Tax Period",
  has_activities: "Any activities in this Tax Period?",
  total_sales_value: "Total Sales Value",
  total_payable_vat: "Total Payable (VAT)",
  total_payable_sd: "Total Payable (SD)",
  total_input_tax_credit_value: "Total Input Tax Credit (Value)",
  total_input_tax_credit_vat: "Total Input Tax Credit (VAT)",
  increasing_adjustment: "Increasing Adjustment",
  decreasing_adjustment: "Decreasing Adjustment",
  net_payable_vat: "Net Payable (VAT)",
  net_payable_sd: "Net Payable (SD)",
  fine_penalty: "Fine/Penalty for Non-submission Return",
  deposited_vat: "Deposited (VAT)",
  deposited_sd: "Deposited (SD)",
  closing_balance_vat: "Closing Balance (VAT)",
  closing_balance_sd: "Closing Balance (SD)",
  vds_increasing: "VDS (Increasing)",
  vds_decreasing: "VDS (Decreasing)",
  advanced_tax_paid: "Advanced Tax Paid",
  submission_date: "Submission Date",
  last_amendment_date: "Last Amendment Date"
};

export async function getUserApprovedCircleIds(user: any): Promise<number[] | null> {
  if (user.role === "admin" || user.role?.name === "admin") return null;
  const subs = await db
    .select({ circleId: subscriptions.circleId })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.sub ?? user.id), eq(subscriptions.status, "approved")));
  return subs.map((s) => s.circleId);
}

export function resolveAllowedCircleIds(approvedIds: number[] | null, requestedIds: number[]) {
  if (approvedIds === null) {
    return { allowedCircleIds: requestedIds.length > 0 ? requestedIds : null, isUnauthorized: false };
  }
  if (requestedIds.length === 0) {
    return { allowedCircleIds: approvedIds, isUnauthorized: approvedIds.length === 0 };
  }
  const allowed = requestedIds.filter((id) => approvedIds.includes(id));
  return { allowedCircleIds: allowed, isUnauthorized: allowed.length === 0 };
}

export function parseTaxPeriodRange(fromYm?: string, toYm?: string) {
  if (!fromYm && !toYm) return null;
  const startYm = fromYm || toYm!;
  const endYm = toYm || fromYm!;

  const [sYear, sMonth] = startYm.split("-").map(Number);
  const [eYear, eMonth] = endYm.split("-").map(Number);

  const startIso = `${sYear}-${String(sMonth).padStart(2, "0")}-01 00:00:00`;
  const lastDay = new Date(Date.UTC(eYear, eMonth, 0)).getUTCDate();
  const endIso = `${eYear}-${String(eMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")} 23:59:59`;

  return {
    startYear: sYear,
    startMonth: sMonth,
    endYear: eYear,
    endMonth: eMonth,
    startIso,
    endIso
  };
}

// ---------------------------------------------------------------------------
// Filing compliance — single source of truth for the entity screens
// ---------------------------------------------------------------------------

/** Parse "YYYY-MM" (or "YYYY-MM-DD") into a month index; null when invalid. */
function toPeriodIndex(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1] as string, 10);
  const month = parseInt(match[2] as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
  return year * 12 + (month - 1);
}

/** Format a month index (year*12 + monthIndex0) as "YYYY-MM". */
function formatPeriodIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * A return for tax period M is due by the 15th of the following month.
 * Returns the latest period whose filing deadline has already passed as of
 * `asOf`. Periods after this are not yet due and must NOT be counted as
 * non-filed (fixes "the current month is always due" deflation).
 */
export function getLastDuePeriod(asOf: Date = new Date()): string {
  const nowIndex = asOf.getFullYear() * 12 + asOf.getMonth();
  const lastDueIndex = asOf.getDate() >= 15 ? nowIndex - 1 : nowIndex - 2;
  return formatPeriodIndex(lastDueIndex);
}

/**
 * Effective "as of" period for compliance — the earlier of:
 *  - the last period whose filing deadline has passed (time-based), and
 *  - the latest tax period present in the data (so a stale import does not
 *    invent non-filers, and a future-dated outlier cannot inflate totals).
 */
export function getDueCutoff(latestDataPeriod?: string | null, asOf: Date = new Date()): string {
  const lastDue = getLastDuePeriod(asOf);
  if (!latestDataPeriod) return lastDue;
  return latestDataPeriod < lastDue ? latestDataPeriod : lastDue;
}

export interface CompliancePeriod {
  period?: string | null;
  hasActivities?: string | null;
}

export interface ComplianceResult {
  binIssueDate: string;
  totalDue: number;
  totalSubmitted: number;
  activityYes: number;
  activityNo: number;
  activityUnknown: number;
  nonFiled: number;
  /** null when compliance cannot be measured (no registration date or nothing due yet). */
  complianceRate: number | null;
  /** Returns filed for periods before registration (data anomaly) — surfaced, never clamped away. */
  overFiledCount: number;
  dueFrom: string | null;
  dueTo: string | null;
}

/**
 * Why: The same BIN showed three different "compliance" numbers because the
 *      formula was copy-pasted in the trends endpoint, the details report and
 *      the Vue drilldown (with a hard-coded fallback date and a `Math.max`
 *      that hid over-filing).
 * When: Any entity-level filing/compliance view.
 * Where: src/modules/return-data-analyser/utils/helpers.ts.
 * How: Pure function — due periods run from the BIN registration month to the
 *      deadline-aware cutoff; a missing registration date or zero due periods
 *      yields complianceRate = null ("N/A") instead of a misleading 100%.
 */
export function computeCompliance(params: {
  binIssueDate?: string | null;
  periods: CompliancePeriod[];
  lastDuePeriod: string;
}): ComplianceResult {
  const issueIndex = toPeriodIndex(params.binIssueDate);
  const dueToIndex = toPeriodIndex(params.lastDuePeriod);

  const seen = new Set<string>();
  let activityYes = 0;
  let activityNo = 0;
  let activityUnknown = 0;
  let overFiledCount = 0;

  for (const entry of params.periods) {
    const key = entry.period ? String(entry.period).trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const activity = (entry.hasActivities ?? "").toString().trim().toLowerCase();
    if (activity === "yes") activityYes++;
    else if (activity === "no") activityNo++;
    else activityUnknown++;

    const index = toPeriodIndex(key);
    if (index !== null && issueIndex !== null && index < issueIndex) {
      overFiledCount++;
    }
  }

  const totalSubmitted = seen.size;

  let totalDue = 0;
  let dueFrom: string | null = null;
  if (issueIndex !== null && dueToIndex !== null && dueToIndex >= issueIndex) {
    totalDue = dueToIndex - issueIndex + 1;
    dueFrom = formatPeriodIndex(issueIndex);
  }

  const nonFiled = Math.max(0, totalDue - totalSubmitted);
  const complianceRate =
    issueIndex !== null && totalDue > 0
      ? Math.round(Math.min(100, (totalSubmitted / totalDue) * 100) * 10) / 10
      : null;

  const issue =
    params.binIssueDate && params.binIssueDate !== "N/A" ? String(params.binIssueDate) : "N/A";

  return {
    binIssueDate: issue,
    totalDue,
    totalSubmitted,
    activityYes,
    activityNo,
    activityUnknown,
    nonFiled,
    complianceRate,
    overFiledCount,
    dueFrom,
    dueTo: dueToIndex !== null ? formatPeriodIndex(dueToIndex) : null
  };
}

/**
 * Refresh the analytics materialized view after bulk writes to `return_data`.
 *
 * The dashboard reads pre-aggregated metrics from `mv_return_bin_month`, so any
 * import/delete must refresh it or the dashboard serves stale figures until the
 * next manual refresh. `CONCURRENTLY` keeps reads available during the refresh
 * (it needs the unique index created by the model hook); if that fails — e.g.
 * the view does not exist yet — fall back to a plain refresh and finally log.
 */
export async function refreshReturnBinMonthView(): Promise<void> {
  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_return_bin_month"`);
  } catch {
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW "mv_return_bin_month"`);
    } catch (err: any) {
      console.warn("[MV] mv_return_bin_month refresh skipped:", err?.message || err);
    }
  }
}
