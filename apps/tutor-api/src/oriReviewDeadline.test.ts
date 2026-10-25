import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { readOriReviewBodyWithDeadline } from "./oriReviewDeadline.js";

const valid = JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 });
function stream() {
  return new PassThrough();
}
describe("Ori review HTTP body deadline", () => {
  it("reads a complete bounded body", async () => {
    const request = stream();
    request.end(valid);
    expect(await readOriReviewBodyWithDeadline(request as unknown as IncomingMessage)).toEqual({
      missionIndex: 1,
      hintLevel: 2,
      scriptCount: 1,
    });
  });
  it("terminates a stalled stream on deadline", async () => {
    const request = stream();
    request.write(valid.slice(0, 4));
    const result = await readOriReviewBodyWithDeadline(request as unknown as IncomingMessage, 20);
    expect(result).toBeNull();
    expect(request.destroyed).toBe(true);
  });
  it("terminates a stalled stream on external abort", async () => {
    const request = stream();
    const controller = new AbortController();
    const pending = readOriReviewBodyWithDeadline(request as unknown as IncomingMessage, 1000, 512, controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
    expect(request.destroyed).toBe(true);
  });
  it("rejects pre-aborted requests without reading", async () => {
    const request = stream();
    const controller = new AbortController();
    controller.abort();
    expect(await readOriReviewBodyWithDeadline(request, 1000, 512, controller.signal)).toBeNull();
    request.destroy();
  });
  it("rejects an oversized body", async () => {
    const request = stream();
    request.end("x".repeat(513));
    expect(await readOriReviewBodyWithDeadline(request)).toBeNull();
  });
  it.each([0, -1, 10_001, 1.5, Number.NaN])("rejects invalid deadline %s", async (value) => {
    const request = stream();
    await expect(readOriReviewBodyWithDeadline(request as unknown as IncomingMessage, value)).rejects.toThrow();
    request.destroy();
  });
});
