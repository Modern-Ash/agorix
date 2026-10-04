import { describe, expect, it } from "vitest";
import {
  createLayaLearningProvider,
  createStudioPipeline,
  createStudioSignal,
  type LearningDecisionState,
  type StudioRouter,
} from "@agorix/learning-decision-plane";
import { createFakeProviderRuntime } from "./index.js";
import { routeLearningRequirements } from "./selection.js";

const STATE: LearningDecisionState = {
  capability: "explainer",
  scaffoldLevel: 1,
  scaffoldHistoryLength: 0,
  hasLearnerIntent: true,
  hasRuntime: false,
  runtimeFactCount: 0,
  selectedNodeCount: 1,
  offline: false,
  explicitStrongerHelpRequested: false,
};

describe("studio pipeline with routeLearningRequirements", () => {
  const local = createFakeProviderRuntime({
    runtimeId: "fake-local",
    providerId: "fake-local",
    modelId: "m",
    locality: "local",
    capabilities: ["explainer"],
  });
  const route: StudioRouter = (requirements) => {
    const r = routeLearningRequirements(requirements, [local], new Map(), ["fake-local"]);
    return {
      status: r.status,
      reason: r.reason,
      providerRequestAllowed: r.providerRequestAllowed,
      ...(r.selection?.status === "selected" ? { locality: r.selection.descriptor.locality } : {}),
    };
  };
  const signal = createStudioSignal("runtime-error", 1, { code: "E1" });
  if (signal === undefined) throw new Error("signal");

  it("LAYA local decision selects the local runtime", async () => {
    const pipeline = createStudioPipeline({
      route,
      system1: createLayaLearningProvider({
        async decideMany() {
          return [
            { id: "generativeNeeded", value: "yes", confidence: 0.99 },
            { id: "reasoningTier", value: "local", confidence: 0.99 },
          ];
        },
      }),
    });
    const d = await pipeline.decide({ signal, state: STATE, programHash: "h" });
    expect(d.route.status).toBe("selected");
    expect(d.telemetry.providerLocality).toBe("local");
  });

  it("LAYA cannot escalate a deterministic System-0 floor", async () => {
    const pipeline = createStudioPipeline({
      route,
      system1: createLayaLearningProvider({
        async decideMany() {
          return [{ id: "reasoningTier", value: "remote", confidence: 0.99 }];
        },
      }),
    });
    const d = await pipeline.decide({
      signal,
      state: { ...STATE, offline: true },
      programHash: "h",
    });
    expect(d.route.status).toBe("deterministic");
    expect(d.providerRequestAllowed).toBe(false);
  });
});
