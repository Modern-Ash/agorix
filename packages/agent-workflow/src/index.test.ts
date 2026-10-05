import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGREEMENTS,
  advance,
  canOffer,
  createWorkflow,
  effectiveAssistance,
  nextAgentAction,
  nextAssistanceLevel,
  type WorkflowEvent,
  type WorkflowState,
} from "./index.js";

function run(state: WorkflowState, events: WorkflowEvent[]): WorkflowState {
  return events.reduce((s, e) => {
    const r = advance(s, e);
    if (!r.ok) throw new Error(`rejected ${e.type} at ${s.stage}`);
    return r.state;
  }, state);
}

describe("agent-workflow", () => {
  it("walks the loop to done with runtime-only completion", () => {
    const end = run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
      { type: "proposalRequested" },
      { type: "proposalDecided", decision: "accepted" },
      { type: "predictionMade" },
      { type: "runObserved", completed: true },
      { type: "compared" },
      { type: "explained" },
    ]);
    expect(end).toMatchObject({ stage: "done", completed: true, explained: true });
  });

  it("keeps the proposal stage after rejection and rejects out-of-order events", () => {
    const atProposal = run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 2 },
    ]);
    const rejected = run(atProposal, [{ type: "proposalDecided", decision: "rejected" }]);
    expect(rejected).toMatchObject({ stage: "proposal", rejections: 1 });
    expect(advance(atProposal, { type: "runObserved", completed: true }).ok).toBe(false);
    expect(advance(atProposal, { type: "predictionMade" }).ok).toBe(false);
    expect(advance(createWorkflow("supervised"), { type: "planAccepted", taskCount: 1 }).ok).toBe(
      false,
    );
  });

  it("only auto-requests proposals in bounded mode", () => {
    const events: WorkflowEvent[] = [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
    ];
    expect(nextAgentAction(run(createWorkflow("supervised"), events))).toBe(
      "await-learner-request",
    );
    expect(nextAgentAction(run(createWorkflow("bounded"), events))).toBe("request-proposal");
  });

  it("gates level 5 and honors the ceiling and AI-off", () => {
    expect(nextAssistanceLevel(4, { repeatedFailures: 9, explicitStrongerHelp: false })).toBe(4);
    expect(nextAssistanceLevel(4, { repeatedFailures: 2, explicitStrongerHelp: true })).toBe(5);
    expect(effectiveAssistance({ ...DEFAULT_AGREEMENTS, assistanceCeiling: 2 }, 5)).toBe(2);
    const off = { ...DEFAULT_AGREEMENTS, aiEnabled: false };
    expect(effectiveAssistance(off, 5)).toBe(0);
    expect(canOffer(off, "stalled")).toBe(false);
  });
});

describe("pre-accept prediction", () => {
  const atProposal = () =>
    run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 2 },
      { type: "proposalRequested" },
    ]);

  it("lets accept skip the predict stage once predicted, and resets it on reject", () => {
    const predicted = run(atProposal(), [
      { type: "prePredictionMade" },
      { type: "proposalDecided", decision: "accepted" },
    ]);
    expect(predicted.stage).toBe("run");
    expect(predicted.predicted).toBe(true);
    const rejected = run(atProposal(), [
      { type: "prePredictionMade" },
      { type: "proposalDecided", decision: "rejected" },
    ]);
    expect(rejected.predicted).toBe(false);
    expect(advance(createWorkflow("supervised"), { type: "prePredictionMade" }).ok).toBe(false);
    expect(
      advance(run(atProposal(), [{ type: "prePredictionMade" }]), { type: "prePredictionMade" }).ok,
    ).toBe(false);
  });

  it("does not carry a prediction into the next task", () => {
    const next = run(atProposal(), [
      { type: "prePredictionMade" },
      { type: "proposalDecided", decision: "accepted" },
      { type: "runObserved", completed: true },
      { type: "compared" },
      { type: "explained" },
    ]);
    expect(next.stage).toBe("proposal");
    expect(next.predicted).toBe(false);
  });
});
