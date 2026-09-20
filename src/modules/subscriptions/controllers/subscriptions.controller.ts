import type { Handler } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { circles, subscriptions } from "@/modules/settings/database/models/settings.js";

/**
 * Why: Returns all office access subscriptions across all users for admin approval/revocation.
 * When: Admin accesses Manage Subscriptions / Office Access Approvals.
 * Where: GET /api/subscriptions/admin/all route.
 */
export const getAllSubscriptions: Handler = async (c: any) => {
  try {
    const list = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        userName: users.name,
        userEmail: users.email,
        circleId: subscriptions.circleId,
        circleName: circles.name,
        status: subscriptions.status,
        trxId: subscriptions.trxId,
        paymentMethod: subscriptions.paymentMethod,
        isAddon: subscriptions.isAddon,
        addonPrice: subscriptions.addonPrice,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .innerJoin(circles, eq(subscriptions.circleId, circles.id))
      .orderBy(desc(subscriptions.createdAt));

    return c.json({ message: "Subscriptions fetched successfully", data: list });
  } catch (error) {
    console.error("Fetch all subscriptions error:", error);
    return c.json({ error: "Failed to fetch subscriptions" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Updates status of a subscription request (approved/rejected).
 * When: Admin clicks Approve/Reject/Revoke in Office Access Approvals.
 * Where: POST /api/subscriptions/admin/status route.
 */
export const updateSubscriptionStatus: Handler = async (c: any) => {
  try {
    const body = await c.req.json();
    const id = Number(body.id ?? body.subscriptionId);
    let status = String(body.status || "").toLowerCase().trim();

    if (status === "active") status = "approved";

    if (isNaN(id) || !id || !["approved", "rejected", "pending", "inactive"].includes(status)) {
      console.warn("Invalid subscription status update attempt:", { body, id, status });
      return c.json({ error: "Invalid subscription id or status" }, HttpStatusCodes.BAD_REQUEST);
    }

    const [updated] = await db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();

    return c.json({ message: `Subscription status updated to ${status}`, data: updated });
  } catch (error) {
    console.error("Update subscription status error:", error);
    return c.json({ error: "Failed to update status" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Returns authenticated user's office subscriptions along with quota information.
 * When: User views profile or my subscriptions page.
 * Where: GET /api/subscriptions/my route.
 */
export const getMySubscriptions: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        paymentStatus: users.paymentStatus,
        planId: users.planId,
        planStartDate: users.planStartDate,
        trxId: users.trxId,
        hasChangedCircle: users.hasChangedCircle,
        planName: plans.name,
        planPrice: plans.price,
        planDurationDays: plans.durationDays,
        maxCircles: plans.maxCircles,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.id, auth.id));

    const list = await db
      .select({
        id: subscriptions.id,
        circleId: subscriptions.circleId,
        circleName: circles.name,
        status: subscriptions.status,
        trxId: subscriptions.trxId,
        paymentMethod: subscriptions.paymentMethod,
        isAddon: subscriptions.isAddon,
        addonPrice: subscriptions.addonPrice,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .innerJoin(circles, eq(subscriptions.circleId, circles.id))
      .where(eq(subscriptions.userId, auth.id))
      .orderBy(desc(subscriptions.createdAt));

    const activeCount = list.filter((s) => s.status === "approved").length;
    const maxCircles = user?.role === "admin" ? 9999 : user?.maxCircles || 1;

    return c.json({
      message: "User subscriptions fetched successfully",
      data: list,
      quota: {
        used: activeCount,
        total: maxCircles,
        available: Math.max(0, maxCircles - activeCount),
        isLimitReached: activeCount >= maxCircles,
      },
      singleCirclePrice: 300,
    });
  } catch (error) {
    console.error("Fetch my subscriptions error:", error);
    return c.json({ error: "Failed to fetch user subscriptions" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Allows user to request subscription access to a circle.
 * If user is within plan quota, it is auto-approved immediately.
 * If user exceeds plan quota, it returns limitReached to trigger upgrade or 300 BDT single-circle purchase modal.
 * When: User submits circle access request in Subscriptions page.
 * Where: POST /api/subscriptions/request route.
 */
export const requestSubscription: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        paymentStatus: users.paymentStatus,
        planId: users.planId,
        maxCircles: plans.maxCircles,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.id, auth.id));

    if (!user) {
      return c.json({ error: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (user.role !== "admin" && user.paymentStatus !== "approved") {
      return c.json({ 
        error: "Active subscription plan required to access offices. Please choose a plan.", 
        noActivePlan: true 
      }, HttpStatusCodes.FORBIDDEN);
    }

    const body = await c.req.json();
    const circleId = Number(body.circleId);
    if (isNaN(circleId)) {
      return c.json({ error: "Invalid circle ID" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Check target circle exists
    const targetCircle = await db.query.circles.findFirst({
      where: eq(circles.id, circleId),
    });

    if (!targetCircle) {
      return c.json({ error: "Selected office does not exist" }, HttpStatusCodes.NOT_FOUND);
    }

    // Check currently active approved subscriptions
    const activeSubs = await db.query.subscriptions.findMany({
      where: and(eq(subscriptions.userId, auth.id), eq(subscriptions.status, "approved")),
    });

    const activeCount = activeSubs.length;
    const maxCircles = user.role === "admin" ? 9999 : user.maxCircles || 1;

    // Check if subscription already exists
    const existing = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, auth.id), eq(subscriptions.circleId, circleId)),
    });

    if (existing) {
      if (existing.status === "approved") {
        return c.json({ message: "This office is already active in your subscriptions.", data: existing });
      }

      // If inactive or pending, check quota to auto-approve
      if (user.role === "admin" || activeCount < maxCircles) {
        const [updated] = await db
          .update(subscriptions)
          .set({ status: "approved", isAddon: false, updatedAt: new Date() })
          .where(eq(subscriptions.id, existing.id))
          .returning();

        return c.json({
          message: `Office '${targetCircle.name}' auto-added successfully under your plan quota!`,
          data: updated,
          autoApproved: true,
          quota: { used: activeCount + 1, total: maxCircles },
        });
      } else {
        return c.json({
          error: `Plan quota limit reached (${activeCount}/${maxCircles} offices used). You can upgrade your plan or purchase a single circle add-on for ৳300.`,
          limitReached: true,
          quota: { used: activeCount, total: maxCircles },
          singleCirclePrice: 300,
          circleId,
          circleName: targetCircle.name,
        }, HttpStatusCodes.BAD_REQUEST);
      }
    }

    // Check quota for new insertion
    if (user.role === "admin" || activeCount < maxCircles) {
      const [created] = await db
        .insert(subscriptions)
        .values({
          userId: auth.id,
          circleId,
          status: "approved",
          isAddon: false,
        })
        .returning();

      return c.json({
        message: `Office '${targetCircle.name}' auto-added successfully under your plan quota!`,
        data: created,
        autoApproved: true,
        quota: { used: activeCount + 1, total: maxCircles },
      }, HttpStatusCodes.CREATED);
    } else {
      return c.json({
        error: `Plan quota limit reached (${activeCount}/${maxCircles} offices used). You can upgrade your plan or purchase a single circle add-on for ৳300.`,
        limitReached: true,
        quota: { used: activeCount, total: maxCircles },
        singleCirclePrice: 300,
        circleId,
        circleName: targetCircle.name,
      }, HttpStatusCodes.BAD_REQUEST);
    }
  } catch (error) {
    console.error("Request subscription error:", error);
    return c.json({ error: "Failed to request subscription" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Allows user to purchase an additional single circle subscription (৳300) when plan limit is reached.
 * When: User submits Single Circle Add-on modal with TrxID.
 * Where: POST /api/subscriptions/buy-single-circle route.
 */
export const buySingleCircle: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    const body = await c.req.json();
    const circleId = Number(body.circleId);
    const paymentMethod = String(body.paymentMethod || "bKash").trim();
    const trxId = String(body.trxId || "").trim();

    if (isNaN(circleId) || !circleId) {
      return c.json({ error: "Please select a valid circle office" }, HttpStatusCodes.BAD_REQUEST);
    }

    if (!trxId) {
      return c.json({ error: "Payment Transaction ID (TrxID) is required" }, HttpStatusCodes.BAD_REQUEST);
    }

    const targetCircle = await db.query.circles.findFirst({
      where: eq(circles.id, circleId),
    });

    if (!targetCircle) {
      return c.json({ error: "Selected circle office does not exist" }, HttpStatusCodes.NOT_FOUND);
    }

    const existing = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, auth.id), eq(subscriptions.circleId, circleId)),
    });

    if (existing && existing.status === "approved") {
      return c.json({ error: "You already have active access to this office." }, HttpStatusCodes.BAD_REQUEST);
    }

    let savedSub;
    if (existing) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          status: "pending",
          isAddon: true,
          addonPrice: 300,
          paymentMethod,
          trxId,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();
      savedSub = updated;
    } else {
      const [created] = await db
        .insert(subscriptions)
        .values({
          userId: auth.id,
          circleId,
          status: "pending",
          isAddon: true,
          addonPrice: 300,
          paymentMethod,
          trxId,
        })
        .returning();
      savedSub = created;
    }

    return c.json({
      message: `৳300 Single Circle Add-on request for '${targetCircle.name}' submitted successfully (TrxID: ${trxId}). It will be approved shortly by administration.`,
      data: savedSub,
    }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Buy single circle error:", error);
    return c.json({ error: "Failed to submit single circle purchase" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Allows an active user to change/switch their approved circle office once per subscription period.
 * When: User initiates circle transfer in My Subscriptions.
 * Where: POST /api/subscriptions/change-circle route.
 */
export const changeCircleSubscription: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.id),
    });

    if (!user) {
      return c.json({ error: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    if (user.role !== "admin" && user.paymentStatus !== "approved") {
      return c.json({ error: "Active subscription required to change office" }, HttpStatusCodes.FORBIDDEN);
    }

    if (user.role !== "admin" && user.hasChangedCircle) {
      return c.json({ 
        error: "You have already used your 1-time office change allowance. Please contact administration for further changes." 
      }, HttpStatusCodes.FORBIDDEN);
    }

    const body = await c.req.json();
    const fromCircleId = Number(body.fromCircleId);
    const toCircleId = Number(body.toCircleId);

    if (isNaN(fromCircleId) || isNaN(toCircleId) || fromCircleId === toCircleId) {
      return c.json({ error: "Please select a valid different target office" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Verify current subscription is approved
    const currentSub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, auth.id),
        eq(subscriptions.circleId, fromCircleId),
        eq(subscriptions.status, "approved")
      ),
    });

    if (!currentSub) {
      return c.json({ error: "Source office is not currently active in your subscriptions" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Check target circle exists
    const targetCircle = await db.query.circles.findFirst({
      where: eq(circles.id, toCircleId),
    });

    if (!targetCircle) {
      return c.json({ error: "Selected target office does not exist" }, HttpStatusCodes.NOT_FOUND);
    }

    // Deactivate old subscription
    await db
      .update(subscriptions)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(subscriptions.id, currentSub.id));

    // Check if subscription to target circle exists
    const existingTargetSub = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, auth.id), eq(subscriptions.circleId, toCircleId)),
    });

    if (existingTargetSub) {
      await db
        .update(subscriptions)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(subscriptions.id, existingTargetSub.id));
    } else {
      await db.insert(subscriptions).values({
        userId: auth.id,
        circleId: toCircleId,
        status: "approved",
      });
    }

    // Mark hasChangedCircle = true on user
    if (user.role !== "admin") {
      await db
        .update(users)
        .set({ hasChangedCircle: true })
        .where(eq(users.id, auth.id));
    }

    return c.json({ 
      message: `Office successfully changed to ${targetCircle.name}!`,
      data: { fromCircleId, toCircleId },
    }, HttpStatusCodes.OK);

  } catch (error) {
    console.error("Change circle error:", error);
    return c.json({ error: "Failed to change office" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

