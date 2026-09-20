import { eq } from "drizzle-orm";
import { db } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";
import { appSettings } from "@/modules/settings/database/models/settings.js";
import { notifications } from "@/modules/auth/database/models/notifications.js";

const CURRENT_VERSION = "2.0.0";
const CURRENT_RELEASE_TITLE = "Analyser v2.0 Release 🚀";
const CURRENT_RELEASE_BODY = "Welcome to Analyser v2! Enjoy faster uploads, return analysis comparison, drilldown pivot reports, and a modernized interface.";

/**
 * Why: Automatically announces new app versions and major features to all users once per release.
 * When: Server boots up after database initialization.
 * Where: Called in createKernel() during server boot.
 */
export async function bootstrapVersionAnnouncement() {
  try {
    const settingKey = "system_announced_version";
    const existing = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, settingKey),
    });

    if (existing?.value === CURRENT_VERSION) {
      return;
    }

    // Save announced version so it never runs twice for this version
    if (existing) {
      await db
        .update(appSettings)
        .set({ value: CURRENT_VERSION, updatedAt: new Date() })
        .where(eq(appSettings.key, settingKey));
    } else {
      await db.insert(appSettings).values({
        key: settingKey,
        value: CURRENT_VERSION,
        description: "Tracks the latest application version announced to users",
      });
    }

    // Broadcast notification to all non-admin users
    const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "user"));
    if (allUsers.length > 0) {
      const notifs = allUsers.map((u) => ({
        userId: u.id,
        type: "version_update",
        title: CURRENT_RELEASE_TITLE,
        body: CURRENT_RELEASE_BODY,
        link: "/dashboard",
      }));
      await db.insert(notifications).values(notifs);
      console.log(`[Announcement] Broadcasted version update v${CURRENT_VERSION} to ${allUsers.length} user(s).`);
    }
  } catch (error) {
    console.warn("[Announcement] Version announcement check skipped/failed:", error);
  }
}
