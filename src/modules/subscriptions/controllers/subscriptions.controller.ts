import type { Handler } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { circles, subscriptions } from "@/modules/settings/database/models/settings.js";
import { notifications } from "@/modules/auth/database/models/notifications.js";

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

    return c.json({ message: "Subscriptions list fetched successfully", data: list });
  } catch (error) {
    console.error("Fetch all subscriptions error:", error);
    return c.json({ error: "Failed to fetch subscriptions" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Allows admin to approve or reject a user's circle subscription or single add-on.
 * When: Admin clicks Approve/Reject on Manage Subscriptions page.
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

    const [sub] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        circleId: subscriptions.circleId,
        circleName: circles.name,
      })
      .from(subscriptions)
      .innerJoin(circles, eq(subscriptions.circleId, circles.id))
      .where(eq(subscriptions.id, id));

    const [updated] = await db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();

    if (sub) {
      try {
        if (status === "approved") {
          await db.insert(notifications).values({
            userId: sub.userId,
            type: "office_approved",
            title: "Office Access Approved ✅",
            body: `Your access request for office '${sub.circleName}' has been approved and is now active!`,
            link: "/my-subscriptions"
          });
        } else if (status === "rejected") {
          await db.insert(notifications).values({
            userId: sub.userId,
            type: "office_rejected",
            title: "Office Access Rejected",
            body: `Your access request for office '${sub.circleName}' was rejected.`,
            link: "/my-subscriptions"
          });
        }
      } catch (notifErr) {
        console.error("Failed to insert office status notification:", notifErr);
      }
    }

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

    // Admin override: Admin can change circle for ANY user if userId is passed
    const isAdmin = user.role === "admin";
    const body = await c.req.json();
    const targetUserId = (isAdmin && body.userId) ? Number(body.userId) : auth.id;

    if (!isAdmin && user.paymentStatus !== "approved") {
      return c.json({ error: "Active subscription required to change office" }, HttpStatusCodes.FORBIDDEN);
    }

    if (!isAdmin && user.hasChangedCircle) {
      return c.json({ 
        error: "You have already used your 1-time office change allowance. Please contact administration for further changes." 
      }, HttpStatusCodes.FORBIDDEN);
    }

    const fromCircleId = body.fromCircleId ? Number(body.fromCircleId) : null;
    const toCircleId = Number(body.toCircleId);

    if (isNaN(toCircleId)) {
      return c.json({ error: "Please select a valid target office" }, HttpStatusCodes.BAD_REQUEST);
    }

    // Check target circle exists
    const targetCircle = await db.query.circles.findFirst({
      where: eq(circles.id, toCircleId),
    });

    if (!targetCircle) {
      return c.json({ error: "Selected target office does not exist" }, HttpStatusCodes.NOT_FOUND);
    }

    // If admin is updating a specific subscription row, update circleId of THAT row directly
    if (isAdmin && body.subscriptionId) {
      const subId = Number(body.subscriptionId);
      const subRow = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, subId),
      });

      if (!subRow) {
        return c.json({ error: "Subscription record not found" }, HttpStatusCodes.NOT_FOUND);
      }

      // Check if user already has another subscription record for the target circle
      const existingSameCircleSub = await db.query.subscriptions.findFirst({
        where: and(
          eq(subscriptions.userId, targetUserId),
          eq(subscriptions.circleId, toCircleId)
        ),
      });

      if (existingSameCircleSub && existingSameCircleSub.id !== subId) {
        // Activate target record and remove/inactivate the old record to avoid duplicates
        await db
          .update(subscriptions)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(subscriptions.id, existingSameCircleSub.id));

        await db
          .delete(subscriptions)
          .where(eq(subscriptions.id, subId));
      } else {
        // Directly update this row's circleId to target circle!
        await db
          .update(subscriptions)
          .set({ circleId: toCircleId, updatedAt: new Date() })
          .where(eq(subscriptions.id, subId));
      }
    } else {
      // Normal flow (User self-change or general circle change by fromCircleId)
      if (fromCircleId && !isNaN(fromCircleId)) {
        if (fromCircleId === toCircleId) {
          return c.json({ error: "Target office must be different from source office" }, HttpStatusCodes.BAD_REQUEST);
        }

        const currentSub = await db.query.subscriptions.findFirst({
          where: and(
            eq(subscriptions.userId, targetUserId),
            eq(subscriptions.circleId, fromCircleId),
            eq(subscriptions.status, "approved")
          ),
        });

        if (!currentSub && !isAdmin) {
          return c.json({ error: "Source office is not currently active in subscriptions" }, HttpStatusCodes.BAD_REQUEST);
        }

        if (currentSub) {
          await db
            .update(subscriptions)
            .set({ status: "inactive", updatedAt: new Date() })
            .where(eq(subscriptions.id, currentSub.id));
        }
      }

      // Check if subscription to target circle exists
      const existingTargetSub = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, targetUserId), eq(subscriptions.circleId, toCircleId)),
      });

      if (existingTargetSub) {
        await db
          .update(subscriptions)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(subscriptions.id, existingTargetSub.id));
      } else {
        await db.insert(subscriptions).values({
          userId: targetUserId,
          circleId: toCircleId,
          status: "approved",
        });
      }
    }

    // Mark hasChangedCircle = true on user only if non-admin self-change
    if (!isAdmin) {
      await db
        .update(users)
        .set({ hasChangedCircle: true })
        .where(eq(users.id, auth.id));
    }

    // Send notification to user if admin changed it
    if (isAdmin && targetUserId !== auth.id) {
      try {
        await db.insert(notifications).values({
          userId: targetUserId,
          type: "office_approved",
          title: "Office Assignment Updated",
          body: `An administrator updated your active office assignment to '${targetCircle.name}'.`,
          link: "/dashboard"
        });
      } catch (err) {
        console.error("Failed to notify user about circle change:", err);
      }
    }

    return c.json({ 
      message: `Office successfully updated to ${targetCircle.name}!`,
      data: { fromCircleId, toCircleId, userId: targetUserId },
    }, HttpStatusCodes.OK);

  } catch (error) {
    console.error("Change circle error:", error);
    return c.json({ error: "Failed to change office" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

