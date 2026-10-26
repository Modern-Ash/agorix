import { describe, expect, it } from "vitest";
import { readOriReviewBody } from "./oriReviewBody.js";

const valid = JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 3 });
async function* parts(...chunks: Uint8Array[]) {
  for (const chunk of chunks) yield chunk;
}
const bytes = (value: string) => new TextEncoder().encode(value);
describe("Ori bounded streaming body reader", () => {
  it("accepts a valid body split into arbitrary chunks", async () => {
    const data = bytes(valid);
    expect(
      await readOriReviewBody(parts(data.slice(0, 1), data.slice(1, 8), data.slice(8))),
    ).toEqual({
      missionIndex: 1,
      hintLevel: 2,
      scriptCount: 3,
    });
  });
  it("rejects an oversized body without consuming further chunks", async () => {
    let consumed = 0;
    async function* oversized() {
      consumed++;
      yield bytes("x".repeat(513));
      consumed++;
      yield bytes(valid);
    }
    expect(await readOriReviewBody(oversized())).toBeNull();
    expect(consumed).toBe(1);
  });
  it("rejects a body that exceeds the cap cumulatively", async () => {
    expect(
      await readOriReviewBody(parts(bytes("x".repeat(300)), bytes("x".repeat(213)))),
    ).toBeNull();
  });
  it("rejects malformed UTF-8", async () => {
    expect(await readOriReviewBody(parts(new Uint8Array([0xff, 0xfe])))).toBeNull();
  });
  it("rejects malformed JSON", async () => {
    expect(await readOriReviewBody(parts(bytes("{broken")))).toBeNull();
  });
  it("fails closed on stream failure", async () => {
    async function* broken(): AsyncGenerator<Uint8Array> {
      yield bytes(valid.slice(0, 5));
      throw new Error("synthetic disconnect");
    }
    expect(await readOriReviewBody(broken())).toBeNull();
  });
  it.each([0, 63, 4097, Number.NaN])("rejects invalid byte limit %s", async (limit) => {
    await expect(readOriReviewBody(parts(bytes(valid)), limit)).rejects.toThrow();
  });
  it("rejects unexpected child data even when small", async () => {
    const payload = JSON.stringify({
      missionIndex: 1,
      hintLevel: 2,
      scriptCount: 3,
      childId: "synthetic",
    });
    expect(await readOriReviewBody(parts(bytes(payload)))).toBeNull();
  });
  it("rejects a pre-aborted signal without reading request data", async () => {
    const controller = new AbortController();
    controller.abort();
    let consumed = false;
    async function* unread() {
      consumed = true;
      yield bytes(valid);
    }
    expect(await readOriReviewBody(unread(), 512, controller.signal)).toBeNull();
    expect(consumed).toBe(false);
  });
  it("rejects abort between streaming chunks", async () => {
    const controller = new AbortController();
    async function* interrupted() {
      yield bytes(valid.slice(0, 5));
      controller.abort();
      yield bytes(valid.slice(5));
    }
    expect(await readOriReviewBody(interrupted(), 512, controller.signal)).toBeNull();
  });
  it("rejects an abort immediately after the final chunk", async () => {
    const controller = new AbortController();
    async function* interrupted() {
      yield bytes(valid);
      controller.abort();
    }
    expect(await readOriReviewBody(interrupted(), 512, controller.signal)).toBeNull();
  });
});
