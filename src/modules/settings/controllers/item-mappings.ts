import { db } from "@/framework/facade.js";
import { itemMappings } from '@/modules/settings/database/models/settings.js';
import { eq } from 'drizzle-orm';

export const getItemMappings = async (c: any) => {
  const moduleName = c.req.query('module') || 'ibas';
  try {
    const mappings = await db.select().from(itemMappings).where(eq(itemMappings.moduleName, moduleName));
    return c.json({ data: mappings }); // consistent with other endpoints
  } catch (error) {
    return c.json({ error: 'Failed to fetch item mappings' }, 500);
  }
};

export const createItemMapping = async (c: any) => {
  try {
    const body = await c.req.json();
    if (!body.itemName || !body.commonItem) {
      return c.json({ error: 'itemName and commonItem are required' }, 400);
    }
    const result = await db.insert(itemMappings).values({
      moduleName: body.moduleName || 'ibas',
      itemName: body.itemName,
      commonItem: body.commonItem,
      status: body.status || 'approved',
    }).returning();
    return c.json(result[0], 201);
  } catch (error) {
    return c.json({ error: 'Failed to create item mapping' }, 500);
  }
};

export const updateItemMapping = async (c: any) => {
  const id = parseInt(c.req.param('id'), 10);
  try {
    const body = await c.req.json();
    const result = await db.update(itemMappings).set({
      itemName: body.itemName,
      commonItem: body.commonItem,
      status: body.status,
    }).where(eq(itemMappings.id, id)).returning();
    if (result.length === 0) return c.json({ error: 'Item mapping not found' }, 404);
    return c.json(result[0]);
  } catch (error) {
    return c.json({ error: 'Failed to update item mapping' }, 500);
  }
};

export const deleteItemMapping = async (c: any) => {
  const id = parseInt(c.req.param('id'), 10);
  try {
    const deleted = await db.delete(itemMappings).where(eq(itemMappings.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Item mapping not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete item mapping' }, 500);
  }
};
