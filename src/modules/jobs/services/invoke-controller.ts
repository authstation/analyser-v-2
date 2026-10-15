/**
 * Why: §3.1 — background jobs need to run the very same import pipeline as the
 *      HTTP endpoints without duplicating (or drifting from) the controller
 *      logic. The import `parse`/`save` handlers only touch a tiny slice of the
 *      Hono context, so we can replay them with a minimal stand-in.
 * When: An async import job runs the existing controller handlers.
 * Where: src/modules/jobs/services/invoke-controller.ts.
 * How: `replayContext` fabricates the `req.parseBody` / `req.json` / `get("auth")`
 *      / `json()` surface; `invokeHandler` normalizes the captured response.
 */

export type CapturedResponse = { status: number; body: any };

export function replayContext(options: { file?: File; body?: any; auth?: any }) {
  return {
    req: {
      parseBody: async () => (options.file ? { file: options.file } : {}),
      json: async () => options.body,
      query: (_key: string) => undefined,
      header: (_key: string) => undefined
    },
    get: (key: string) => (key === "auth" ? options.auth : undefined),
    set: () => {},
    json: (body: any, status = 200) => ({ status, body })
  } as any;
}

/**
 * Why: Normalizes whatever a controller handler returns into `{ status, body }`.
 * When: After replaying a handler.
 * Where: Import job handlers.
 * How: Passes through the `{ status, body }` produced by the replay `json()`;
 *      wraps anything else as a 200.
 */
export async function invokeHandler(handler: (c: any, ...rest: any[]) => any, context: any): Promise<CapturedResponse> {
  const result = await handler(context);
  if (result && typeof result === "object" && "status" in result && "body" in result) {
    return result as CapturedResponse;
  }
  return { status: 200, body: result };
}
