/**
 * Synthetic mission assessment report (issue #102 evidence deliverable).
 *
 * Synthetic data only: no real learner, no real conversation, no real identifiers.
 */

import { assessMission, understandingScore } from "./assessment.js";
import { EVIDENCE_EVENT_SCHEMA_VERSION, type LearningEvidenceEvent } from "./evidence.js";

const event = <T extends LearningEvidenceEvent>(value: T): T => value;

/**
 * One attempt at the first mission. The learner predicts, inspects and modifies a
 * companion proposal, then repairs a failing run from runtime evidence.
 */
export const SYNTHETIC_FIRST_MISSION_ATTEMPT: readonly LearningEvidenceEvent[] = [
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-1",
    sequence: 1,
    kind: "scaffoldDelivered",
    scaffoldKind: "clarifyingQuestion",
    level: 1,
    answeredByLearner: true,
    assistanceLevel: "hinted",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-2",
    sequence: 2,
    kind: "reflectionRecorded",
    reflectionKind: "intent",
    storage: "localEphemeral",
    contentRetained: false,
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-3",
    sequence: 3,
    kind: "codeViewUsed",
    view: "agorixCode",
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-4",
    sequence: 4,
    kind: "predictionMade",
    prediction: "reachGoal",
    matchedRuntimeOutcome: false,
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-5",
    sequence: 5,
    kind: "missionCompleted",
    runtimeOutcome: "incomplete",
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-6",
    sequence: 6,
    kind: "programRevisedAfterExecution",
    revisionKind: "sequenceChange",
    changedNodeCount: 1,
    afterUnsuccessfulRun: true,
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-7",
    sequence: 7,
    kind: "predictionMade",
    prediction: "reachGoal",
    matchedRuntimeOutcome: false,
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-8",
    sequence: 8,
    kind: "debuggingSucceeded",
    attemptsBeforeSuccess: 2,
    usedRuntimeEvidence: true,
    assistanceLevel: "independent",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ev-9",
    sequence: 9,
    kind: "missionCompleted",
    runtimeOutcome: "completed",
    assistanceLevel: "independent",
  }),
];

export const SYNTHETIC_ASSISTED_ATTEMPT: readonly LearningEvidenceEvent[] = [
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ai-1",
    sequence: 1,
    kind: "scaffoldDelivered",
    scaffoldKind: "solution",
    level: 5,
    answeredByLearner: false,
    assistanceLevel: "delegated",
  }),
  event({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: "ai-2",
    sequence: 2,
    kind: "missionCompleted",
    runtimeOutcome: "completed",
    assistanceLevel: "delegated",
  }),
];

export const SYNTHETIC_REPORTS = {
  learnerAttempt: assessMission({
    missionId: "first-mission.reach-goal",
    missionVersion: 1,
    events: SYNTHETIC_FIRST_MISSION_ATTEMPT,
  }),
  assistedAttempt: assessMission({
    missionId: "first-mission.reach-goal",
    missionVersion: 1,
    events: SYNTHETIC_ASSISTED_ATTEMPT,
  }),
} as const;

export const SYNTHETIC_SCORES = {
  learnerAttempt: understandingScore(SYNTHETIC_REPORTS.learnerAttempt),
  assistedAttempt: understandingScore(SYNTHETIC_REPORTS.assistedAttempt),
} as const;
