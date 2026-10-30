import { describe, expect, it } from "vitest";
import {
  oriHostProposalConfigFromEnv,
  validateTrustedOriEvidence,
} from "./oriHostEvidenceAdapter.js";
const request = {
  expectedSteps: 2,
  hostContext: {
    attempts: 1,
    capabilities: ["inspectProgram", "inspectTrace"],
    grants: ["inspectProgram", "inspectTrace"],
    hintsUsed: 1,
    learningStage: "connect",
    sessionId: "synthetic",
  },
  intent: "move",
  programRevision: "a".repeat(64),
  snapshot: { allowedBlocks: ["move", "turn"] },
  trace: {
    steps: [
      { index: 0, description: "Executed move" },
      { index: 1, description: "Executed turn" },
    ],
  },
};
describe("Ori trusted host evidence boundary", () => {
  it("keeps private model routing disabled unless explicitly selected", () => {
    expect(oriHostProposalConfigFromEnv({})).toBeUndefined();
    expect(
      oriHostProposalConfigFromEnv({ AGORIX_ORI_REVIEW_PROVIDER: "disabled" }),
    ).toBeUndefined();
    expect(oriHostProposalConfigFromEnv({ AGORIX_ORI_REVIEW_PROVIDER: "auto" })).toMatchObject({
      provider: "auto",
      timeoutMs: 1500,
    });
  });
  it("rejects external endpoints and invalid provider policy", () => {
    expect(() => oriHostProposalConfigFromEnv({ AGORIX_ORI_REVIEW_PROVIDER: "cloud" })).toThrow();
    expect(() =>
      oriHostProposalConfigFromEnv({
        AGORIX_ORI_REVIEW_PROVIDER: "compatible",
        AGORIX_ORI_REVIEW_COMPATIBLE_ENDPOINT: "https://example.com",
      }),
    ).toThrow();
    expect(() =>
      oriHostProposalConfigFromEnv({
        AGORIX_ORI_REVIEW_PROVIDER: "auto",
        AGORIX_ORI_REVIEW_MODEL_TIMEOUT_MS: "9000",
      }),
    ).toThrow();
  });
  it("accepts bounded canonical evidence", () => {
    expect(validateTrustedOriEvidence(request)).not.toBeNull();
  });
  it("rejects browser-like extra data", () => {
    expect(validateTrustedOriEvidence({ ...request, childText: "private" })).toBeNull();
    expect(
      validateTrustedOriEvidence({
        ...request,
        trace: { steps: [...request.trace.steps], rawProgram: "secret" },
      }),
    ).toBeNull();
  });
  it("rejects missing grants", () => {
    expect(
      validateTrustedOriEvidence({
        ...request,
        hostContext: { ...request.hostContext, grants: ["inspectProgram"] },
      }),
    ).toBeNull();
  });
  it("rejects stale or malformed revision", () => {
    expect(validateTrustedOriEvidence({ ...request, programRevision: "abc" })).toBeNull();
  });
  it("rejects incomplete and out-of-order trace", () => {
    expect(validateTrustedOriEvidence({ ...request, expectedSteps: 3 })).toBeNull();
    expect(
      validateTrustedOriEvidence({
        ...request,
        trace: { steps: [request.trace.steps[1], request.trace.steps[0]] },
      }),
    ).toBeNull();
  });
});
