import type { Handler } from "hono";
import * as xlsx from "xlsx";
import { db } from "@/framework/facade.js";
import { and, eq, sql } from "drizzle-orm";
import { binData } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { circles, policeStations } from "@/modules/settings/database/models/settings.js";
import { buildConditions } from "@/modules/bin-analyser/utils/helpers.js";

export const exportData: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);
    const q = c.req.query('q')?.trim();
    if (q) {
      conditions.push(sql`(${binData.bin} ILIKE ${'%' + q + '%'} OR ${binData.entityName} ILIKE ${'%' + q + '%'} OR ${binData.mobile} ILIKE ${'%' + q + '%'})`);
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      bin: binData.bin, entityName: binData.entityName,
      binIssueDate: binData.binIssueDate, binStatus: binData.binStatus,
      forcedRegistration: binData.forcedRegistration,
      majorArea: binData.majorAreaOfEconomicActivity,
      mfgArea: binData.areasOfManufacturing,
      srvArea: binData.areasOfService,
      email: binData.email, mobile: binData.mobile, address: binData.address,
      circleName: circles.name, policeStation: policeStations.name, eTin: binData.eTin
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .leftJoin(policeStations, eq(binData.policeStationId, policeStations.id))
      .where(whereClause)
      .limit(10000);

    const headers = ['BIN', 'Name', 'Status', 'Forced', 'Issue Date', 'Circle', 'Police Station', 'Address', 'Mobile', 'Email', 'Major Area', 'Mfg Area', 'Service Area', 'e-TIN'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      const row = [
        `"${r.bin || ''}"`,
        `"${(r.entityName || '').replace(/"/g, '""')}"`,
        `"${r.binStatus || ''}"`,
        `"${r.forcedRegistration || ''}"`,
        `"${r.binIssueDate ? new Date(r.binIssueDate).toISOString().split('T')[0] : ''}"`,
        `"${(r.circleName || '').replace(/"/g, '""')}"`,
        `"${(r.policeStation || '').replace(/"/g, '""')}"`,
        `"${(r.address || '').replace(/"/g, '""')}"`,
        `"${r.mobile || ''}"`,
        `"${r.email || ''}"`,
        `"${(r.majorArea || '').replace(/"/g, '""')}"`,
        `"${(r.mfgArea || '').replace(/"/g, '""')}"`,
        `"${(r.srvArea || '').replace(/"/g, '""')}"`,
        `"${r.eTin || ''}"`
      ];
      csvRows.push(row.join(','));
    }

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', 'attachment; filename="bin_export.csv"');
    return c.text(csvRows.join('\n'));
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'Failed to export data' }, 500);
  }
};

/**
 * Dedicated export for the drilldown pivot ("Registration Details") screen.
 * Mirrors drilldownPivot filtering (exact majorArea + columnType) so the file
 * contains exactly the rows shown in the table, and returns a real .xlsx.
 */
export const exportDrilldown: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { conditions } = await buildConditions(c, user);

    const majorArea = c.req.query('majorArea');
    const columnType = c.req.query('columnType')?.toLowerCase();

    if (majorArea && majorArea !== 'All' && majorArea !== 'Unknown') {
      conditions.push(eq(binData.majorAreaOfEconomicActivity, majorArea));
    }
    if (columnType === 'neither' || columnType === 'majoronly') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') = 'None' AND coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') = 'None'`);
    } else if (columnType === 'mfg') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfManufacturing}), ''), 'None') != 'None'`);
    } else if (columnType === 'srv' || columnType === 'service') {
      conditions.push(sql`coalesce(nullif(trim(${binData.areasOfService}), ''), 'None') != 'None'`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db.select({
      bin: binData.bin, entityName: binData.entityName,
      address: binData.address, mobile: binData.mobile,
      majorArea: binData.majorAreaOfEconomicActivity,
      mfgArea: binData.areasOfManufacturing,
      srvArea: binData.areasOfService,
      circleName: circles.name
    }).from(binData)
      .leftJoin(circles, eq(binData.circleId, circles.id))
      .where(whereClause)
      .limit(10000);

    const header = ['Sl', 'Name', 'Address', 'BIN', 'Mobile', 'Major Area', 'Mfg Area', 'Service Area', 'Circle'];
    const dataRows = rows.map((r, i) => [
      i + 1,
      r.entityName || 'Unknown',
      r.address || 'N/A',
      r.bin || '',
      r.mobile || 'N/A',
      r.majorArea || 'None',
      r.mfgArea || 'None',
      r.srvArea || 'None',
      r.circleName || ''
    ]);

    const worksheet = xlsx.utils.aoa_to_sheet([header, ...dataRows]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="registrations.xlsx"'
      }
    });
  } catch (error) {
    console.error('Drilldown export error:', error);
    return c.json({ error: 'Failed to export drilldown data' }, 500);
  }
};
