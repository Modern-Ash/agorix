import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { runOriMig03TechnicalExitChecks } from "./oriMig03ExecutableExitChecks.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
function bundle(): Bundle {
  const payload = {
    schema: "agorix/ori-mig03-educator-audit/v1" as const,
    reviewId: "pilot", missionId: "move", ticketId: "ticket",
    reviewDigest: "a".repeat(64), reviewRevision: 1,
    proposalEvidenceHash: "b".repeat(64), presentationHash: "c".repeat(64),
    technicalReadiness: "blocked" as const, blockers: ["review-required"],
    humanApproval: false as const, rolloutAuthorized: false as const,
  };
  return { ...payload,
    auditHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
}
describe("MIG-03 executable host exit checks", () => {
  it("executes all probes and records blockers without enabling rollout", async () => {
    const called: string[] = [];
    const check = (name: string, result: boolean) => async () => {
      called.push(name); return result;
    };
    const result = await runOriMig03TechnicalExitChecks(bundle(), {
      session: check("session", true), project: check("project", true),
      oriProcess: check("ori", false), durableStorage: check("storage", true),
      educatorReview: check("human", false),
    });
    expect(called).toHaveLength(5);
    expect(result?.blockers).toContain("real-ori-process-unverified");
    expect(result?.blockers).toContain("educator-review-pending");
    expect(result?.rolloutAuthorized).toBe(false);
  });
  it("fails closed on probe exceptions", async () => {
    const yes = async () => true;
    const result = await runOriMig03TechnicalExitChecks(bundle(), {
      session: async () => { throw Error("offline"); },
      project: yes, oriProcess: yes, durableStorage: yes, educatorReview: yes,
    });
    expect(result?.blockers).toContain("production-session-unverified");
  });
});
