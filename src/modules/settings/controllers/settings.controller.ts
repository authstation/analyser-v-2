import type { Handler } from "hono";

/**
 * Why: Returns collection response shape for list pages.
 * When: Used by GET list endpoint.
 * Where: GET /settings route.
 */
export const index: Handler = async (c: any) => {
  return c.json({ message: "settings list fetched successfully", data: [] });
};

/**
 * Why: Returns one resource by validated route id.
 * When: Used by detail screens or fetch-by-id calls.
 * Where: GET /settings/{id} route.
 */
export const show: Handler = async (c: any) => {
  const params = c.req.valid("param");

  return c.json({ message: "settings fetched successfully", data: { id: params.id, name: "" } });
};

/**
 * Why: Creates a new resource from validated request body.
 * When: Used by create form submissions.
 * Where: POST /settings route.
 */
export const store: Handler = async (c: any) => {
  c.req.valid("json");

  return c.json({ message: "settings created successfully" }, 201);
};

/**
 * Why: Updates an existing resource using id + body validation.
 * When: Used by edit/update form submissions.
 * Where: PUT/PATCH /settings/{id} route.
 */
export const update: Handler = async (c: any) => {
  c.req.valid("param");
  c.req.valid("json");

  return c.json({ message: "settings updated successfully" });
};

/**
 * Why: Deletes one resource by validated route id.
 * When: Used by delete actions.
 * Where: DELETE /settings/{id} route.
 */
export const destroy: Handler = async (c: any) => {
  c.req.valid("param");

  return c.json({ message: "settings deleted successfully" });
};

