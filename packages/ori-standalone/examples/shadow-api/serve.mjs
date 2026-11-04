import { createShadowServer } from "./server.mjs";

// Local test utility only. No external interface, authentication or child data.
const port = Number(process.env.ORI_SHADOW_PORT ?? "11485");
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error("ORI_SHADOW_PORT must be between 1024 and 65535");
}
const server = createShadowServer();
server.listen(port, "127.0.0.1", () => {
  console.log(`ORI_SHADOW_READY http://127.0.0.1:${port}/v1/plan`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
