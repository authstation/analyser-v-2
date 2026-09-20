import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { columnMappings } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { eq } from "drizzle-orm";

const DEFAULT_MODULE_MAPPINGS: Record<string, any> = {
  bin_analyser: {}, // Optional: Add default mappings if needed
  ibas: {},
  return_data: {},
  revenue: {}
};

export const getMappings: Handler = async (c) => {
  try {
    const moduleName = c.req.query('module') || 'bin_analyser';
    let data = await db.query.columnMappings.findMany({
      where: (mappings, { eq }) => eq(mappings.module, moduleName)
    });

    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch mappings' }, 500);
  }
};

export const updateMappings: Handler = async (c) => {
  try {
    const { mappings } = await c.req.json();
    const moduleName = c.req.query('module') || 'bin_analyser';
    if (!mappings || typeof mappings !== 'object') {
      return c.json({ error: 'Invalid mappings data' }, 400);
    }

    // Clear old mappings for this module
    await db.delete(columnMappings).where(eq(columnMappings.module, moduleName));

    // Insert new mappings
    const toInsert = Object.keys(mappings).map(dbKey => ({
      module: moduleName,
      dbColumn: dbKey,
      excelHeader: mappings[dbKey]
    })).filter(m => m.excelHeader && m.excelHeader.trim() !== '');

    if (toInsert.length > 0) {
      await db.insert(columnMappings).values(toInsert);
    }

    return c.json({ message: 'Mappings saved successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to save mappings' }, 500);
  }
};
