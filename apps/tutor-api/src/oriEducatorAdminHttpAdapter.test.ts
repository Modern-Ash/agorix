import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createOriEducatorAdminHttpAdapter } from "./oriEducatorAdminHttpAdapter.js";
import type { createOriEducatorAdminComposition } from "./oriEducatorAdminComposition.js";

function request(body?: unknown) {
  const stream = new PassThrough() as IncomingMessage & PassThrough;
  Object.assign(stream, { method: "POST", headers: {} });
  stream.end(body === undefined ? "" : JSON.stringify(body));
  return stream;
}
function response() {
  let status = 0;
  let body = "";
  const value = {
    destroyed: false, writableEnded: false, headersSent: false,
    writeHead(code: number) { status = code; },
    end(text: string) { body = text; },
  } as unknown as ServerResponse;
  return { value, result: () => ({ status, body }) };
}
describe("Ori adult educator HTTP adapter", () => {
  it("returns a bounded snapshot without registering a route", async () => {
    const admin = {
      snapshot: async () => ({ evidenceDigest: "a".repeat(64), revision: 1, rolloutAuthorized: false }),
      decide: async () => "recorded",
      audit: async () => [],
    } as unknown as ReturnType<typeof createOriEducatorAdminComposition>;
    const handler = createOriEducatorAdminHttpAdapter(admin);
    const output = response();
    await handler("snapshot", "pilot", request(), output.value);
    expect(output.result().status).toBe(200);
    expect(output.result().body).toContain('"rolloutAuthorized":false');
  });
  it("rejects authority fields and malformed decisions", async () => {
    let calls = 0;
    const admin = {
      snapshot: async () => ({ evidenceDigest: "a".repeat(64), revision: 1 }),
      decide: async () => { calls++; return "recorded"; },
      audit: async () => null,
    } as unknown as ReturnType<typeof createOriEducatorAdminComposition>;
    const handler = createOriEducatorAdminHttpAdapter(admin);
    const output = response();
    await handler("decide", "pilot", request({
      evidenceDigest: "a".repeat(64), revision: 1, missionId: "movement",
      decision: "approve", rationale: "Revisión pedagógica suficiente", reviewerId: "forged",
    }), output.value);
    expect(output.result().status).toBe(400);
    expect(calls).toBe(0);
  });
  it("does not consume a decision body when educator authorization fails", async () => {
    let calls = 0;
    const admin = {
      snapshot: async () => null,
      decide: async () => { calls++; return "recorded"; },
      audit: async () => null,
    } as unknown as ReturnType<typeof createOriEducatorAdminComposition>;
    const output = response();
    await createOriEducatorAdminHttpAdapter(admin)("decide", "pilot", request({}), output.value);
    expect(output.result().status).toBe(403);
    expect(calls).toBe(0);
  });
});
