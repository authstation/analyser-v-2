import { db } from "@/framework/facade.js";
import { and, eq, inArray } from "drizzle-orm";
import { appSettings, subscriptions } from "@/modules/settings/database/models/settings.js";

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

export function parseNumeric(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  const clean = String(val).replace(/,/g, "").trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n.toString();
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
