import { describe, expect, it } from "vitest";
import { captureOriMissionSourceEvidence } from "./oriMissionSourceEvidence.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";

describe("MIG-03 actual mission source evidence", () => {
  it("retains missing plans as missing and captures the real Kids baseline", async () => {
    const consumer = { evaluate: async () => null } as unknown as OriPlanConsumer;
    const records = await captureOriMissionSourceEvidence(consumer);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((row) => row.oriProposal === null)).toBe(true);
    expect(records.every((row) => row.kidsBaseline !== null)).toBe(true);
    expect(records.every((row) =>
      row.provenance === "ori-loopback-synthetic-mission")).toBe(true);
  });
  it("does not silently turn process failures into valid evidence", async () => {
    const consumer = { evaluate: async () => { throw Error("unavailable"); } } as unknown as
      OriPlanConsumer;
    const records = await captureOriMissionSourceEvidence(consumer);
    expect(records.every((row) => row.oriProposal === null)).toBe(true);
  });
});
