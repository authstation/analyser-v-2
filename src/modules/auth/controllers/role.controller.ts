import { eq } from "drizzle-orm";
import type { Handler } from "hono";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { roles } from "@/modules/auth/database/models/role.js";

/**
 * Why: Returns role records for role-aware UI and authorization setup.
 * When: Used by admin/management screens that need available roles.
 * Where: Mounted under auth role routes.
 */
export const index: Handler = async (c: any) => {
  try {
    const result = await db.query.roles.findMany();
    return c.json({ message: "Success", data: result }, HttpStatusCodes.OK);
  } catch (error) {
    return c.json({ error: 'Failed to fetch roles' }, 500);
  }
};

/**
 * Why: Fetches a single role to inspect role metadata by id.
 * When: Used for detail views or role validation checks.
 * Where: Mounted on auth role detail route with path param id.
 */
export const show: Handler = async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const result = await db.query.roles.findFirst({ where: eq(roles.id, id) });
    if (!result) return c.json({ error: 'Role not found' }, 404);
    return c.json({ message: "Success", data: result }, HttpStatusCodes.OK);
  } catch (error) {
    return c.json({ error: 'Failed to fetch role' }, 500);
  }
};
