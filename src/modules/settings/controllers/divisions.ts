import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { divisions } from "@/modules/settings/database/models/settings.js";
import { eq } from "drizzle-orm";

export const getDivisions: Handler = async (c) => {
  try {
    const data = await db.query.divisions.findMany({
      orderBy: (divisions, { asc }) => [asc(divisions.name)],
    });
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch divisions' }, 500);
  }
};

export const createDivision: Handler = async (c) => {
  try {
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'Division name is required' }, 400);

    const existing = await db.query.divisions.findFirst({ where: (d, { eq }) => eq(d.name, name) });
    if (existing) return c.json({ error: 'Division already exists' }, 400);

    const newDivision = await db.insert(divisions).values({ name }).returning();
    return c.json({ data: newDivision[0], message: 'Division created' }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create division' }, 500);
  }
};

export const updateDivision: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'Division name is required' }, 400);

    const existing = await db.query.divisions.findFirst({
      where: (d, { eq, and, ne }) => and(
        eq(d.name, name), 
        ne(d.id, id)
      )
    });
    
    if (existing) {
      return c.json({ error: 'Another division with this name already exists!' }, 400);
    }

    const updated = await db.update(divisions).set({ name }).where(eq(divisions.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Division not found' }, 404);

    return c.json({ data: updated[0], message: 'Division updated' });
  } catch (error) {
    return c.json({ error: 'Failed to update division' }, 500);
  }
};

export const deleteDivision: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const deleted = await db.delete(divisions).where(eq(divisions.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Division not found' }, 404);

    return c.json({ message: 'Division deleted' });
  } catch (error) {
    return c.json({ error: 'Failed to delete division (make sure no circles depend on it)' }, 500);
  }
};
