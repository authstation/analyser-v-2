/**
 * Why: `xlsx` is a large dependency that is only needed when the user actually
 *      clicks an "Export to Excel" button. A top-level `import * as XLSX from
 *      'xlsx'` pulled it into the initial JS chunk of every report page, even
 *      though the pages first render charts/tables and most users never export.
 * When: Inside an export handler, right before building the workbook.
 * Where: Any report page that offers an .xlsx download.
 * How: Dynamic import — Vite emits xlsx as its own async chunk, fetched on the
 *      first export click and cached by the browser afterwards.
 */
export async function loadXLSX(): Promise<typeof import("xlsx")> {
  return await import("xlsx");
}
