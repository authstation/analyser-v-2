import type { Handler } from "hono";
import { HttpStatusCodes } from "@/framework/facade.js";

/**
 * Wraps a Hono handler in a try/catch block to eliminate repetitive error handling boilerplate.
 *
 * Usage:
 *   export const index = tryCatch("Fetch users", async (c) => {
 *     const users = await db.select()...;
 *     return c.json({ data: users });
 *   });
 *
 * @param label  Human-readable label for error messages and logs (e.g. "Fetch users")
 * @param fn     The handler to wrap
 */
export function tryCatch(label: string, fn: Handler): Handler {
  return async (c, next) => {
    try {
      return await fn(c, next);
    } catch (error) {
      console.error(`[${label}]`, error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      return c.json(
        { error: `${label} failed`, detail: message },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}
