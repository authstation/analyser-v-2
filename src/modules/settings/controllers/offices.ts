import { db } from "@/framework/facade.js";
import { ibasOffices } from '@/modules/settings/database/models/settings.js';

export const getOffices = async (c: any) => {
  try {
    const offices = await db.select().from(ibasOffices);
    return c.json(offices);
  } catch (error) {
    return c.json({ error: 'Failed to fetch offices' }, 500);
  }
};

export const createOffice = async (c: any) => {
  try {
    const body = await c.req.json();
    const result = await db.insert(ibasOffices).values({
      officeName: body.officeName,
      areaName: body.areaName,
    }).returning();
    return c.json(result[0], 201);
  } catch (error) {
    return c.json({ error: 'Failed to create office' }, 500);
  }
};
