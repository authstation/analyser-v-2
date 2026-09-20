import { and, eq, gt, lt } from "drizzle-orm";
import type { Handler } from "hono";
import { authConfig, jwtConfig } from "@/config/index.js";
import { cookie, db, dispatchEvent, HttpStatusCodes, jwt, password, urls } from "@/framework/facade.js";

import { emailVerificationTokens, passwordResetTokens, refreshTokens, users } from "@/modules/auth/database/models/user.js";
import { plans } from "@/modules/plans/database/models/plans.js";
import { subscriptions } from "@/modules/settings/database/models/settings.js";
import {
  hashEmailVerificationToken,
  hashResetToken,
  issueTokens,
  makeEmailVerificationToken,
  makeResetToken,
  revokeCurrentRefreshToken,
  sanitizeUser
} from "./auth.helpers.js";

/**
 * Why: Creates a new user, issues tokens, and triggers signup side effects.
 * When: Used on first-time account creation.
 * Where: POST auth register route.
 */
export const register: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });

    if (existingUser) {
      return c.json({ message: "Email already exists" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const planId = body.planId ? Number(body.planId) : null;
    const trxId = body.trxId ? String(body.trxId).trim() : null;
    const paymentStatus = planId ? "pending" : "none";

    const [user] = await db.insert(users).values({
      name: body.name,
      email: body.email,
      password: await password.hashPassword(body.password),
      role: "user",
      planId,
      trxId,
      paymentStatus,
    }).returning();

    if (!user) throw new Error("Failed to insert user");

    // Record subscription requests for selected circles
    if (Array.isArray(body.circleIds) && body.circleIds.length > 0) {
      const circleInserts = body.circleIds.map((cId: number) => ({
        userId: user.id,
        circleId: Number(cId),
        status: "pending",
        isAddon: false,
      }));
      await db.insert(subscriptions).values(circleInserts);
    }

    if (authConfig.requireEmailVerification) {
      const plainToken = makeEmailVerificationToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, user.email));
      await db.insert(emailVerificationTokens).values({
        email: user.email,
        token: hashEmailVerificationToken(plainToken),
        expiresAt,
        createdAt: new Date()
      });

      const verifyUrl = urls.url(`/verify-email?token=${plainToken}&email=${encodeURIComponent(user.email)}`);
      await dispatchEvent("user:verify-email", { email: user.email, name: user.name, verifyUrl }, { queue: "mail" });

      return c.json({ message: "User registered successfully. Please verify your email before logging in." }, HttpStatusCodes.CREATED);
    }

    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });
    await dispatchEvent(
      "user:signup",
      {
        userId: user.id,
        email: user.email,
        name: user.name
      },
      { queue: "mail" }
    );

    return c.json(
      {
        message: "User registered successfully",
        data: {
          user: sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.CREATED
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ message: "Failed to register user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Authenticates user credentials and rotates active login cookies/tokens.
 * When: Used whenever a user signs in.
 * Where: POST auth login route.
 */
export const login: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        paymentStatus: users.paymentStatus,
        planId: users.planId,
        planName: plans.name,
        planPrice: plans.price,
        planDurationDays: plans.durationDays,
        planStartDate: users.planStartDate,
        trxId: users.trxId,
        hasChangedCircle: users.hasChangedCircle,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.email, body.email));

    if (!user || !(await password.verifyPassword(body.password, user.password))) {
      return c.json({ message: "Invalid credentials" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (user.role !== 'admin' && (user.paymentStatus === 'inactive' || user.paymentStatus === 'rejected')) {
      return c.json({ message: "Your account is inactive. Please contact administration." }, HttpStatusCodes.FORBIDDEN);
    }

    if (authConfig.requireEmailVerification && !(user as any).emailVerifiedAt) {
      return c.json({ message: "Please verify your email before logging in" }, HttpStatusCodes.FORBIDDEN);
    }

    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });

    return c.json(
      {
        message: "User logged in successfully",
        data: {
          user: sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ message: "Failed to login" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Returns the currently authenticated user profile.
 * When: Used by clients to bootstrap session/user state.
 * Where: GET auth me route.
 */
export const me: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        paymentStatus: users.paymentStatus,
        planId: users.planId,
        planName: plans.name,
        planPrice: plans.price,
        planDurationDays: plans.durationDays,
        planStartDate: users.planStartDate,
        trxId: users.trxId,
        hasChangedCircle: users.hasChangedCircle,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.id, auth.id));

    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.NOT_FOUND);

    if (user.role !== "admin" && (user.paymentStatus === "inactive" || user.paymentStatus === "rejected")) {
      return c.json({ message: "Your account is inactive. Please contact administration." }, HttpStatusCodes.FORBIDDEN);
    }

    return c.json(
      {
        message: "Authenticated user fetched successfully",
        data: sanitizeUser(user)
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Me error:", error);
    return c.json({ message: "Failed to fetch user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Revokes current refresh token and clears auth cookies.
 * When: Used when the active device logs out.
 * Where: POST auth logout route.
 */
export const logout: Handler = async (c: any) => {
  try {
    await revokeCurrentRefreshToken(c);
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout error:", error);
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Failed to logout" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Starts password reset flow and queues email delivery event.
 * When: Used when user requests a forgot-password link.
 * Where: POST auth forgot-password route.
 */
export const forgotPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.email, body.email), lt(passwordResetTokens.expiresAt, new Date())));

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });
    if (!user) return c.json({ message: "If this email exists, a reset link has been sent" }, HttpStatusCodes.OK);

    const plainToken = makeResetToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, user.email));
    await db.insert(passwordResetTokens).values({
      email: user.email,
      token: hashResetToken(plainToken),
      expiresAt,
      createdAt: new Date()
    });

    const resetUrl = urls.url(`/reset-password?token=${plainToken}&email=${encodeURIComponent(user.email)}`);
    await dispatchEvent("user:forget-password", { email: user.email, name: user.name, resetUrl }, { queue: "mail" });

    return c.json({ message: "If this email exists, a reset link has been sent" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ message: "Failed to process forgot password request" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Verifies reset token and persists the new password.
 * When: Used after user submits reset token + new password.
 * Where: POST auth reset-password route.
 */
export const resetPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const record = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.email, body.email),
        eq(passwordResetTokens.token, hashResetToken(body.token)),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    });

    if (!record) {
      return c.json({ message: "Invalid or expired reset token" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    await db
      .update(users)
      .set({
        password: await password.hashPassword(body.password),
        updatedAt: new Date()
      })
      .where(eq(users.email, body.email));

    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, body.email));

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email)
    });
    if (user) await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, user.id));

    return c.json({ message: "Password reset successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ message: "Failed to reset password" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Validates email verification token and marks user as verified.
 * When: Used when user opens verification link from inbox.
 * Where: POST auth verify-email route.
 */
export const verifyEmail: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");

    if (!authConfig.requireEmailVerification) {
      return c.json({ message: "Email verification is not required" }, HttpStatusCodes.OK);
    }

    const record = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.email, body.email),
        eq(emailVerificationTokens.token, hashEmailVerificationToken(body.token)),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    });

    if (!record) {
      return c.json({ message: "Invalid or expired verification token" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.email, body.email));
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, body.email));

    return c.json({ message: "Email verified successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Verify email error:", error);
    return c.json({ message: "Failed to verify email" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Rotates refresh token and reissues access credentials.
 * When: Used when access token expires but refresh token is still valid.
 * Where: POST auth refresh-token route.
 */
export const refreshToken: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const payload = await jwt.verifyToken(body.refresh_token, "refresh");

    if (!payload?.jti) return c.json({ message: "Invalid refresh token" }, HttpStatusCodes.UNAUTHORIZED);

    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.jti, payload.jti as string)
    });

    if (!storedToken || storedToken.revoked) {
      return c.json({ message: "Refresh token revoked" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
      return c.json({ message: "Refresh token expired" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id as number)
    });
    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.UNAUTHORIZED);

    const remember = !!payload.remember;
    const refreshExpiry = remember ? jwtConfig.refreshRememberExpirySeconds : undefined;
    const accessToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        remember
      },
      "access"
    );
    const newRefreshToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        remember
      },
      "refresh",
      refreshExpiry
    );

    await db
      .update(refreshTokens)
      .set({
        jti: newRefreshToken.jti as string,
        expiresAt: new Date(newRefreshToken.exp * 1000),
        revoked: false
      })
      .where(eq(refreshTokens.id, storedToken.id));

    await cookie.setAuth(c, accessToken.token);
    await cookie.setRefresh(c, newRefreshToken.token, refreshExpiry);

    return c.json(
      {
        message: "Token refreshed successfully",
        data: {
          user: sanitizeUser(user),
          access_token: accessToken.token,
          refresh_token: newRefreshToken.token,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Refresh token error:", error);
    return c.json({ message: "Invalid or expired refresh token" }, HttpStatusCodes.UNAUTHORIZED);
  }
};

/**
 * Why: Revokes all refresh tokens for account-wide logout.
 * When: Used for "logout from all devices" security action.
 * Where: POST auth logout-all-devices route.
 */
export const logoutAllDevices: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, auth.id));
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);

    return c.json({ message: "Logged out from all devices successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout all devices error:", error);
    return c.json({ message: "Failed to logout from all devices" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
