import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AGREEMENTS, type AgentEvent, type AgentTaskId } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION as schema, type UiMessage } from "@agorix/studio-protocol";
import { createAgentHost, type AgentHost, type AgentPort } from "./agentHost.js";

function setup(options: { tasks?: AgentTaskId[]; reached?: boolean; stale?: boolean } = {}) {
  const state = {
    hash: "h0",
    applied: 0,
    rejected: 0,
    events: [] as AgentEvent[],
    hostRef: undefined as AgentHost | undefined,
  };
  const port: AgentPort = {
    availableTasks: () => options.tasks ?? ["first-step"],
    proposeFor: (task) => ({
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
    run: () => ({ reachedGoal: options.reached ?? false, stepsUsed: 4 }),
    programHash: () => state.hash,
    record: (event) => state.events.push(event),
  };
  const host = createAgentHost(port);
  state.hostRef = host;
  const send = async (message: Record<string, unknown>) =>
    host.handle({ schema, ...message } as UiMessage);
  return { host, state, send };
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
