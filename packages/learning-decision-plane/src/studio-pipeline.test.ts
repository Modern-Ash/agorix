import { describe, expect, it } from "vitest";
import {
  createLayaLearningProvider,
  createStudioPipeline,
  createStudioSignal,
  describeStudioDegradeForLearner,
  type LearningDecisionState,
  type StudioPipelineInput,
  type StudioRouter,
} from "./index.js";

const BASE: LearningDecisionState = {
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

function input(over: Partial<LearningDecisionState> = {}, hash = "h1"): StudioPipelineInput {
  const signal = createStudioSignal("runtime-error", 1, { code: "E_DIV" });
  if (signal === undefined) throw new Error("signal");
  return { signal, state: { ...BASE, ...over }, programHash: hash };
}

function laya(answers: { id: string; value: string | number; confidence: number }[]) {
  const calls = { n: 0 };
  const provider = createLayaLearningProvider({
    async decideMany() {
      calls.n += 1;
      return answers;
    },
  });
  return { provider, calls };
}

const localRouter: StudioRouter = (req) =>
  req.generativeNeeded === "no" || req.reasoningTier === "deterministic"
    ? { status: "deterministic", reason: "deterministic", providerRequestAllowed: false }
    : { status: "selected", reason: "selected", providerRequestAllowed: true, locality: "local" };

const YES = [
  { id: "generativeNeeded", value: "yes", confidence: 0.99 },
  { id: "reasoningTier", value: "local", confidence: 0.99 },
];

describe("studio pipeline", () => {
  it("deterministic route makes zero LAYA and zero provider calls", async () => {
    const { provider, calls } = laya(YES);
    const pipeline = createStudioPipeline({ system1: provider, route: localRouter });
    const d = await pipeline.decide(input({ capability: "challenger" }));
    expect(calls.n).toBe(0);
    expect(d.providerRequestAllowed).toBe(false);
    expect(d.source).toBe("system0");
    expect(d.cost).toEqual({ estimatedInputTokens: 0, estimatedOutputTokens: 0 });
    expect(d.telemetry.providerLocality).toBe("none");
  });

  it("LAYA decision routes to a local provider", async () => {
    const { provider, calls } = laya(YES);
    const pipeline = createStudioPipeline({ system1: provider, route: localRouter });
    const d = await pipeline.decide(input());
    expect(calls.n).toBe(1);
    expect(d.source).toBe("system1");
    expect(d.providerRequestAllowed).toBe(true);
    expect(d.telemetry.providerLocality).toBe("local");
    expect(d.cost.estimatedInputTokens).toBeGreaterThan(0);
  });

  it("LAYA abstain falls back to System 0 defaults", async () => {
    const { provider } = laya([{ id: "generativeNeeded", value: "no", confidence: 0.2 }]);
    const d = await createStudioPipeline({ system1: provider, route: localRouter }).decide(input());
    expect(d.source).toBe("fallback");
    expect(d.requirements.generativeNeeded).toBe("yes");
    expect(d.requirements.reasoningTier).toBe("local");
  });

  it("LAYA unavailable falls back and is not cached", async () => {
    let n = 0;
    const provider = createLayaLearningProvider({
      async decideMany() {
        n += 1;
        throw new Error("down");
      },
    });
    const pipeline = createStudioPipeline({ system1: provider, route: localRouter });
    expect((await pipeline.decide(input())).source).toBe("fallback");
    await pipeline.decide(input());
    expect(n).toBe(2);
  });

  it("works with no LAYA and no router (provider disabled)", async () => {
    const d = await createStudioPipeline().decide(input());
    expect(d.source).toBe("fallback");
    expect(d.providerRequestAllowed).toBe(false);
  });

  it("cache hit avoids repeat LAYA calls; different program hash misses", async () => {
    const { provider, calls } = laya(YES);
    const pipeline = createStudioPipeline({ system1: provider, route: localRouter });
    const a = await pipeline.decide(input());
    const b = await pipeline.decide(input());
    expect(calls.n).toBe(1);
    expect(a.cacheHit).toBe(false);
    expect(b.cacheHit).toBe(true);
    expect(b.source).toBe("system1");
    await pipeline.decide(input({}, "h2"));
    expect(calls.n).toBe(2);
    await pipeline.decide(input({ scaffoldLevel: 3 }));
    expect(calls.n).toBe(3);
  });

  it("batches concurrent identical decisions into one LAYA call, one questions batch", async () => {
    const seen: number[] = [];
    const provider = createLayaLearningProvider({
      async decideMany(i) {
        seen.push(i.questions.length);
        return [];
      },
    });
    const pipeline = createStudioPipeline({ system1: provider });
    const out = await pipeline.decideBatch([input(), input(), input()]);
    expect(out).toHaveLength(3);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeGreaterThan(1);
  });

  it("request budget cap degrades to deterministic with a plain notice", async () => {
    const { provider } = laya(YES);
    const pipeline = createStudioPipeline({
      system1: provider,
      route: localRouter,
      budget: { maxRequests: 1 },
    });
    expect((await pipeline.decide(input())).providerRequestAllowed).toBe(true);
    const d = await pipeline.decide(input());
    expect(d.providerRequestAllowed).toBe(false);
    expect(d.degradedReason).toBe("budget-requests");
    expect(d.requirements.reasoningTier).toBe("deterministic");
    expect(d.learnerNotice).toBe(describeStudioDegradeForLearner("budget-requests"));
    expect(d.learnerNotice).not.toMatch(/token|provider|model|LAYA/i);
    expect(pipeline.budgetRemaining().requests).toBe(0);
  });

  it("token budget cap degrades", async () => {
    const { provider } = laya(YES);
    const pipeline = createStudioPipeline({
      system1: provider,
      route: localRouter,
      budget: { maxTokens: 100 },
    });
    const d = await pipeline.decide(input());
    expect(d.degradedReason).toBe("budget-tokens");
    expect(d.providerRequestAllowed).toBe(false);
  });

  it("unavailable route degrades without calling a provider", async () => {
    const { provider } = laya(YES);
    const router: StudioRouter = () => ({
      status: "unavailable",
      reason: "all-unavailable",
      providerRequestAllowed: false,
    });
    const d = await createStudioPipeline({ system1: provider, route: router }).decide(input());
    expect(d.degradedReason).toBe("route-unavailable");
    expect(d.learnerNotice).toContain("build and run your program");
  });

  it("aggregates telemetry per session and exposes diagnostics", async () => {
    const { provider } = laya(YES);
    const seen: unknown[] = [];
    const pipeline = createStudioPipeline({
      system1: provider,
      route: localRouter,
      onTelemetry: (e) => seen.push(e),
    });
    await pipeline.decide(input());
    await pipeline.decide(input());
    await pipeline.decide(input({ capability: "challenger" }));
    const s = pipeline.summary();
    expect(s.decisions).toBe(3);
    expect(s.cacheHits).toBe(1);
    expect(s.providerRequests).toBe(2);
    expect(s.bySource.system0).toBe(1);
    expect(s.byLocality.local).toBe(2);
    expect(seen).toHaveLength(3);
    const diag = pipeline.diagnostics();
    expect(diag?.advisory).toBe(true);
    expect(diag?.route.status).toBe("deterministic");
    expect(diag?.session.decisions).toBe(3);
  });

  it("telemetry and diagnostics contain no free text, names, paths or account ids", async () => {
    const { provider } = laya(YES);
    const pipeline = createStudioPipeline({ system1: provider, route: localRouter });
    const signal = createStudioSignal("runtime-error", 1, {
      code: "E_DIV",
      nodeIds: ["secret_node"],
      message: "Ana at /home/ana/x.agorix acct-77",
    });
    if (signal === undefined) throw new Error("signal");
    const d = await pipeline.decide({
      signal,
      state: BASE,
      programHash: "hash-with-secret",
    });
    const blob = JSON.stringify([d.telemetry, d.diagnostics, pipeline.events()]);
    expect(blob).not.toMatch(/Ana|\/home|acct-77|secret_node|hash-with-secret|E_DIV/);
    const allowed = new Set([
      "schema",
      "signalKind",
      "decisionSource",
      "tier",
      "generativeNeeded",
      "cacheHit",
      "estimatedInputTokens",
      "estimatedOutputTokens",
      "latencyMs",
      "providerLocality",
      "degradedReason",
    ]);
    for (const key of Object.keys(d.telemetry)) expect(allowed.has(key)).toBe(true);
  });

  it("records latency from the injected clock", async () => {
    let t = 0;
    const pipeline = createStudioPipeline({ now: () => (t += 5) });
    expect((await pipeline.decide(input())).telemetry.latencyMs).toBe(5);
  });
});
