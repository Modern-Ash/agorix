import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AGREEMENTS, type AgentEvent, type AgentTaskId } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION as schema, type UiMessage } from "@agorix/studio-protocol";
import {
  createAgentHost,
  type AgentHost,
  type AgentIntentPlanResult,
  type AgentPort,
} from "./agentHost.js";

function setup(
  options: {
    tasks?: AgentTaskId[];
    reached?: boolean;
    stale?: boolean;
    planIntent?: AgentPort["planIntent"];
  } = {},
) {
  const state = {
    hash: "h0",
    applied: 0,
    rejected: 0,
    events: [] as AgentEvent[],
    hostRef: undefined as AgentHost | undefined,
  };
  const port: AgentPort = {
    availableTasks: () => options.tasks ?? ["first-step"],
    ...(options.planIntent === undefined ? {} : { planIntent: options.planIntent }),
    proposeFor: async (task) => ({
      proposalId: task,
      purpose: "p",
      rationale: "r",
      changes: [{ kind: "added", afterText: "move(10)" }],
    }),
    applyPending: async () => {
      if (options.stale === true) return "stale";
      state.applied += 1;
      state.hash = "h1";
      state.hostRef?.onProgramChanged();
      return "applied";
    },
    rejectPending: () => {
      state.rejected += 1;
    },
    chooseAlternative: () => undefined,
    previewSelection: () => ({ ok: false, reason: "EMPTY" }),
    applySelection: async () => "empty",
    run: () => ({ reachedGoal: options.reached ?? false, stepsUsed: 4 }),
    programHash: () => state.hash,
    record: (event) => state.events.push(event),
  };
  const host = createAgentHost(port);
  state.hostRef = host;
  const send = async (message: Record<string, unknown>) =>
    host.handle({ schema, ...message } as UiMessage);
  return { host, state, send, port };
}

const types = (messages: Array<{ type: string }> | undefined) =>
  (messages ?? []).map((m) => m.type);

describe("agentHost", () => {
  it("runs the whole supervised loop with learner decisions", async () => {
    const { state, send } = setup({ reached: true });
    await send({ type: "stateIntent", text: "make it move" });
    await send({ type: "acceptPlan" });
    expect(types(await send({ type: "requestProposal" }))).toEqual(["workflow", "proposal"]);
    expect(state.applied).toBe(0);
    expect(
      types(await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" })),
    ).toEqual(["proposalCleared", "workflow", "prediction"]);
    await send({ type: "predict", answer: "yes" });
    const run = await send({ type: "run" });
    expect(run?.[1]).toMatchObject({ type: "comparison", result: "matched", reachedGoal: true });
    await send({ type: "continue" });
    await send({ type: "explain", concept: "sequence" });
    expect(state.applied).toBe(1);
    expect(state.events.map((e) => e.type)).toEqual([
      "proposalRequested",
      "proposalAccepted",
      "predictionMatched",
      "explainCompleted",
    ]);
  });

  it("bounded mode requests automatically but still waits for the decision", async () => {
    const { state, send } = setup();
    await send({
      type: "agreementsChanged",
      agreements: { ...DEFAULT_AGREEMENTS, mode: "bounded" },
    });
    await send({ type: "stateIntent", text: "x" });
    expect(types(await send({ type: "acceptPlan" }))).toEqual(["workflow", "workflow", "proposal"]);
    expect(state.applied).toBe(0);
  });

  it("rejecting leaves things unapplied and allows another request", async () => {
    const { state, send } = setup();
    await send({ type: "stateIntent", text: "x" });
    await send({ type: "acceptPlan" });
    for (let i = 0; i < 2; i += 1) {
      await send({ type: "requestProposal" });
      await send({ type: "decideProposal", proposalId: "first-step", decision: "rejected" });
    }
    expect(state.applied).toBe(0);
    expect(types(await send({ type: "requestProposal" }))).toContain("proposal");
  });

  it("never applies on wrong id, wrong stage, double accept or modify", async () => {
    const { state, send } = setup();
    expect(
      await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" }),
    ).toEqual([]);
    await send({ type: "stateIntent", text: "x" });
    await send({ type: "acceptPlan" });
    await send({ type: "requestProposal" });
    expect(
      await send({ type: "decideProposal", proposalId: "other", decision: "accepted" }),
    ).toEqual([]);
    expect(
      await send({ type: "decideProposal", proposalId: "first-step", decision: "modified" }),
    ).toEqual([]);
    await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" });
    expect(
      await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" }),
    ).toEqual([]);
    expect(state.applied).toBe(1);
  });

  it("drops stale proposals without advancing", async () => {
    const { state, send } = setup({ stale: true });
    await send({ type: "stateIntent", text: "x" });
    await send({ type: "acceptPlan" });
    await send({ type: "requestProposal" });
    const out = await send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "accepted",
    });
    expect(out?.[0]).toMatchObject({ type: "error", code: "STALE_PROPOSAL" });
    expect(types(out)).not.toContain("prediction");
    expect(state.applied).toBe(0);
  });

  it("lets prediction and explanation be skipped and resets on outside edits", async () => {
    const { state, host, send } = setup();
    await send({ type: "stateIntent", text: "x" });
    await send({ type: "acceptPlan" });
    await send({ type: "requestProposal" });
    await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" });
    await send({ type: "skipPrediction" });
    expect((await send({ type: "run" }))?.[1]).toMatchObject({ result: "skipped" });
    await send({ type: "continue" });
    await send({ type: "skipExplain" });
    expect(state.events.at(-1)?.type).toBe("explainSkipped");
    await send({ type: "stateIntent", text: "x" });
    await send({ type: "acceptPlan" });
    await send({ type: "requestProposal" });
    await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" });
    state.hash = "outside";
    const out = host.onProgramChanged();
    expect(out[0]).toMatchObject({ type: "workflow", state: { stage: "intent" } });
  });

  it("answers unavailable when the agent is off and ignores workbench messages", async () => {
    const { send } = setup();
    await send({
      type: "agreementsChanged",
      agreements: { ...DEFAULT_AGREEMENTS, aiEnabled: false },
    });
    expect(await send({ type: "stateIntent", text: "x" })).toEqual([
      { schema, type: "agentUnavailable" },
    ]);
    expect(await send({ type: "ready" })).toBeUndefined();
    const empty = setup({ tasks: [] });
    const plan = await empty.send({ type: "stateIntent", text: "x" });
    expect(plan?.[1]).toMatchObject({ type: "plan", tasks: [] });
    expect(await empty.send({ type: "acceptPlan" })).toEqual([]);
    void vi;
  });
});

describe("agentHost clarification and stale plans", () => {
  const both: AgentTaskId[] = ["first-step", "repeat-pattern"];

  it("asks one question for an unclear intent and pins the plan to the answer", async () => {
    const { send, host } = setup({ tasks: both });
    const out = await send({ type: "stateIntent", text: "hola" });
    expect(types(out)).toEqual(["workflow", "clarify"]);
    expect(types(host.snapshot())).toContain("clarify");
    const answered = await send({ type: "answerClarification", taskId: "repeat-pattern" });
    expect(types(answered)).toEqual(["workflow", "plan"]);
    expect(answered?.[1]).toMatchObject({ tasks: [{ id: "repeat-pattern" }] });
    expect(await send({ type: "answerClarification", taskId: "first-step" })).toEqual([]);
  });

  it("does not ask when the intent is clear or there is a single task", async () => {
    const clear = setup({ tasks: both });
    expect(types(await clear.send({ type: "stateIntent", text: "repite 3 veces" }))).toEqual([
      "workflow",
      "plan",
    ]);
    const single = setup({ tasks: ["first-step"] });
    expect(types(await single.send({ type: "stateIntent", text: "hola" }))).toEqual([
      "workflow",
      "plan",
    ]);
  });

  it("uses a structured intent planner before the keyword fallback", async () => {
    const planned: AgentIntentPlanResult = {
      kind: "plan",
      tasks: [{ id: "repeat-pattern", title: "Write the repeated steps once with repeat" }],
      baseHash: "h0",
    };
    const planIntent = vi.fn(() => planned);
    const { send } = setup({ tasks: ["first-step"], planIntent });
    const out = await send({ type: "stateIntent", text: "make it move" });
    expect(planIntent).toHaveBeenCalledWith("make it move");
    expect(out?.[1]).toMatchObject({ type: "plan", tasks: planned.tasks });
  });

  it("refuses an answer for a task that was not offered", async () => {
    const { send } = setup({ tasks: both });
    await send({ type: "stateIntent", text: "hola" });
    const out = await send({ type: "answerClarification", taskId: "first-step" });
    expect(types(out)).toEqual(["workflow", "plan"]);
    const { send: other } = setup({ tasks: ["first-step"] });
    await other({ type: "stateIntent", text: "hola" });
    expect(await other({ type: "answerClarification", taskId: "repeat-pattern" })).toEqual([]);
  });

  it("drops a plan whose base program changed before it was accepted", async () => {
    const { send, state } = setup();
    await send({ type: "stateIntent", text: "make it move" });
    state.hash = "h-other";
    const out = await send({ type: "acceptPlan" });
    expect(out?.[0]).toEqual({ schema, type: "error", code: "STALE_PLAN" });
    expect(types(out)).toEqual(["error", "workflow"]);
    expect(await send({ type: "requestProposal" })).toEqual([]);
  });

  it("drops a clarification answered after the program changed", async () => {
    const { send, state } = setup({ tasks: both });
    await send({ type: "stateIntent", text: "hola" });
    state.hash = "h-other";
    const out = await send({ type: "answerClarification", taskId: "first-step" });
    expect(out?.[0]).toEqual({ schema, type: "error", code: "STALE_PLAN" });
  });

  it("resets a pending plan when the program changes under it", async () => {
    const { send, host, state } = setup();
    await send({ type: "stateIntent", text: "make it move" });
    state.hash = "h-other";
    expect(types(host.onProgramChanged())).toEqual(["error", "workflow"]);
  });
});

describe("agentHost prediction gating", () => {
  const gated = { ...DEFAULT_AGREEMENTS, requirePredictionBeforeAccept: true };

  async function toProposal(options: Parameters<typeof setup>[0] = {}) {
    const ctx = setup(options);
    await ctx.send({ type: "agreementsChanged", agreements: gated });
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    return ctx;
  }

  it("sends the prediction with the proposal and blocks Accept until predicted", async () => {
    const { send, state } = await toProposal({ reached: true });
    expect(types(await send({ type: "requestProposal" }))).toEqual([
      "workflow",
      "proposal",
      "prediction",
    ]);
    const blocked = await send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "accepted",
    });
    expect(blocked).toEqual([{ schema, type: "error", code: "PREDICTION_REQUIRED" }]);
    expect(state.applied).toBe(0);
    expect(await send({ type: "skipPrediction" })).toEqual([]);
    expect(types(await send({ type: "predict", answer: "yes" }))).toEqual(["workflow"]);
    expect(
      types(await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" })),
    ).toEqual(["proposalCleared", "workflow"]);
    expect(state.applied).toBe(1);
    const run = await send({ type: "run" });
    expect(run?.[1]).toMatchObject({ type: "comparison", predicted: "yes", result: "matched" });
  });

  it("lets the learner reject without predicting, and a rejection clears the prediction", async () => {
    const { send, state } = await toProposal();
    await send({ type: "requestProposal" });
    await send({ type: "predict", answer: "no" });
    await send({ type: "decideProposal", proposalId: "first-step", decision: "rejected" });
    expect(state.rejected).toBe(1);
    await send({ type: "requestProposal" });
    expect(
      await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" }),
    ).toEqual([{ schema, type: "error", code: "PREDICTION_REQUIRED" }]);
  });

  it("keeps the current predict-after-accept flow when the flag is off", async () => {
    const { send } = setup();
    await send({ type: "stateIntent", text: "make it move" });
    await send({ type: "acceptPlan" });
    expect(types(await send({ type: "requestProposal" }))).toEqual(["workflow", "proposal"]);
    expect(await send({ type: "predict", answer: "yes" })).toEqual([]);
    expect(
      types(await send({ type: "decideProposal", proposalId: "first-step", decision: "accepted" })),
    ).toEqual(["proposalCleared", "workflow", "prediction"]);
  });
});

describe("agentHost per-operation decisions and alternatives", () => {
  const selection = { include: [0], overrides: [{ index: 0, value: 7 }] };
  const altView = {
    proposalId: "alt",
    purpose: "p2",
    rationale: "r2",
    changes: [],
  };

  async function toProposal() {
    const ctx = setup();
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    await ctx.send({ type: "requestProposal" });
    return ctx;
  }

  it("switches to a chosen alternative without applying anything", async () => {
    const ctx = await toProposal();
    ctx.port.chooseAlternative = (id) => (id === "alt" ? altView : undefined);
    const out = await ctx.send({ type: "chooseAlternative", proposalId: "alt" });
    expect(out).toEqual([expect.objectContaining({ type: "proposal", proposalId: "alt" })]);
    expect(await ctx.send({ type: "chooseAlternative", proposalId: "nope" })).toEqual([]);
    expect(ctx.state.applied).toBe(0);
    ctx.port.applySelection = vi.fn(async () => "applied" as const);
    await ctx.send({ type: "decideProposal", proposalId: "alt", decision: "accepted" });
    expect(ctx.state.applied).toBe(1);
  });

  it("ignores alternatives outside the proposal stage", async () => {
    const ctx = setup();
    ctx.port.chooseAlternative = () => altView;
    expect(await ctx.send({ type: "chooseAlternative", proposalId: "alt" })).toEqual([]);
  });

  it("answers previewSelection only for the pending proposal", async () => {
    const ctx = await toProposal();
    const evidence = { stepsUsed: 3, reachedGoal: false, outcome: "completed" } as const;
    ctx.port.previewSelection = () => ({ ok: true, evidence });
    expect(
      await ctx.send({ type: "previewSelection", proposalId: "first-step", selection }),
    ).toEqual([
      {
        schema,
        type: "selectionEvidence",
        proposalId: "first-step",
        result: { ok: true, evidence },
      },
    ]);
    expect(await ctx.send({ type: "previewSelection", proposalId: "other", selection })).toEqual(
      [],
    );
  });

  it("applies a selected subset through applySelection and moves on to predicting", async () => {
    const ctx = await toProposal();
    const applySelection = vi.fn(async () => "applied" as const);
    ctx.port.applySelection = applySelection;
    const out = await ctx.send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "modified",
      selection,
    });
    expect(applySelection).toHaveBeenCalledWith(selection);
    expect(types(out)).toEqual(["proposalCleared", "workflow", "prediction"]);
    expect(ctx.state.events.map((e) => e.type)).toContain("proposalModified");
  });

  it("treats an empty selection as a rejection with zero commits", async () => {
    const ctx = await toProposal();
    const applySelection = vi.fn(async () => "applied" as const);
    ctx.port.applySelection = applySelection;
    const out = await ctx.send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "modified",
      selection: { include: [] },
    });
    expect(types(out)).toEqual(["proposalCleared", "workflow"]);
    expect(applySelection).not.toHaveBeenCalled();
    expect(ctx.state.rejected).toBe(1);
    expect(ctx.state.applied).toBe(0);
  });

  it("keeps the proposal pending when the selection is invalid, and drops it when stale", async () => {
    const ctx = await toProposal();
    ctx.port.applySelection = async () => "invalid";
    const invalid = await ctx.send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "modified",
      selection,
    });
    expect(invalid).toEqual([
      {
        schema,
        type: "selectionEvidence",
        proposalId: "first-step",
        result: { ok: false, reason: "INVALID" },
      },
    ]);
    expect(types(ctx.host.snapshot())).toContain("proposal");
    ctx.port.applySelection = async () => "stale";
    const stale = await ctx.send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "modified",
      selection,
    });
    expect(stale?.[0]).toEqual({ schema, type: "error", code: "STALE_PROPOSAL" });
  });

  it("applies the prediction gate to a selected subset too", async () => {
    const ctx = setup();
    await ctx.send({
      type: "agreementsChanged",
      agreements: { ...DEFAULT_AGREEMENTS, requirePredictionBeforeAccept: true },
    });
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    await ctx.send({ type: "requestProposal" });
    const applySelection = vi.fn(async () => "applied" as const);
    ctx.port.applySelection = applySelection;
    const out = await ctx.send({
      type: "decideProposal",
      proposalId: "first-step",
      decision: "modified",
      selection,
    });
    expect(out).toEqual([{ schema, type: "error", code: "PREDICTION_REQUIRED" }]);
    expect(applySelection).not.toHaveBeenCalled();
  });
});

describe("agentHost asynchronous suggestions", () => {
  it("discards a suggestion that arrives after the loop was reset", async () => {
    const ctx = setup();
    let release!: (view: Awaited<ReturnType<AgentPort["proposeFor"]>>) => void;
    ctx.port.proposeFor = () => new Promise((resolve) => (release = resolve));
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    const pendingRequest = ctx.send({ type: "requestProposal" });
    await ctx.send({ type: "agreementsChanged", agreements: DEFAULT_AGREEMENTS });
    release({ proposalId: "late", purpose: "p", rationale: "r", changes: [] });
    expect(await pendingRequest).toEqual([]);
    expect(ctx.state.rejected).toBe(1);
    expect(types(ctx.host.snapshot())).not.toContain("proposal");
  });

  it("ignores a second request while one is in flight", async () => {
    const ctx = setup();
    let release!: (view: Awaited<ReturnType<AgentPort["proposeFor"]>>) => void;
    const calls = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<AgentPort["proposeFor"]>>>((resolve) => (release = resolve)),
    );
    ctx.port.proposeFor = calls;
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    const first = ctx.send({ type: "requestProposal" });
    expect(await ctx.send({ type: "requestProposal" })).toEqual([]);
    release({ proposalId: "p", purpose: "p", rationale: "r", changes: [], origin: "provider" });
    expect(types(await first)).toEqual(["workflow", "proposal"]);
    expect(calls).toHaveBeenCalledOnce();
  });

  it("forwards origin and notice to the UI", async () => {
    const ctx = setup();
    ctx.port.proposeFor = async () => ({
      proposalId: "p",
      purpose: "p",
      rationale: "r",
      changes: [],
      origin: "built-in",
      notice: "AI help isn't available right now.",
    });
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    const out = await ctx.send({ type: "requestProposal" });
    expect(out?.[1]).toMatchObject({
      type: "proposal",
      origin: "built-in",
      notice: "AI help isn't available right now.",
    });
  });
});

describe("agentHost evidence events", () => {
  it("records modified decisions, alternative choices and the proposal origin", async () => {
    const ctx = setup();
    const view = {
      proposalId: "alt",
      purpose: "p",
      rationale: "r",
      changes: [],
      origin: "provider" as const,
    };
    ctx.port.proposeFor = async () => ({ ...view, proposalId: "first-step" });
    ctx.port.chooseAlternative = () => view;
    ctx.port.applySelection = async () => "applied";
    await ctx.send({ type: "stateIntent", text: "make it move" });
    await ctx.send({ type: "acceptPlan" });
    await ctx.send({ type: "requestProposal" });
    await ctx.send({ type: "chooseAlternative", proposalId: "alt" });
    await ctx.send({
      type: "decideProposal",
      proposalId: "alt",
      decision: "modified",
      selection: { include: [0] },
    });
    expect(ctx.state.events).toEqual([
      expect.objectContaining({ type: "proposalRequested", origin: "provider" }),
      expect.objectContaining({ type: "alternativeChosen", origin: "provider" }),
      expect.objectContaining({ type: "proposalModified", origin: "provider" }),
    ]);
    expect(JSON.stringify(ctx.state.events)).not.toMatch(/purpose|rationale|make it move/);
  });
});
