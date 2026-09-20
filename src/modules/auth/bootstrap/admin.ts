import { eq } from "drizzle-orm";
import { env } from "@/env.js";
import { db, password } from "@/framework/facade.js";
import { users } from "@/modules/auth/database/models/user.js";

/**
 * Why: Automatically bootstraps the initial Administrator account from .env on server deployment/startup.
 * When: Server boots up after database initialization.
 * Where: Called in framework createKernel() or server boot.
 */
export async function bootstrapAdminUser() {
  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;
  const adminName = env.ADMIN_NAME || "System Admin";

  if (!adminEmail || !adminPassword) {
    return;
  }

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, adminEmail.toLowerCase().trim()),
    });

    if (!existing) {
      const hashedPassword = await password.hashPassword(adminPassword);
      await db.insert(users).values({
        name: adminName,
        email: adminEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: "admin",
        paymentStatus: "approved",
        hasChangedCircle: false,
      });
      console.log(`[Bootstrap] Admin user created from .env (${adminEmail})`);
    } else {
      const isMatch = await password.verifyPassword(adminPassword, existing.password);
      const updateData: any = { role: "admin", paymentStatus: "approved" };
      if (!isMatch) {
        updateData.password = await password.hashPassword(adminPassword);
      }
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existing.id));
      console.log(`[Bootstrap] Admin account verified & updated from .env (${adminEmail})`);
    }
  } catch (error) {
    console.warn("[Bootstrap] Admin auto-bootstrap skipped/failed:", error);
  }
}
