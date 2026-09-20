import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(config({ override: true }));

const envSchema = z
  .object({
    APP_NAME: z.string().default("nexgen"),
    APP_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_PORT: z.coerce.number().default(3010),
    APP_URL: z.string().trim().default("http://localhost:3010"),
    UI: z
      .string()
      .default("true")
      .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
    FRONTEND_URL: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    DATABASE_URL: z.string().default("sqlite:./src/storage/database/nexgen.sqlite"),
    REDIS: z
      .string()
      .default("false")
      .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
    REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
    REDIS_PREFIX: z
      .string()
      .default("nexgen")
      .transform((value) => value.trim()),
    JWT_ACCESS_SECRET: z.string().default("authstation-access-secret-key-2026-secure"),
    JWT_REFRESH_SECRET: z.string().default("authstation-refresh-secret-key-2026-secure"),
    COOKIE_SECRET: z.string().default("authstation-cookie-secret-key-2026-secure"),
    STORAGE_ACCESS_KEY_ID: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    STORAGE_SECRET_ACCESS_KEY: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    MAIL_USERNAME: z.string().default(""),
    MAIL_PASSWORD: z.string().default(""),
    OPEN_API: z
      .string()
      .default("true")
      .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
    SOCKET: z
      .string()
      .default("false")
      .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
    ADMIN_NAME: z
      .string()
      .optional()
      .transform((value) => value?.trim() || "System Admin"),
    ADMIN_EMAIL: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    ADMIN_PASSWORD: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined)
  });

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  FRONTEND_URL: parsedEnv.FRONTEND_URL
};

export type Env = typeof env;
