import { createServer } from "node:http";
import { evaluateShadowMetadata } from "../../src/shadow-metadata.mjs";
import { planShadowMetadata } from "../../src/shadow-plan.mjs";
/** Loopback-only synthetic Ori shadow endpoint. */
export function createShadowServer() {
  return createServer(async (req, res) => {
    const send = (code, payload) => {
      res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    if (!["/v0/shadow", "/v1/plan"].includes(req.url) || req.method !== "POST") return send(404, { error: "not-found" });
    if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "unsupported-media-type" });
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body, "utf8") > 1024) return send(413, { error: "too-large" });
      }
      const input = JSON.parse(body);
      return send(200, req.url === "/v1/plan" ? planShadowMetadata(input) : evaluateShadowMetadata(input));
    } catch { return send(400, { error: "invalid-request" }); }
  });
}
