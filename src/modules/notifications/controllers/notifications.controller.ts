import type { Handler } from "hono";
import { eq, desc, and, count, inArray, isNull } from "drizzle-orm";
import { db, HttpStatusCodes } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { circles, subscriptions } from "@/modules/settings/database/models/settings.js";
import { notifications } from "@/modules/auth/database/models/notifications.js";

/**
 * Why: Returns combined list of smart dynamic action notifications and database notifications.
 * When: App Header fetches notifications for the notification bell.
 * Where: GET /api/notifications route.
 */
export const index: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    const [currentUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        paymentStatus: users.paymentStatus,
        planId: users.planId,
        planStartDate: users.planStartDate,
        trxId: users.trxId,
        hasChangedCircle: users.hasChangedCircle,
        planName: plans.name,
        planDurationDays: plans.durationDays,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.id, auth.id));

    if (!currentUser) {
      return c.json({ error: "User not found" }, HttpStatusCodes.NOT_FOUND);
    }

    const items: Array<{
      id: string | number;
      type: string;
      title: string;
      body: string;
      icon: string;
      colorClass: string;
      link: string;
      isRead: boolean;
      badge?: string;
      createdAt: string;
    }> = [];

    const isAdmin = currentUser.role === "admin";

    // -------------------------------------------------------------
    // 1. ADMIN NOTIFICATIONS
    // -------------------------------------------------------------
    if (isAdmin) {
      // Check Pending User Registrations / Payments
      const pendingUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(inArray(users.paymentStatus, ["pending", "none"]))
        .orderBy(desc(users.createdAt));

      const pendingUserCount = pendingUsers.length;
      if (pendingUserCount > 0) {
        items.push({
          id: "admin-pending-users",
          type: "admin_user_approvals",
          title: "Pending User Approvals",
          body: `${pendingUserCount} user(s) waiting for plan payment verification.`,
          icon: "bi-people-fill",
          colorClass: "warning",
          link: "/admin/users",
          badge: `${pendingUserCount} New`,
          isRead: false,
          createdAt: pendingUsers[0]?.createdAt ? new Date(pendingUsers[0].createdAt).toISOString() : new Date().toISOString(),
        });
      }

      // Check Pending Office Subscriptions / Single Add-on Requests
      const pendingSubs = await db
        .select({
          id: subscriptions.id,
          isAddon: subscriptions.isAddon,
          addonPrice: subscriptions.addonPrice,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .where(eq(subscriptions.status, "pending"))
        .orderBy(desc(subscriptions.createdAt));

      const pendingSubCount = pendingSubs.length;
      if (pendingSubCount > 0) {
        const addonCount = pendingSubs.filter((s) => s.isAddon).length;
        const addonText = addonCount > 0 ? ` (incl. ${addonCount} single ৳300 add-on)` : "";
        items.push({
          id: "admin-pending-subs",
          type: "admin_subscription_approvals",
          title: "Pending Office Approvals",
          body: `${pendingSubCount} office access request(s) awaiting review${addonText}.`,
          icon: "bi-building-fill-exclamation",
          colorClass: "info",
          link: "/admin/subscriptions",
          badge: `${pendingSubCount} Req`,
          isRead: false,
          createdAt: pendingSubs[0]?.createdAt ? new Date(pendingSubs[0].createdAt).toISOString() : new Date().toISOString(),
        });
      }
    }

    // -------------------------------------------------------------
    // 2. REGULAR USER NOTIFICATIONS
    // -------------------------------------------------------------
    if (!isAdmin) {
      // A. User Payment Status Notification
      if (currentUser.paymentStatus === "pending") {
        items.push({
          id: "user-payment-pending",
          type: "user_payment_pending",
          title: "Plan Payment Under Review",
          body: "Your subscription payment is currently being reviewed by administration.",
          icon: "bi-clock-history",
          colorClass: "warning",
          link: "/my-subscriptions",
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }

      // B. Plan Expiry Notification
      if (currentUser.paymentStatus === "approved" && currentUser.planStartDate && currentUser.planDurationDays) {
        const start = new Date(currentUser.planStartDate).getTime();
        const durationMs = Number(currentUser.planDurationDays) * 24 * 60 * 60 * 1000;
        const expiry = start + durationMs;
        const diffMs = expiry - Date.now();
        const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

        if (diffMs <= 0) {
          items.push({
            id: "user-plan-expired",
            type: "user_plan_expired",
            title: "Subscription Expired",
            body: "Your subscription plan has expired. Click to renew or upgrade your plan.",
            icon: "bi-exclamation-triangle-fill",
            colorClass: "danger",
            link: "/plans",
            badge: "Expired",
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        } else if (daysLeft <= 3) {
          items.push({
            id: "user-plan-expiring",
            type: "user_plan_expiring",
            title: "Plan Expiring Soon",
            body: `Your subscription expires in ${daysLeft} day(s). Renew now to prevent interruption.`,
            icon: "bi-hourglass-split",
            colorClass: "warning",
            link: "/plans",
            badge: `${daysLeft}d left`,
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // C. Office Subscriptions Notifications
      const userSubs = await db
        .select({
          id: subscriptions.id,
          circleId: subscriptions.circleId,
          circleName: circles.name,
          status: subscriptions.status,
          isAddon: subscriptions.isAddon,
          trxId: subscriptions.trxId,
          createdAt: subscriptions.createdAt,
        })
        .from(subscriptions)
        .innerJoin(circles, eq(subscriptions.circleId, circles.id))
        .where(eq(subscriptions.userId, auth.id))
        .orderBy(desc(subscriptions.createdAt));

      // Pending Single Addons
      const pendingAddons = userSubs.filter((s) => s.status === "pending");
      for (const p of pendingAddons) {
        items.push({
          id: `user-sub-pending-${p.id}`,
          type: "user_addon_pending",
          title: "Office Add-on Pending",
          body: `Your ৳300 add-on request for '${p.circleName}' is awaiting admin approval.`,
          icon: "bi-hourglass-top",
          colorClass: "info",
          link: "/my-subscriptions",
          isRead: false,
          createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        });
      }

      // 1-Time Office Switch available
      if (currentUser.paymentStatus === "approved" && !currentUser.hasChangedCircle && userSubs.some((s) => s.status === "approved")) {
        items.push({
          id: "user-switch-available",
          type: "user_switch_available",
          title: "1-Time Office Switch Available",
          body: "You can transfer/switch your circle office once during this subscription period.",
          icon: "bi-arrow-left-right",
          colorClass: "info",
          link: "/my-subscriptions",
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // -------------------------------------------------------------
    // 3. DATABASE NOTIFICATIONS (from notifications table)
    // -------------------------------------------------------------
    const dbNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, auth.id))
      .orderBy(desc(notifications.createdAt))
      .limit(10);

    for (const n of dbNotifs) {
      items.push({
        id: `db-${n.id}`,
        type: n.type || "system",
        title: n.title,
        body: n.body || "",
        icon: "bi-bell-fill",
        colorClass: "primary",
        link: n.link || (isAdmin ? "/admin/dashboard" : "/dashboard"),
        isRead: !!n.readAt,
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
      });
    }

    const unreadCount = items.filter((i) => !i.isRead).length;

    return c.json({
      message: "Notifications fetched successfully",
      data: items,
      unreadCount,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return c.json({ error: "Failed to fetch notifications" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Marks all database notifications as read.
 * When: User clicks "Mark all as read" in notifications dropdown.
 * Where: POST /api/notifications/read-all route.
 */
export const markAllAsRead: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, auth.id), isNull(notifications.readAt)));

    return c.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return c.json({ error: "Failed to mark notifications as read" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
