import { describe, expect, it } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";
import { createOriAcceptanceManifestHttpHandler } from "./oriAcceptanceManifestHttpHandler.js";

const request = { method: "POST", headers: {} } as IncomingMessage;
function response() {
  let status = 0;
  let body = "";
  return {
    value: {
      destroyed: false, writableEnded: false, headersSent: false,
      writeHead(code: number) { status = code; },
      end(text: string) { body = text; },
    } as unknown as ServerResponse,
    result: () => ({ status, body }),
  };
}
describe("MIG-03 authenticated acceptance manifest HTTP export", () => {
  it("returns manifest only after authorization and trusted provenance", async () => {
    const admin = {
      snapshot: async () => ({ revision: 2 }),
      acceptanceManifest: async () => ({ readiness: "blocked", rolloutAuthorized: false }),
    } as unknown as ReturnType<typeof createOriEducatorAdminComposition>;
    const handler = createOriAcceptanceManifestHttpHandler(admin,
      async () => ({ evidenceDigest: "a".repeat(64), verified: true }));
    const output = response();
    await handler("pilot", request, output.value);
    expect(output.result().status).toBe(200);
    expect(output.result().body).toContain('"rolloutAuthorized":false');
  });
  it("does not fetch evidence for unauthorized requests", async () => {
    let calls = 0;
    const admin = {
      snapshot: async () => null,
      acceptanceManifest: async () => { throw Error("unexpected"); },
    } as unknown as ReturnType<typeof createOriEducatorAdminComposition>;
    const handler = createOriAcceptanceManifestHttpHandler(admin, async () => {
      calls++;
      return { evidenceDigest: "a".repeat(64), verified: true };
    });
    const output = response();
    await handler("pilot", request, output.value);
    expect(output.result().status).toBe(403);
    expect(calls).toBe(0);
  });
});
