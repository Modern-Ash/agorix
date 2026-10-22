import { describe, expect, it } from "vitest";
import {
  readKidsEvidenceEvents,
  recordKidsPrediction,
  recordKidsProposalDecision,
  recordKidsReflection,
  recordKidsRevision,
  recordKidsScaffold,
} from "./kidsEvidence.js";

function session() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
}

describe("Kids learning evidence (issue #378)", () => {
  it("records a real prediction against the runtime outcome", () => {
    const storage = session();
    expect(recordKidsPrediction("yes", "success", storage)).toMatchObject({
      kind: "predictionMade",
      prediction: "reachGoal",
      matchedRuntimeOutcome: true,
    });
    expect(recordKidsPrediction("no", "wall", storage)).toMatchObject({
      kind: "predictionMade",
      prediction: "notReachGoal",
      matchedRuntimeOutcome: true,
      sequence: 2,
    });
    expect(recordKidsPrediction("dunno", "short", storage)).toBeNull();
    expect(readKidsEvidenceEvents(storage)).toHaveLength(2);
  });

  it("records a program edit only after a run, with an aggregate node count", () => {
    const storage = session();
    expect(recordKidsRevision("loopChange", 1, true, storage)).toMatchObject({
      kind: "programRevisedAfterExecution",
      revisionKind: "loopChange",
      changedNodeCount: 1,
      afterUnsuccessfulRun: true,
    });
  });

  it("records a proposal decision and the learner's inspection state", () => {
    const storage = session();
    expect(recordKidsProposalDecision("reject", false, true, storage)).toMatchObject({
      kind: "proposalDecided",
      decision: "reject",
      inspectedDiff: false,
      testedWithRuntime: true,
      challengedCompanion: true,
    });
  });

  it("records hint level and reflection without child text or timestamps", () => {
    const storage = session();
    expect(recordKidsScaffold("hint", 2, storage)).toMatchObject({
      kind: "scaffoldDelivered",
      level: 2,
      answeredByLearner: false,
    });
    expect(recordKidsReflection("decision", storage)).toMatchObject({
      kind: "reflectionRecorded",
      storage: "localEphemeral",
      contentRetained: false,
    });
    expect(readKidsEvidenceEvents(storage)).toHaveLength(2);
    const raw = [...storage.values.values()].join(" ");
    expect(raw).not.toMatch(/timestamp|freeText|transcript|feeling/);
  });

  it("marks a revealed solution as delegated assistance", () => {
    expect(recordKidsScaffold("solution", 5, session())).toMatchObject({
      assistanceLevel: "delegated",
    });
  });
});
