import { describe, expect, it } from "vitest";
import {
  createLayaLearningProvider,
  createStudioPipeline,
  decideProactiveWithStudioPipeline,
} from "./index.js";
import type { ProactiveSignal } from "./proactive.js";

const signal: ProactiveSignal = {
  kind: "runtime-error",
  occurrences: 1,
  running: false,
  typing: false,
  aiEnabled: true,
  code: "E_LOOP",
  declinedForCurrentProgram: false,
  declinedCount: 0,
  ignoredCount: 0,
};

describe("proactive Studio pipeline bridge", () => {
  it("keeps System-0 proactive offers provider-free", async () => {
    const pipeline = createStudioPipeline({
      route: () => ({
        status: "deterministic",
        reason: "ambient-pre-acceptance",
        providerRequestAllowed: false,
      }),
    });
    const decision = await decideProactiveWithStudioPipeline(signal, { pipeline });

    expect(decision).toMatchObject({ action: "offer", source: "system0" });
    expect(pipeline.summary().providerRequests).toBe(0);
  });

  it("lets LAYA make proactive offers quieter through the Studio pipeline", async () => {
    const pipeline = createStudioPipeline({
      system1: createLayaLearningProvider({
        decideMany: async () => [
          { id: "generativeNeeded", value: "no", confidence: 0.99 },
          { id: "reasoningTier", value: "deterministic", confidence: 0.99 },
        ],
      }),
      route: () => ({
        status: "deterministic",
        reason: "ambient-pre-acceptance",
        providerRequestAllowed: false,
      }),
    });
    const decision = await decideProactiveWithStudioPipeline(signal, { pipeline });

    expect(decision).toMatchObject({
      action: "silence",
      reason: "laya-judged-not-now",
      source: "laya",
    });
    expect(pipeline.summary().providerRequests).toBe(0);
  });
});
