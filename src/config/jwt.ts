import { env } from "@/env.js";

/**
 * Why: JWT signing and lifetime settings.
 * When: Access/refresh token generation and verification.
 * Where: src/config/jwt.ts.
 * How: Signing secrets are confidential and stay in .env. Expiries are plain
 *      literals you can tune here (seconds).
 */
export const jwtConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpirySeconds: 604800, // 7 days (increased from 15 minutes)
  refreshExpirySeconds: 2592000, // 30 days
  refreshRememberExpirySeconds: 2592000 * 3, // 90 days
  algorithm: "HS256" as const
};

export type JwtConfig = typeof jwtConfig;
