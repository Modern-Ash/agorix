import { describe, expect, it } from "vitest";
import {
  createFakeProviderRuntime,
  type LearningCompanionProviderRuntime,
  type ProviderRuntimeHealthStatus,
} from "./index.js";
import {
  checkProviderRuntimeHealth,
  describeProviderUnavailableForLearner,
  routeLearningRequirements,
  selectProviderRuntime,
  type ProviderSelectionConfig,
} from "./selection.js";

function runtime(
  runtimeId: string,
  overrides: Partial<Parameters<typeof createFakeProviderRuntime>[0]> = {},
): LearningCompanionProviderRuntime {
  return createFakeProviderRuntime({
    runtimeId,
    providerId: runtimeId,
    modelId: `${runtimeId}-model`,
    locality: "local",
    capabilities: ["coach"],
    ...overrides,
  });
}

const HINT_ONLY: ProviderSelectionConfig = {
  capability: "coach",
  preferredOrder: ["primary", "fallback"],
};

describe("selectProviderRuntime — table-driven", () => {
  const cases: Array<{
    name: string;
    runtimes: LearningCompanionProviderRuntime[];
    health: ReadonlyMap<string, ProviderRuntimeHealthStatus>;
    config: ProviderSelectionConfig;
    expect: { status: "selected"; runtimeId: string } | { status: "unavailable"; reason: string };
  }> = [
    {
      name: "preferred runtime available and capable -> selected",
      runtimes: [runtime("primary"), runtime("fallback")],
      health: new Map(),
      config: HINT_ONLY,
      expect: { status: "selected", runtimeId: "primary" },
    },
    {
      name: "preferred unavailable, fallback available -> selects fallback",
      runtimes: [runtime("primary"), runtime("fallback")],
      health: new Map([["primary", "unavailable"]]),
      config: HINT_ONLY,
      expect: { status: "selected", runtimeId: "fallback" },
    },
    {
      name: "preferred lacks the capability -> skipped in favor of fallback",
      runtimes: [runtime("primary", { capabilities: ["reflector"] }), runtime("fallback")],
      health: new Map(),
      config: HINT_ONLY,
      expect: { status: "selected", runtimeId: "fallback" },
    },
    {
      name: "no runtime supports the capability -> no-compatible-provider",
      runtimes: [
        runtime("primary", { capabilities: ["reflector"] }),
        runtime("fallback", { capabilities: ["reflector"] }),
      ],
      health: new Map(),
      config: HINT_ONLY,
      expect: { status: "unavailable", reason: "no-compatible-provider" },
    },
    {
      name: "all capable runtimes unavailable -> all-unavailable",
      runtimes: [runtime("primary"), runtime("fallback")],
      health: new Map([
        ["primary", "unavailable"],
        ["fallback", "unavailable"],
      ]),
      config: HINT_ONLY,
      expect: { status: "unavailable", reason: "all-unavailable" },
    },
    {
      name: "degraded (not unavailable) health still selects the runtime",
      runtimes: [runtime("primary")],
      health: new Map([["primary", "degraded"]]),
      config: { capability: "coach", preferredOrder: ["primary"] },
      expect: { status: "selected", runtimeId: "primary" },
    },
    {
      name: "offline forced -> unavailable regardless of healthy runtimes",
      runtimes: [runtime("primary"), runtime("fallback")],
      health: new Map(),
      config: { ...HINT_ONLY, offline: true },
      expect: { status: "unavailable", reason: "offline-mode" },
    },
    {
      name: "allowRemote:false excludes a remote-only preferred runtime",
      runtimes: [runtime("primary", { locality: "remote" }), runtime("fallback")],
      health: new Map(),
      config: { ...HINT_ONLY, allowRemote: false },
      expect: { status: "selected", runtimeId: "fallback" },
    },
    {
      name: "allowRemote:false with only remote runtimes -> all-unavailable",
      runtimes: [runtime("primary", { locality: "remote" })],
      health: new Map(),
      config: { capability: "coach", preferredOrder: ["primary"], allowRemote: false },
      expect: { status: "unavailable", reason: "all-unavailable" },
    },
    {
      name: "a runtime not present in the runtimes array is simply skipped",
      runtimes: [runtime("fallback")],
      health: new Map(),
      config: HINT_ONLY,
      expect: { status: "selected", runtimeId: "fallback" },
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const outcome = selectProviderRuntime(testCase.runtimes, testCase.health, testCase.config);
      expect(outcome.status).toBe(testCase.expect.status);
      if (outcome.status === "selected" && testCase.expect.status === "selected") {
        expect(outcome.descriptor.runtimeId).toBe(testCase.expect.runtimeId);
      }
      if (outcome.status === "unavailable" && testCase.expect.status === "unavailable") {
        expect(outcome.reason).toBe(testCase.expect.reason);
      }
    });
  }

  it("throws when preferredOrder is empty — selection must be explicit, never implicit", () => {
    expect(() =>
      selectProviderRuntime([runtime("primary")], new Map(), {
        capability: "coach",
        preferredOrder: [],
      }),
    ).toThrow(/preferredOrder/);
  });

  it("records an attempt entry for every runtime considered, in order", () => {
    const outcome = selectProviderRuntime(
      [runtime("primary", { capabilities: ["reflector"] }), runtime("fallback")],
      new Map(),
      HINT_ONLY,
    );
    expect(outcome.attempts.map((a) => a.runtimeId)).toEqual(["primary", "fallback"]);
    expect(outcome.attempts[0]?.outcome).toBe("capability-unsupported");
    expect(outcome.attempts[1]?.outcome).toBe("eligible");
  });
});

describe("checkProviderRuntimeHealth", () => {
  it("maps each runtime's reported health status", async () => {
    const health = await checkProviderRuntimeHealth([
      runtime("healthy", { health: "available" }),
      runtime("down", { health: "unavailable" }),
    ]);
    expect(health.get("healthy")).toBe("available");
    expect(health.get("down")).toBe("unavailable");
  });

  it("treats a throwing health check as unavailable rather than failing the probe", async () => {
    const throwing: LearningCompanionProviderRuntime = {
      ...runtime("flaky"),
      health() {
        throw new Error("boom");
      },
    };
    const health = await checkProviderRuntimeHealth([throwing]);
    expect(health.get("flaky")).toBe("unavailable");
  });
});

describe("describeProviderUnavailableForLearner", () => {
  it("never mentions a provider/runtime name (no technical jargon)", () => {
    const message = describeProviderUnavailableForLearner("all-unavailable", "en");
    expect(message.toLowerCase()).not.toContain("runtime");
    expect(message.toLowerCase()).not.toContain("provider");
    expect(message.toLowerCase()).not.toContain("ollama");
  });

  it("reassures the deterministic runtime still works for every reason", () => {
    for (const reason of ["offline-mode", "no-compatible-provider", "all-unavailable"] as const) {
      expect(describeProviderUnavailableForLearner(reason, "en")).toContain("build and run");
    }
  });

  it("localizes to Spanish", () => {
    expect(describeProviderUnavailableForLearner("offline-mode", "es")).toContain("apagada");
  });

  it("defaults to English for an unrecognized locale", () => {
    expect(describeProviderUnavailableForLearner("offline-mode", "fr")).toContain("turned off");
  });
});

describe("routeLearningRequirements", () => {
  function requirements(
    overrides: Partial<import("@agorix/learning-decision-plane").LearningRequirements> = {},
  ): import("@agorix/learning-decision-plane").LearningRequirements {
    return {
      schema: "agorix/learning-requirements/v1",
      generativeNeeded: "yes",
      clarificationNeeded: "no",
      assistanceLevel: 1,
      learningCapability: "coach",
      solutionAllowance: "none",
      runtimeEvidenceNeeded: "no",
      contextNeed: "bounded",
      reasoningTier: "local",
      provenance: {
        generativeNeeded: "fallback",
        clarificationNeeded: "fallback",
        assistanceLevel: "fallback",
        learningCapability: "system0",
        solutionAllowance: "system0",
        runtimeEvidenceNeeded: "system0",
        contextNeed: "fallback",
        reasoningTier: "fallback",
      },
      ...overrides,
    };
  }

  it("bypasses provider selection entirely when generative assistance is not needed", () => {
    const route = routeLearningRequirements(
      requirements({ generativeNeeded: "no", reasoningTier: "deterministic" }),
      [runtime("primary")],
      new Map(),
      ["primary"],
    );
    expect(route.status).toBe("deterministic");
    expect(route.providerSelectionBypassed).toBe(true);
    expect(route.providerRequestAllowed).toBe(false);
    expect(route.selection).toBeUndefined();
  });

  it("local reasoning cannot fall back to a remote runtime", () => {
    const route = routeLearningRequirements(
      requirements({ reasoningTier: "local" }),
      [runtime("remote", { locality: "remote" })],
      new Map(),
      ["remote"],
    );
    expect(route.status).toBe("unavailable");
    expect(route.providerRequestAllowed).toBe(false);
    expect(route.selection?.status).toBe("unavailable");
  });

  it("remote reasoning permits the existing ordered fallback selector", () => {
    const route = routeLearningRequirements(
      requirements({ reasoningTier: "remote" }),
      [
        runtime("primary", { locality: "remote", health: "unavailable" }),
        runtime("fallback", { locality: "remote" }),
      ],
      new Map([["primary", "unavailable"]]),
      ["primary", "fallback"],
    );
    expect(route.status).toBe("selected");
    expect(route.providerRequestAllowed).toBe(true);
    if (route.selection?.status === "selected") {
      expect(route.selection.descriptor.runtimeId).toBe("fallback");
    }
  });

  it("uses LearningRequirements capability instead of a caller-selected provider capability", () => {
    const route = routeLearningRequirements(
      requirements({ learningCapability: "debugger", reasoningTier: "local" }),
      [runtime("coach-only"), runtime("debugger", { capabilities: ["debugger"] })],
      new Map(),
      ["coach-only", "debugger"],
    );
    expect(route.status).toBe("selected");
    if (route.selection?.status === "selected") {
      expect(route.selection.descriptor.runtimeId).toBe("debugger");
    }
  });

  it("degrades safely when no compatible runtime exists", () => {
    const route = routeLearningRequirements(
      requirements({ learningCapability: "debugger" }),
      [runtime("coach-only")],
      new Map(),
      ["coach-only"],
    );
    expect(route.status).toBe("unavailable");
    expect(route.providerRequestAllowed).toBe(false);
    expect(route.reason).toBe("no-compatible-provider");
  });
});
