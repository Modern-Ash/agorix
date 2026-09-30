import { describe, expect, it } from "vitest";
import type { LearningRequirements } from "@agorix/learning-decision-plane";
import { createFakeProviderRuntime, type LearningCompanionProviderRuntime } from "./index.js";
import { routeLearningRequirements } from "./selection.js";

function req(overrides: Partial<LearningRequirements> = {}): LearningRequirements {
  return { schema: "agorix/learning-requirements/v1", generativeNeeded: "yes", clarificationNeeded: "no", assistanceLevel: 1, learningCapability: "coach", solutionAllowance: "none", runtimeEvidenceNeeded: "no", contextNeed: "bounded", reasoningTier: "local", provenance: { generativeNeeded: "fallback", clarificationNeeded: "fallback", assistanceLevel: "fallback", learningCapability: "system0", solutionAllowance: "system0", runtimeEvidenceNeeded: "system0", contextNeed: "fallback", reasoningTier: "fallback" }, ...overrides };
}
function runtime(id: string, locality: "local" | "remote", capabilities: LearningRequirements["learningCapability"][]): LearningCompanionProviderRuntime {
  return createFakeProviderRuntime({ runtimeId: id, providerId: id, modelId: id + "-model", locality, capabilities });
}

describe("Learning Decision Plane provider conformance", () => {
  const local = runtime("fake-local", "local", ["coach", "debugger", "reflector"]);
  const remote = runtime("fake-remote", "remote", ["coach", "builder", "explainer", "challenger"]);
  const runtimes = [local, remote];

  it("deterministic requirements bypass every provider class", () => {
    const route = routeLearningRequirements(req({ generativeNeeded: "no", reasoningTier: "deterministic" }), runtimes, new Map(), ["fake-local", "fake-remote"]);
    expect(route.status).toBe("deterministic");
    expect(route.providerSelectionBypassed).toBe(true);
    expect(route.providerRequestAllowed).toBe(false);
  });
  it("local-only requirements never select a remote runtime", () => {
    const route = routeLearningRequirements(req({ learningCapability: "builder", reasoningTier: "local" }), runtimes, new Map(), ["fake-remote", "fake-local"]);
    expect(route.status).toBe("unavailable");
    expect(route.providerRequestAllowed).toBe(false);
  });
  it("remote-allowed requirements retain capability-aware fallback", () => {
    const route = routeLearningRequirements(req({ learningCapability: "builder", reasoningTier: "remote" }), runtimes, new Map(), ["fake-local", "fake-remote"]);
    expect(route.status).toBe("selected");
    if (route.selection?.status === "selected") expect(route.selection.descriptor.runtimeId).toBe("fake-remote");
  });
  it.each(["coach", "debugger", "reflector"] as const)("local fake advertises and negotiates %s", (capability) => { expect(local.negotiate(capability).supported).toBe(true); });
  it.each(["coach", "builder", "explainer", "challenger"] as const)("remote fake advertises and negotiates %s", (capability) => { expect(remote.negotiate(capability).supported).toBe(true); });
});
