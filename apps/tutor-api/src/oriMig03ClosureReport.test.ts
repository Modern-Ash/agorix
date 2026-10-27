import { describe, expect, it } from "vitest";
import { buildOriMig03ClosureReport } from "./oriMig03ClosureReport.js";
import type { OriMig03AcceptanceManifest } from "./oriMig03AcceptanceManifest.js";

const manifest: OriMig03AcceptanceManifest = {
  schemaVersion: "agorix/ori-mig03-acceptance/v1",
  reviewId: "pilot", evidenceDigest: "a".repeat(64), revision: 3,
  readiness: "ready-for-human-acceptance", blockers: [],
  auditDigest: "b".repeat(64), educatorDecisionCount: 1,
  rolloutAuthorized: false,
};
describe("Ori MIG-03 closure report", () => {
  it("keeps formal closure pending even with complete technical checks", () => {
    expect(buildOriMig03ClosureReport(manifest, {
      crossRepoRuntimePassed: true, adminHttpVerticalPassed: true, formattingPassed: true,
    })).toMatchObject({
      technicalStatus: "ready-for-review", formalClosure: "pending-human-approval",
      nextStage: "MIG-03", rolloutAuthorized: false,
    });
  });
  it("reports failed checks and preexisting acceptance blockers", () => {
    const result = buildOriMig03ClosureReport({
      ...manifest, blockers: ["educator-signoff-incomplete"],
    }, {
      crossRepoRuntimePassed: false, adminHttpVerticalPassed: true, formattingPassed: false,
    });
    expect(result.technicalStatus).toBe("blocked");
    expect(result.blockers).toEqual([
      "educator-signoff-incomplete", "cross-repo-runtime-unverified", "formatting-check-failed",
    ]);
  });
});
