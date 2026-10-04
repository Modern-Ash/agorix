import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import type { DevBackend } from "./devBackend.js";

type Use = (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;

/**
 * DEVELOPMENT AND E2E ONLY. Mounts the in-process dev backend on the Vite dev/preview server when
 * `AGORIX_DEV_BACKEND=1`. It is never part of the build output and never a production auth claim.
 *
 * The backend imports workspace TypeScript packages, which plain Node cannot load from a Vite
 * config, so a private middleware-mode Vite server transforms and loads it on first use.
 */
export function devBackendPlugin(enabled: boolean): Plugin {
  let backendPromise: Promise<DevBackend> | undefined;
  let loader: ViteDevServer | undefined;

  function loadBackend(): Promise<DevBackend> {
    backendPromise ??= (async () => {
      loader = await createServer({
        configFile: false,
        logLevel: "silent",
        appType: "custom",
        server: { middlewareMode: true, hmr: false, ws: false },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      const module = (await loader.ssrLoadModule("/src/dev/devBackend.ts")) as {
        createDevBackend: () => DevBackend;
      };
      return module.createDevBackend();
    })();
    return backendPromise;
  }

  function mount(use: Use) {
    use((req, res, next) => {
      const url = req.url ?? "/";
      if (!url.startsWith("/v1/") && !url.startsWith("/__dev/auth/")) {
        next();
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const headers: Record<string, string | undefined> = {};
        for (const [name, value] of Object.entries(req.headers)) {
          headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
        }
        const body = Buffer.concat(chunks).toString("utf8");
        void loadBackend()
          .then((backend) =>
            backend.handle({
              method: req.method ?? "GET",
              url,
              headers,
              ...(body === "" ? {} : { body }),
            }),
          )
          .then((response) => {
            res.statusCode = response.status;
            for (const [name, value] of Object.entries(response.headers)) {
              res.setHeader(name, value);
            }
            res.end(response.body === null ? undefined : JSON.stringify(response.body));
          })
          .catch(() => {
            res.statusCode = 503;
            res.end();
          });
      });
    });
  }

  function closeLoader() {
    void loader?.close();
  }

  return {
    name: "agorix-dev-backend",
    configureServer(server) {
      if (!enabled) return;
      mount((handler) => server.middlewares.use(handler));
      server.httpServer?.once("close", closeLoader);
    },
    configurePreviewServer(server) {
      if (!enabled) return;
      mount((handler) => server.middlewares.use(handler));
      server.httpServer.once("close", closeLoader);
    },
  };
}
