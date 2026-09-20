import type { AddressInfo } from "node:net";
import type { RealtimeServeWebSocket } from "@/framework/realtime/socket.js";
import { WS_PATH } from "@/framework/realtime/socket.js";
import { runtime } from "@/framework/runtime/runtime.js";

export type HttpServerHandle = {
  address(): string | AddressInfo | null;
  close(): Promise<void>;
  native: unknown;
};

/**
 * Why: Starts the Hono app on the active runtime's native HTTP server.
 * When: Server bootstrap after the kernel is created.
 * Where: Framework server entrypoint.
 * How: Picks the runtime-appropriate serve (node-server/Bun.serve),
 *      wires runtime-specific WebSocket primitives when provided, and wraps
 *      the server in a uniform handle for address/close access.
 */
async function startNode(
  app: { fetch: (request: Request) => Response | Promise<Response> },
  port: number,
  websocket?: RealtimeServeWebSocket
): Promise<HttpServerHandle> {
  const [{ serve }, { createServer }] = await Promise.all([import("@hono/node-server"), import("node:http")]);

  const server = websocket?.node
    ? serve({ fetch: app.fetch, port, createServer, websocket: { server: websocket.node } })
    : serve({ fetch: app.fetch, port, createServer });
  return {
    native: server,
    address: () => server.address(),
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

async function startBun(
  app: { fetch: (request: Request) => Response | Promise<Response> },
  port: number,
  websocket?: RealtimeServeWebSocket
): Promise<HttpServerHandle> {
  const globals = globalThis as Record<string, any>;

  let serverInstance: any;

  const serverConfig: any = {
    fetch: async (req: Request) => {
      // Check if this is a socket.io request
      const url = new URL(req.url);
      if (url.pathname === WS_PATH || url.pathname.startsWith(`${WS_PATH}/`)) {
        const engine = (app as any)._engine;
        if (engine) {
          // Pass the Bun server instance
          return engine.handleRequest(req, serverInstance);
        }
      }
      return app.fetch(req);
    },
    port
  };

  if (websocket?.bun) {
    serverConfig.websocket = websocket.bun.websocket;
    if (websocket.bun.idleTimeout) {
      serverConfig.idleTimeout = websocket.bun.idleTimeout;
    }
    // NOTE: Do NOT pass websocket.bun.maxRequestBodySize here.
    // That value is meant for WebSocket message limits, not HTTP body limits.
    // Passing it to Bun.serve() would override the default 128 MB HTTP body
    // limit with the much smaller WebSocket limit (1 MB), breaking file uploads.
    // The actual file size validation is handled by the app-level setting
    // (common_max_file_size_mb / max_file_size_mb) in each module's controller.
  }

  serverInstance = globals.Bun.serve(serverConfig);

  return {
    native: serverInstance,
    address: () =>
      ({
        address: serverInstance.hostname || "localhost",
        family: "IPv4",
        port: serverInstance.port
      }) as AddressInfo,
    close: () => Promise.resolve(serverInstance.stop())
  };
}

export async function startHttpServer(
  app: { fetch: (request: Request) => Response | Promise<Response> },
  port: number,
  websocket?: RealtimeServeWebSocket
): Promise<HttpServerHandle> {
  const activeRuntime = runtime();
  if (activeRuntime === "bun") return startBun(app, port, websocket);
  return startNode(app, port, websocket);
}
