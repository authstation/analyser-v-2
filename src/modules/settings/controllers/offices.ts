import { eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { ibasOffices } from "@/modules/settings/database/models/settings.js";

export const getOffices = async (c: any) => {
  try {
    const offices = await db.select().from(ibasOffices);
    return c.json(offices);
  } catch (error) {
    return c.json({ error: "Failed to fetch offices" }, 500);
  }
};

export const createOffice = async (c: any) => {
  try {
    const body = await c.req.json();
    if (!body.officeName || !body.areaName) {
      return c.json({ error: "Office name and area name are required" }, 400);
    }
    const result = await db.insert(ibasOffices).values({
      officeName: String(body.officeName).trim(),
      areaName: String(body.areaName).trim(),
    }).returning();
    return c.json(result[0], 201);
  } catch (error) {
    return c.json({ error: "Failed to create office" }, 500);
  }
};

export const updateOffice = async (c: any) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid office ID" }, 400);
    }
    const body = await c.req.json();
    const updateData: any = {};
    if (body.officeName !== undefined) updateData.officeName = String(body.officeName).trim();
    if (body.areaName !== undefined) updateData.areaName = String(body.areaName).trim();

    const result = await db.update(ibasOffices).set(updateData).where(eq(ibasOffices.id, id)).returning();
    if (result.length === 0) return c.json({ error: "Office not found" }, 404);
    return c.json(result[0]);
  } catch (error) {
    return c.json({ error: "Failed to update office" }, 500);
  }
};

export const deleteOffice = async (c: any) => {
  try {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid office ID" }, 400);
    }
    const deleted = await db.delete(ibasOffices).where(eq(ibasOffices.id, id)).returning();
    if (deleted.length === 0) return c.json({ error: "Office not found" }, 404);
    return c.json({ message: "Office deleted successfully", success: true });
  } catch (error) {
    return c.json({ error: "Failed to delete office" }, 500);
  }
};

