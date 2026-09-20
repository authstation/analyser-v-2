import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { circles, divisions } from "@/modules/settings/database/models/settings.js";
import { eq } from "drizzle-orm";

export const getCircles: Handler = async (c) => {
  try {
    const data = await db.select({
      id: circles.id,
      name: circles.name,
      divisionId: circles.divisionId,
      divisionName: divisions.name
    })
    .from(circles)
    .leftJoin(divisions, eq(circles.divisionId, divisions.id))
    .orderBy(circles.name);
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch circles' }, 500);
  }
};

export const createCircle: Handler = async (c) => {
  try {
    const { name, divisionId } = await c.req.json();
    if (!name || !divisionId) return c.json({ error: 'Name and Division ID are required' }, 400);

    const existing = await db.query.circles.findFirst({
      where: (circles, { eq, and }) => and(eq(circles.name, name), eq(circles.divisionId, parseInt(divisionId)))
    });
    
    if (existing) {
      return c.json({ error: 'This circle already exists in the selected division!' }, 400);
    }

    const newCircle = await db.insert(circles).values({ name, divisionId: parseInt(divisionId) }).returning();
    return c.json({ data: newCircle[0], message: 'Circle created' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create circle' }, 500);
  }
};

export const updateCircle: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { name, divisionId } = await c.req.json();
    if (!name || !divisionId) return c.json({ error: 'Name and Division ID are required' }, 400);

    const existing = await db.query.circles.findFirst({
      where: (circles, { eq, and, ne }) => and(
        eq(circles.name, name), 
        eq(circles.divisionId, parseInt(divisionId)),
        ne(circles.id, id)
      )
    });
    
    if (existing) {
      return c.json({ error: 'Another circle with this name already exists in the selected division!' }, 400);
    }

    const updated = await db.update(circles).set({ name, divisionId: parseInt(divisionId) }).where(eq(circles.id, id)).returning();
    if (updated.length === 0) return c.json({ error: 'Circle not found' }, 404);

    return c.json({ data: updated[0], message: 'Circle updated' });
  } catch (error) {
    return c.json({ error: 'Failed to update circle' }, 500);
  }
};

export const deleteCircle: Handler = async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const deleted = await db.delete(circles).where(eq(circles.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: 'Circle not found' }, 404);

    return c.json({ message: 'Circle deleted' });
  } catch (error) {
    return c.json({ error: 'Failed to delete circle' }, 500);
  }
};
