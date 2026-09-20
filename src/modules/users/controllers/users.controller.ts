import { eq, desc } from "drizzle-orm";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { tryCatch } from "@/framework/http/handler.js";

/**
 * Why: Returns list of users with joined plan information.
 * When: Admin accesses User Management.
 * Where: GET /api/users route.
 */
export const index = tryCatch("Fetch users", async (c) => {
  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      planId: users.planId,
      planName: plans.name,
      planPrice: plans.price,
      planDurationDays: plans.durationDays,
      planStartDate: users.planStartDate,
      trxId: users.trxId,
      paymentStatus: users.paymentStatus,
      hasChangedCircle: users.hasChangedCircle,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(plans, eq(users.planId, plans.id))
    .orderBy(desc(users.createdAt));

  return c.json({ message: "Users fetched successfully", data: userList });
});

/**
 * Why: Updates user payment status or role.
 * When: Admin approves or rejects subscription/payment.
 * Where: PUT /api/users/:id route.
 */
export const update = tryCatch("Update user", async (c: any) => {
  const id = Number(c.req.param("id"));
  if (isNaN(id)) {
    return c.json({ error: "Invalid user ID" }, HttpStatusCodes.BAD_REQUEST);
  }

  const body = await c.req.json();
  const updatePayload: any = {};

  if (body.paymentStatus !== undefined) {
    updatePayload.paymentStatus = String(body.paymentStatus);
    if (body.paymentStatus === "approved") {
      updatePayload.planStartDate = new Date();
      updatePayload.hasChangedCircle = false;
    }
  }
  if (body.role !== undefined) {
    const validRoles = ["admin", "user"] as const;
    if (!validRoles.includes(body.role)) {
      return c.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, HttpStatusCodes.BAD_REQUEST);
    }
    updatePayload.role = body.role;
  }
  if (body.planId !== undefined) {
    updatePayload.planId = Number(body.planId) || null;
  }
  if (body.hasChangedCircle !== undefined) {
    updatePayload.hasChangedCircle = Boolean(body.hasChangedCircle);
  }

  const [updated] = await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, id))
    .returning();

  return c.json({ message: "User updated successfully", data: updated });
});
