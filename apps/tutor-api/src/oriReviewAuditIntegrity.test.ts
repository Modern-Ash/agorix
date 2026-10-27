import { describe, expect, it } from "vitest";
import { validateOriReviewAudit } from "./oriReviewAuditIntegrity.js";

const a = "a".repeat(64);
const b = "b".repeat(64);
describe("Ori educator review audit integrity", () => {
  it("accepts ordered review decisions and explicit evidence replacement", () => {
    expect(
      validateOriReviewAudit([
        {
          revision: 2,
          evidenceDigest: a,
          missionId: "m1",
          reviewerId: "educator",
          decision: "approve",
        },
        {
          revision: 3,
          evidenceDigest: b,
          missionId: "",
          reviewerId: "system",
          decision: "evidence-replaced",
        },
        {
          revision: 4,
          evidenceDigest: b,
          missionId: "m1",
          reviewerId: "educator",
          decision: "reject",
        },
      ]),
    ).toEqual({ valid: true, reason: null });
  });
  it("rejects missing transition, duplicated decisions and nonmonotonic revisions", () => {
    const event = {
      revision: 2,
      evidenceDigest: a,
      missionId: "m1",
      reviewerId: "educator",
      decision: "approve" as const,
    };
    expect(
      validateOriReviewAudit([event, { ...event, revision: 3, evidenceDigest: b }]).valid,
    ).toBe(false);
    expect(validateOriReviewAudit([event, { ...event, revision: 3 }]).valid).toBe(false);
    expect(validateOriReviewAudit([event, { ...event, revision: 2 }]).valid).toBe(false);
  });
});
