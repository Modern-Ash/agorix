import { describe, expect, it } from "vitest";
import { parseOriReviewInput } from "./oriReviewInput.js";

const valid = { missionIndex: 1, hintLevel: 2, scriptCount: 3 };
describe("Ori review request parser", () => {
  it("accepts only three bounded metadata fields", () => {
    expect(parseOriReviewInput(JSON.stringify(valid))).toEqual(valid);
  });
  it.each([
    ["malformed JSON", "{bad"],
    ["array", "[]"],
    ["null", "null"],
    ["missing field", JSON.stringify({ missionIndex: 1, hintLevel: 2 })],
    ["extra child data", JSON.stringify({ ...valid, childId: "synthetic" })],
    ["extra source code", JSON.stringify({ ...valid, program: "synthetic" })],
    ["negative mission", JSON.stringify({ ...valid, missionIndex: -1 })],
    ["large mission", JSON.stringify({ ...valid, missionIndex: 1001 })],
    ["zero stage", JSON.stringify({ ...valid, hintLevel: 0 })],
    ["stage above five", JSON.stringify({ ...valid, hintLevel: 6 })],
    ["fractional stage", JSON.stringify({ ...valid, hintLevel: 1.5 })],
    ["negative scripts", JSON.stringify({ ...valid, scriptCount: -1 })],
    ["excess scripts", JSON.stringify({ ...valid, scriptCount: 1001 })],
    ["string integer", JSON.stringify({ ...valid, missionIndex: "1" })],
    ["oversized", JSON.stringify({ ...valid, padding: "x".repeat(1024) })],
  ])("rejects %s", (_label, raw) => {
    expect(parseOriReviewInput(raw)).toBeNull();
  });
  it.each([0, 63, 4097, 1.5, Number.NaN])("rejects invalid max bytes %s", (size) => {
    expect(() => parseOriReviewInput(JSON.stringify(valid), size)).toThrow();
  });
  it("enforces byte limit rather than character count", () => {
    const raw = JSON.stringify({ ...valid, extra: "á".repeat(200) });
    expect(parseOriReviewInput(raw, 128)).toBeNull();
  });
  it("returns immutable metadata", () => {
    expect(Object.isFrozen(parseOriReviewInput(JSON.stringify(valid)))).toBe(true);
  });
});
