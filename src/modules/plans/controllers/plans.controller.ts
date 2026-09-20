import type { Handler } from "hono";
import { eq, desc, count } from "drizzle-orm";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { users } from "@/modules/auth/database/models/user.js";

/**
 * Why: Returns list of plans.
 * When: Used by admin plan management or user subscription checkout.
 * Where: GET /api/plans route.
 */
export const index: Handler = async (c: any) => {
  try {
    const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt));
    return c.json({ message: "Plans list fetched successfully", data: allPlans });
  } catch (error) {
    console.error("Fetch plans error:", error);
    return c.json({ error: "Failed to fetch plans" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Returns one plan by ID.
 * When: Detail view or checkout.
 * Where: GET /api/plans/{id} route.
 */
export const show: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid plan ID" }, HttpStatusCodes.BAD_REQUEST);
    }
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, id)
    });
    if (!plan) {
      return c.json({ error: "Plan not found" }, HttpStatusCodes.NOT_FOUND);
    }
    return c.json({ message: "Plan fetched successfully", data: plan });
  } catch (error) {
    console.error("Show plan error:", error);
    return c.json({ error: "Failed to fetch plan" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Creates a new plan.
 * When: Admin submits create plan form.
 * Where: POST /api/plans route.
 */
export const store: Handler = async (c: any) => {
  try {
    const body = await c.req.json();
    if (!body || !body.name) {
      return c.json({ error: "Plan name is required" }, HttpStatusCodes.BAD_REQUEST);
    }

    const [inserted] = await db.insert(plans).values({
      name: String(body.name).trim(),
      price: Number(body.price) || 0,
      durationDays: Number(body.durationDays) || 30,
      maxCircles: Number(body.maxCircles) || 1,
      isActive: body.isActive !== undefined ? !!body.isActive : true
    }).returning();

    return c.json({ message: "Plan created successfully", data: inserted }, HttpStatusCodes.CREATED);
  } catch (error: any) {
    console.error("Create plan error:", error);
    return c.json({ error: error.message || "Failed to create plan" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Updates an existing plan.
 * When: Admin edits active plan details.
 * Where: PUT /api/plans/{id} route.
 */
export const update: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid plan ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const body = await c.req.json();
    const existing = await db.query.plans.findFirst({
      where: eq(plans.id, id)
    });
    if (!existing) {
      return c.json({ error: "Plan not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const updatePayload: any = { updatedAt: new Date() };
    if (body.name !== undefined) updatePayload.name = String(body.name).trim();
    if (body.price !== undefined) updatePayload.price = Number(body.price);
    if (body.durationDays !== undefined) updatePayload.durationDays = Number(body.durationDays);
    if (body.maxCircles !== undefined) updatePayload.maxCircles = Number(body.maxCircles);
    if (body.isActive !== undefined) updatePayload.isActive = !!body.isActive;

    const [updated] = await db.update(plans).set(updatePayload).where(eq(plans.id, id)).returning();

    return c.json({ message: "Plan updated successfully", data: updated });
  } catch (error: any) {
    console.error("Update plan error:", error);
    return c.json({ error: error.message || "Failed to update plan" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Freezes an active plan so no new users can subscribe to it.
 * When: Admin clicks freeze on a plan.
 * Where: PUT /api/plans/{id}/freeze route.
 */
export const freeze: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid plan ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    const existing = await db.query.plans.findFirst({
      where: eq(plans.id, id)
    });
    if (!existing) {
      return c.json({ error: "Plan not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const [updated] = await db.update(plans).set({ isActive: false, updatedAt: new Date() }).where(eq(plans.id, id)).returning();
    return c.json({ message: "Plan frozen successfully", data: updated });
  } catch (error: any) {
    console.error("Freeze plan error:", error);
    return c.json({ error: error.message || "Failed to freeze plan" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Deletes a plan.
 * When: Admin deletes plan.
 * Where: DELETE /api/plans/{id} route.
 */
export const destroy: Handler = async (c: any) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid plan ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Prevent deleting a plan that still has active users
    const [{ value: userCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.planId, id));

    if (userCount > 0) {
      return c.json(
        { error: `Cannot delete plan — ${userCount} user(s) are currently on this plan. Freeze it instead.` },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    await db.delete(plans).where(eq(plans.id, id));
    return c.json({ message: "Plan deleted successfully" });
  } catch (error: any) {
    console.error("Delete plan error:", error);
    return c.json({ error: error.message || "Failed to delete plan" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
