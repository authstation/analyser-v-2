import { OpenAPIHono } from "@hono/zod-openapi";

export type NexgenRouter = OpenAPIHono & {
  group: (...middlewares: any[]) => NexgenRouter;
  api: (route: any, handlerOrMiddlewares: any, handler?: any) => NexgenRouter;
};

const customDefaultHook = (result: any, c: any) => {
  if (!result.success) {
    const issues = result.error?.issues || [];
    const firstMessage = issues[0]?.message || "Validation failed";
    const errors: Record<string, string[]> = {};
    for (const issue of issues) {
      const field = (issue.path || []).join(".") || "general";
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    return c.json(
      {
        success: false,
        message: firstMessage,
        error: firstMessage,
        errors,
        issues
      },
      422
    );
  }
};

/**
 * Why: Creates the framework router with OpenAPI + helper methods.
 * When: Building root app and module route files.
 * Where: HTTP app bootstrap and route stubs.
 * How: Wraps OpenAPIHono and adds group/api convenience APIs.
 */
export function createRouter(): NexgenRouter {
  const router = new OpenAPIHono({ strict: false, defaultHook: customDefaultHook }) as NexgenRouter;
  const baseOpenapi = router.openapi.bind(router);

  router.group = function (...middlewares) {
    for (const middleware of middlewares) {
      this.use(middleware);
    }

    return this;
  };

  router.api = function (route: any, handlerOrMiddlewares: any, handler?: any) {
    if (!Array.isArray(handlerOrMiddlewares)) {
      baseOpenapi(route, handlerOrMiddlewares);
      return this;
    }

    const middlewares = handlerOrMiddlewares;
    const finalHandler = handler;

    if (typeof finalHandler !== "function") {
      throw new Error("api(route, middlewares, handler) requires a handler function");
    }

    const wrappedHandler = async (c: any) => {
      let index = 0;

      const next = async (): Promise<any> => {
        if (index < middlewares.length) {
          const middleware = middlewares[index++];
          let downstream: any;
          const result = await middleware(c, async () => {
            downstream = await next();
            return downstream;
          });

          return result === undefined ? downstream : result;
        }

        return await finalHandler(c);
      };

      return await next();
    };

    baseOpenapi(route, wrappedHandler);
    return this;
  };

  return router;
}

/**
 * Why: Shorthand for creating grouped router middleware chain.
 * When: Route files need shared middleware composition.
 * Where: Module route declarations.
 * How: Creates a router instance and applies all provided middlewares.
 */
export function group(...middlewares: any[]) {
  return createRouter().group(...middlewares);
}
