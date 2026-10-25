import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { captureOriCanonicalProgramEvidence } from "./oriCanonicalProgramEvidence.js";

describe("Ori canonical Kids program evidence", () => {
  it("captures every actual Kids mission", () => {
    const records = captureOriCanonicalProgramEvidence();
    expect(records).toHaveLength(KIDS_MISSION_IDS.length);
    expect(records.map((record) => record.missionId)).toEqual([...KIDS_MISSION_IDS]);
  });
  it("derives each fingerprint from the real serialized starter program", () => {
    const records = captureOriCanonicalProgramEvidence();
    for (const record of records) {
      const program = getKidsMission(record.missionId, "es").starterProject;
      expect(record.programFingerprint).toBe(
        createHash("sha256").update(JSON.stringify(program), "utf8").digest("hex"),
      );
      expect(record.scriptCount).toBe(program.scripts.length);
    }
  });
  it("never mutates a canonical starter program", () => {
    expect(captureOriCanonicalProgramEvidence().every((record) => record.programUnchanged)).toBe(true);
  });
  it("is deterministic across repeated executions", () => {
    expect(captureOriCanonicalProgramEvidence()).toEqual(captureOriCanonicalProgramEvidence());
  });
  it("never fabricates a text hint or next step", () => {
    expect(captureOriCanonicalProgramEvidence().every((record) => !("hint" in record) && !("nextStep" in record))).toBe(true);
  });
});
