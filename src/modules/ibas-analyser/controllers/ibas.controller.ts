import type { Handler } from 'hono';
import { db, HttpStatusCodes } from '@/framework/facade.js';
import { sql, eq, and, desc } from 'drizzle-orm';
import { ibasData } from '@/modules/ibas-analyser/database/models/ibas-analyser.js';
import { ibasOffices, itemMappings, appSettings } from '@/modules/settings/database/models/settings.js';
import { columnMappings } from '@/modules/bin-analyser/database/models/bin-analyser.js';
import * as xlsx from 'xlsx';

/**
 * Ensure default column mappings for ibas_analyser
 */
async function ensureDefaultIbasMappings() {
  const existing = await db.select().from(columnMappings).where(eq(columnMappings.module, 'ibas_analyser'));
  if (existing.length === 0) {
    const defaults = [
      { module: 'ibas_analyser', dbColumn: 'date', excelHeader: 'Date' },
      { module: 'ibas_analyser', dbColumn: 'item', excelHeader: 'Economic Code Description' },
      { module: 'ibas_analyser', dbColumn: 'office', excelHeader: 'Office Description' },
      { module: 'ibas_analyser', dbColumn: 'amount', excelHeader: 'Net Amount' }
    ];
    for (const d of defaults) {
      await db.insert(columnMappings).values(d).catch(() => {});
    }
  }
}

/**
 * Parse uploaded iBAS Excel workbook
 */
export const parse: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No valid file uploaded' }, HttpStatusCodes.BAD_REQUEST);
    }

    // Fetch date format setting
    const settings = await db.query.appSettings.findMany({
      where: eq(appSettings.key, 'ibas_date_format')
    });
    const dateFormat = settings[0]?.value || 'DD/MM/YYYY';

    const arrayBuffer = await file.arrayBuffer();
    const workbook = xlsx.read(Buffer.from(arrayBuffer), { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return c.json({ error: 'No sheets found in Excel file' }, HttpStatusCodes.BAD_REQUEST);

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return c.json({ error: 'Sheet could not be read' }, HttpStatusCodes.BAD_REQUEST);

    const rawData = xlsx.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, any>[];

    await ensureDefaultIbasMappings();
    let mappings = await db.select().from(columnMappings).where(eq(columnMappings.module, 'ibas_analyser'));

    const dbToExcelMap: Record<string, string> = {};
    mappings.forEach((m: any) => {
      dbToExcelMap[m.dbColumn] = m.excelHeader;
    });

    const dateHeader = dbToExcelMap['date'] || 'Date';
    const itemHeader = dbToExcelMap['item'] || 'Economic Code Description';
    const officeHeader = dbToExcelMap['office'] || 'Office Description';
    const amountHeader = dbToExcelMap['amount'] || 'Net Amount';

    const allItemMappings = await db
      .select()
      .from(itemMappings)
      .where(and(eq(itemMappings.moduleName, 'ibas'), eq(itemMappings.status, 'approved')));
    const validItemsMap = new Set(allItemMappings.map((m: any) => m.itemName));

    const validRecords: any[] = [];
    const unknownItemsSet = new Set<string>();

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row) continue;

      const rawDate = row[dateHeader];
      const rawItem = row[itemHeader] ? row[itemHeader].toString().trim() : '';
      const rawOffice = row[officeHeader] ? row[officeHeader].toString().trim() : '';
      const rawAmount = row[amountHeader] ? row[amountHeader].toString() : '';

      if (!rawDate || !rawItem || !rawOffice || !rawAmount) continue;

      const cleanAmountStr = rawAmount.replace(/[, ]/g, '');
      const amountVal = Math.round(parseFloat(cleanAmountStr));
      if (isNaN(amountVal) || amountVal === 0) continue;

      let parsedDate: Date | null = null;
      if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        const dObj = new Date(rawDate.getTime() + 4 * 60 * 60 * 1000);
        parsedDate = new Date(Date.UTC(dObj.getFullYear(), dObj.getMonth(), dObj.getDate()));
      } else {
        const parts = rawDate.toString().split(/[-/]/);
        if (parts.length === 3) {
          let day = 1, month = 0, year = 1970;
          if (dateFormat === 'MM/DD/YYYY') {
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
          } else {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1;
            year = parseInt(parts[2], 10);
          }
          parsedDate = new Date(Date.UTC(year, month, day));
        } else {
          parsedDate = new Date(rawDate);
        }
      }

      if (!parsedDate || isNaN(parsedDate.getTime())) continue;

      if (validItemsMap.has(rawItem)) {
        validRecords.push({
          date: parsedDate,
          item: rawItem,
          office: rawOffice,
          amount: amountVal,
          uploadedBy: user?.id ?? null
        });
      } else {
        unknownItemsSet.add(rawItem);
      }
    }

    return c.json({
      success: true,
      validRecords,
      unknownItems: Array.from(unknownItemsSet)
    });
  } catch (error: any) {
    console.error('Error parsing iBAS file:', error);
    return c.json({ error: 'Failed to parse file: ' + (error.message || '') }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Save parsed iBAS records into database
 */
export const save: Handler = async (c: any) => {
  try {
    const user = c.get('auth');
    const { records, officeId } = await c.req.json();

    if (!records || !Array.isArray(records)) {
      return c.json({ error: 'Invalid payload' }, HttpStatusCodes.BAD_REQUEST);
    }

    if (!officeId) {
      return c.json({ error: 'Office ID is required' }, HttpStatusCodes.BAD_REQUEST);
    }

    if (records.length === 0) {
      return c.json({ error: 'No records to save', count: 0 }, HttpStatusCodes.BAD_REQUEST);
    }

    const recordsToInsert = records.map((r: any) => ({
      date: new Date(r.date),
      item: r.item,
      rawOffice: r.office,
      officeId: parseInt(officeId),
      amount: r.amount,
      uploadedBy: user?.id ?? null
    }));

    let savedCount = 0;
    const batchSize = 1000;
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
      const batch = recordsToInsert.slice(i, i + batchSize);
      const inserted = await db.insert(ibasData).values(batch).returning({ id: ibasData.id });
      savedCount += inserted.length;
    }

    return c.json({ success: true, savedCount });
  } catch (error: any) {
    console.error('Error saving iBAS data:', error);
    return c.json({ error: 'Failed to save data: ' + (error.message || '') }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Request mapping for unmapped iBAS items
 */
export const requestMapping: Handler = async (c: any) => {
  try {
    const { items } = await c.req.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'No items provided' }, HttpStatusCodes.BAD_REQUEST);
    }

    const recordsToInsert = items.map((item: string) => ({
      moduleName: 'ibas',
      itemName: item,
      commonItem: 'Pending',
      status: 'pending'
    }));

    for (const record of recordsToInsert) {
      await db.insert(itemMappings).values(record).catch(() => {});
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error requesting item mappings:', error);
    return c.json({ error: 'Failed to request mappings' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Offices CRUD
 */
export const getOffices: Handler = async (c: any) => {
  try {
    const offices = await db.select().from(ibasOffices).orderBy(ibasOffices.officeName);
    return c.json(offices);
  } catch (error: any) {
    console.error('Error fetching offices:', error);
    return c.json({ error: 'Failed to fetch offices' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const createOffice: Handler = async (c: any) => {
  try {
    const { officeName, areaName } = await c.req.json();
    if (!officeName || !areaName) {
      return c.json({ error: 'Office Name and Area Name are required' }, HttpStatusCodes.BAD_REQUEST);
    }

    const [newOffice] = await db.insert(ibasOffices).values({ officeName, areaName }).returning();
    return c.json({ success: true, data: newOffice });
  } catch (error: any) {
    console.error('Error adding office:', error);
    return c.json({ error: 'Failed to add office' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const updateOffice: Handler = async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { officeName, areaName } = await c.req.json();
    if (!officeName || !areaName) {
      return c.json({ error: 'Office Name and Area Name are required' }, HttpStatusCodes.BAD_REQUEST);
    }

    await db.update(ibasOffices).set({ officeName, areaName }).where(eq(ibasOffices.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating office:', error);
    return c.json({ error: 'Failed to update office' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deleteOffice: Handler = async (c: any) => {
  try {
    const id = parseInt(c.req.param('id'));
    await db.delete(ibasOffices).where(eq(ibasOffices.id, id));
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting office:', error);
    return c.json({ error: 'Failed to delete office' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Reports
 */
export const dashboardReport: Handler = async (c: any) => {
  try {
    const totalVds = await db.select({ total: sql<number>`sum(${ibasData.amount})` }).from(ibasData);
    const trend = await db.execute(sql`
      SELECT to_char(date, 'YYYY-MM') as month, sum(amount)::int as total
      FROM ibas_data
      GROUP BY 1
      ORDER BY 1
    `);

    return c.json({
      totalVds: totalVds[0]?.total || 0,
      trend: trend || []
    });
  } catch (error: any) {
    console.error('Error fetching dashboard report:', error);
    return c.json({ error: 'Failed to fetch dashboard report' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const byOfficeReport: Handler = async (c: any) => {
  try {
    const data = await db.execute(sql`
      SELECT o.office_name as "officeName", o.area_name as "areaName", sum(d.amount)::bigint as total, count(d.id)::int as count
      FROM ibas_data d
      JOIN ibas_offices o ON d.office_id = o.id
      GROUP BY o.id, o.office_name, o.area_name
      ORDER BY total DESC
    `);
    return c.json(data || []);
  } catch (error: any) {
    console.error('Error fetching by-office report:', error);
    return c.json({ error: 'Failed to fetch report' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const byItemReport: Handler = async (c: any) => {
  try {
    const data = await db.execute(sql`
      SELECT d.item, sum(d.amount)::bigint as total, count(d.id)::int as count
      FROM ibas_data d
      GROUP BY d.item
      ORDER BY total DESC
    `);
    return c.json(data || []);
  } catch (error: any) {
    console.error('Error fetching by-item report:', error);
    return c.json({ error: 'Failed to fetch report' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const summaryReport: Handler = async (c: any) => {
  try {
    const totalOffices = await db.execute(sql`SELECT count(distinct office_id) as count FROM ibas_data`);
    const totalItems = await db.execute(sql`SELECT count(distinct item) as count FROM ibas_data`);
    const dateRange = await db.execute(sql`SELECT min(date) as min, max(date) as max FROM ibas_data`);
    const totalRecords = await db.execute(sql`SELECT count(*) as count FROM ibas_data`);

    return c.json({
      totalOffices: Number(totalOffices[0]?.count || 0),
      totalItems: Number(totalItems[0]?.count || 0),
      minDate: dateRange[0]?.min,
      maxDate: dateRange[0]?.max,
      totalRecords: Number(totalRecords[0]?.count || 0)
    });
  } catch (error: any) {
    console.error('Error fetching summary report:', error);
    return c.json({ error: 'Failed to fetch summary' }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
