import type { Handler } from "hono";
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
