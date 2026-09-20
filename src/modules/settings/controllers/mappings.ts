import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { columnMappings } from "@/modules/bin-analyser/database/models/bin-analyser.js";
import { or, eq } from "drizzle-orm";

const normalizeModule = (mod: string) => {
  if (mod === 'bin' || mod === 'bin_analyser') return 'bin_analyser';
  if (mod === 'return' || mod === 'return_data') return 'return_data';
  return mod;
};

export const getMappings: Handler = async (c) => {
  try {
    const rawModule = c.req.query('module') || 'bin_analyser';
    const moduleName = normalizeModule(rawModule);
    let data = await db.query.columnMappings.findMany({
      where: (mappings, { or, eq }) => or(eq(mappings.module, moduleName), eq(mappings.module, rawModule))
    });

    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch mappings' }, 500);
  }
};

export const updateMappings: Handler = async (c) => {
  try {
    const { mappings } = await c.req.json();
    const rawModule = c.req.query('module') || 'bin_analyser';
    const moduleName = normalizeModule(rawModule);
    if (!mappings || typeof mappings !== 'object') {
      return c.json({ error: 'Invalid mappings data' }, 400);
    }

    // Clear old mappings for both module aliases
    await db.delete(columnMappings).where(
      or(eq(columnMappings.module, moduleName), eq(columnMappings.module, rawModule))
    );

    // Insert new mappings under normalized module name and alias
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
