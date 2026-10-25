import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";

describe("real Agorix Kids deterministic baseline", () => {
  it("executes each canonical Kids mission against its actual starter program", () => {
    const records = captureOriDeterministicBaseline();
    expect(records).toHaveLength(KIDS_MISSION_IDS.length);
    expect(records.map((record) => record.missionId)).toEqual([...KIDS_MISSION_IDS]);
    expect(records.every((record) => record.source === "agorix-deterministic-rule")).toBe(true);
  });
  it("does not modify any starter project", () => {
    expect(captureOriDeterministicBaseline().every((record) => record.starterProgramUnchanged)).toBe(true);
  });
  it("produces reproducible structured offers", () => {
    expect(captureOriDeterministicBaseline()).toEqual(captureOriDeterministicBaseline());
  });
  it("never claims to have produced a free-text teaching hint", () => {
    const records = captureOriDeterministicBaseline();
    expect(records.every((record) => !("hint" in record) && !("nextStep" in record))).toBe(true);
  });
});
