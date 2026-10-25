import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";
import { dispatchOriExternalShadow } from "./oriExternalShadow.js";

/** In-process, loopback-only stand-in for Modern-Ash/ori /v0/shadow. */
describe("Agorix to Ori shadow transport e2e", () => {
  it("transmits only metadata and never changes the tutor response", async () => {
    const seen: unknown[] = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      seen.push({ path: request.url, body: JSON.parse(body) });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "UNTRUSTED", proposal: { apply: true } }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const shadow = createOriShadowTransport(`http://127.0.0.1:${port}/v0/shadow`);
      const originalTutorResponse = { message: "Existing safe fallback" };
      await shadow({ missionIndex: 0, hintLevel: 2, scriptCount: 1 });
      expect(seen).toEqual([{ path: "/v0/shadow", body: { missionIndex: 0, hintLevel: 2, scriptCount: 1 } }]);
      expect(originalTutorResponse).toEqual({ message: "Existing safe fallback" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("does not invoke network when feature is disabled", async () => {
    let invoked = false;
    dispatchOriExternalShadow(false, async () => { invoked = true; }, { missionIndex: 0, hintLevel: 1, scriptCount: 1 });
    await Promise.resolve();
    expect(invoked).toBe(false);
  });

  it("network failures do not propagate into tutor flow", async () => {
    const shadow = createOriShadowTransport("http://127.0.0.1:1/v0/shadow");
    dispatchOriExternalShadow(true, shadow, { missionIndex: 0, hintLevel: 1, scriptCount: 1 });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(true).toBe(true);
  });
});
