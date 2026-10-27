import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { createOriAuthorizedReviewRecordingService } from "./oriAuthorizedReviewRecordingService.js";
import { createOriVerifiedRecordHttpHandler } from "./oriVerifiedRecordHttpHandler.js";

function request(payload: unknown): IncomingMessage {
  const stream = new PassThrough() as IncomingMessage & PassThrough;
  Object.assign(stream, { method: "POST", headers: {} });
  stream.end(JSON.stringify(payload));
  return stream;
}
function response() {
  let status = 0;
  let body = "";
  return {
    value: { destroyed: false, writableEnded: false, headersSent: false,
      writeHead(code: number) { status = code; },
      end(text: string) { body = text; },
    } as unknown as ServerResponse,
    result: () => ({ status, body }),
  };
}
const payload = {
  evidenceDigest: "a".repeat(64), revision: 1,
  missionId: "move", reviewerId: "educator",
  disposition: "approve", rationale: "Evaluación educativa documentada",
  evidenceRefs: { "ori-proposal": "artifact:ori" },
};
describe("MIG-03 verified record HTTP contract", () => {
  it("delegates a valid request and maps conflict to 409", async () => {
    const service = { record: async () => "conflict" } as unknown as
      ReturnType<typeof createOriAuthorizedReviewRecordingService>;
    const output = response();
    await createOriVerifiedRecordHttpHandler(service, async () => true)("pilot", request(payload), output.value);
    expect(output.result().status).toBe(409);
  });
  it("rejects unknown fields without invoking the service", async () => {
    let calls = 0;
    const service = { record: async () => { calls++; return "recorded"; } } as unknown as
      ReturnType<typeof createOriAuthorizedReviewRecordingService>;
    const output = response();
    await createOriVerifiedRecordHttpHandler(service, async () => true)("pilot",
      request({ ...payload, canReviewOri: true }), output.value);
    expect(output.result().status).toBe(400);
    expect(calls).toBe(0);
  });
  it("denies unauthenticated requests before reading the body or recording", async () => {
    let calls = 0;
    const service = { record: async () => { calls++; return "recorded"; } } as unknown as
      ReturnType<typeof createOriAuthorizedReviewRecordingService>;
    const output = response();
    await createOriVerifiedRecordHttpHandler(service, async () => false)(
      "pilot", request(payload), output.value);
    expect(output.result().status).toBe(403);
    expect(calls).toBe(0);
  });
  it("returns 400 for malformed JSON and 413 for oversized bodies", async () => {
    let calls = 0;
    const service = { record: async () => { calls++; return "recorded"; } } as unknown as
      ReturnType<typeof createOriAuthorizedReviewRecordingService>;
    const handler = createOriVerifiedRecordHttpHandler(service, async () => true);
    const malformed = new PassThrough() as IncomingMessage & PassThrough;
    Object.assign(malformed, { method: "POST", headers: {} });
    malformed.end("{invalid");
    const bad = response();
    await handler("pilot", malformed, bad.value);
    expect(bad.result().status).toBe(400);
    const oversized = response();
    await handler("pilot", request({ ...payload, rationale: "x".repeat(5000) }), oversized.value);
    expect(oversized.result().status).toBe(413);
    expect(calls).toBe(0);
  });
});
