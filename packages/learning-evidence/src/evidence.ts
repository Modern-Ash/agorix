/**
 * Minimal, privacy-preserving learning evidence events (issue #102).
 *
 * Design rules encoded here:
 * - no free text, no timestamps, no identity, no device or network fields;
 * - no prompt counting, no AI usage totals, no speed and no model confidence;
 * - every field carries a documented retention class;
 * - every event records the assistance level in effect when it happened, so an
 *   assessment can never hide that the AI did the work.
 */

import { COMPETENCY_IDS, isCompetencyId } from "./competencies.js";

export const PACKAGE_NAME = "@agorix/learning-evidence";

export const EVIDENCE_EVENT_SCHEMA_VERSION = "agorix/learning-evidence-event/v1";
export const MISSION_ASSESSMENT_SCHEMA_VERSION = "agorix/mission-assessment/v1";

/**
 * Assistance in effect when an event was recorded, ordered from learner-led to
 * AI-led. The order is load-bearing: assessment credit is monotonically
 * non-increasing in this order, so a metric can never reward more assistance.
 */
export const ASSISTANCE_LEVELS = ["independent", "hinted", "proposed", "delegated"] as const;

export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];

export const ASSISTANCE_RANK: Readonly<Record<AssistanceLevel, number>> = {
  independent: 0,
  hinted: 1,
  proposed: 2,
  delegated: 3,
};

export const EVENT_KINDS = [
  "predictionMade",
  "proposalDecided",
  "reflectionRecorded",
  "scaffoldDelivered",
  "programRevisedAfterExecution",
  "debuggingSucceeded",
  "codeViewUsed",
  "modelComparisonDecided",
  "missionCompleted",
] as const;

export type EvidenceEventKind = (typeof EVENT_KINDS)[number];

export const REVISION_KINDS = [
  "sequenceChange",
  "eventOrder",
  "loopChange",
  "conditionChange",
  "stateChange",
  "decomposition",
  "textEdit",
] as const;

export type RevisionKind = (typeof REVISION_KINDS)[number];

export const REFLECTION_KINDS = ["intent", "decision", "verification"] as const;

export type ReflectionKind = (typeof REFLECTION_KINDS)[number];

export const SCAFFOLD_KINDS = ["clarifyingQuestion", "diagnostic", "hint", "solution"] as const;

export type ScaffoldKind = (typeof SCAFFOLD_KINDS)[number];

export const CODE_VIEWS = ["agorixCode", "python"] as const;

export type CodeView = (typeof CODE_VIEWS)[number];

export const RUNTIME_OUTCOMES = ["completed", "incomplete", "error"] as const;

export type RuntimeOutcome = (typeof RUNTIME_OUTCOMES)[number];

export const PREDICTIONS = ["reachGoal", "notReachGoal", "runtimeError"] as const;

export type Prediction = (typeof PREDICTIONS)[number];

export const PROPOSAL_DECISIONS = ["accept", "reject", "modify"] as const;

export type ProposalDecision = (typeof PROPOSAL_DECISIONS)[number];

/** Fields that would turn evidence into child profiling. Rejected on validation. */
export const PROHIBITED_EVIDENCE_FIELDS: readonly string[] = [
  "age",
  "birthDate",
  "deviceId",
  "elapsedMs",
  "email",
  "freeText",
  "gender",
  "ipAddress",
  "learnerName",
  "location",
  "modelConfidence",
  "name",
  "photo",
  "profileVector",
  "promptCount",
  "school",
  "speed",
  "text",
  "timestamp",
  "tokensUsed",
  "transcript",
  "userId",
  "voiceRecording",
];

/** Retention classes. Every evidence field is assigned exactly one of these. */
export type RetentionClass = "sessionMemory" | "localEphemeral" | "notStored";

export const RETENTION_CLASSES: readonly RetentionClass[] = [
  "sessionMemory",
  "localEphemeral",
  "notStored",
];

interface BaseEvent {
  readonly schema: typeof EVIDENCE_EVENT_SCHEMA_VERSION;
  readonly id: string;
  /** Monotonic ordinal within one mission attempt. Not a wall-clock time. */
  readonly sequence: number;
  readonly assistanceLevel: AssistanceLevel;
}

export interface PredictionMadeEvent extends BaseEvent {
  readonly kind: "predictionMade";
  readonly prediction: Prediction;
  /** True when the learner's prediction matched the deterministic runtime outcome. */
  readonly matchedRuntimeOutcome: boolean;
}

export interface ProposalDecidedEvent extends BaseEvent {
  readonly kind: "proposalDecided";
  readonly decision: ProposalDecision;
  readonly inspectedDiff: boolean;
  readonly testedWithRuntime: boolean;
  /** True when the learner contradicted the companion instead of accepting it. */
  readonly challengedCompanion: boolean;
}

export interface ReflectionRecordedEvent extends BaseEvent {
  readonly kind: "reflectionRecorded";
  readonly reflectionKind: ReflectionKind;
  /**
   * Reflection content stays on the device and is never part of the evidence
   * record. The event records only that the learner answered.
   */
  readonly storage: "localEphemeral";
  readonly contentRetained: false;
}

export interface ScaffoldDeliveredEvent extends BaseEvent {
  readonly kind: "scaffoldDelivered";
  readonly scaffoldKind: ScaffoldKind;
  /** 1 (lightest) to 5 (most explicit scaffolding), mirroring the hint ladder. */
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly answeredByLearner: boolean;
}

export interface ProgramRevisedAfterExecutionEvent extends BaseEvent {
  readonly kind: "programRevisedAfterExecution";
  readonly revisionKind: RevisionKind;
  readonly changedNodeCount: number;
  /** True when the revision followed a failed or off-target execution. */
  readonly afterUnsuccessfulRun: boolean;
}

export interface DebuggingSucceededEvent extends BaseEvent {
  readonly kind: "debuggingSucceeded";
  readonly attemptsBeforeSuccess: number;
  readonly usedRuntimeEvidence: boolean;
}

export interface CodeViewUsedEvent extends BaseEvent {
  readonly kind: "codeViewUsed";
  readonly view: CodeView;
}

export interface ModelComparisonDecidedEvent extends BaseEvent {
  readonly kind: "modelComparisonDecided";
  readonly alternativesCompared: number;
  /** True when the learner recorded which alternative they chose and why. */
  readonly decisionJustified: boolean;
}

export interface MissionCompletedEvent extends BaseEvent {
  readonly kind: "missionCompleted";
  readonly runtimeOutcome: RuntimeOutcome;
}

export type LearningEvidenceEvent =
  | PredictionMadeEvent
  | ProposalDecidedEvent
  | ReflectionRecordedEvent
  | ScaffoldDeliveredEvent
  | ProgramRevisedAfterExecutionEvent
  | DebuggingSucceededEvent
  | CodeViewUsedEvent
  | ModelComparisonDecidedEvent
  | MissionCompletedEvent;

export type LearningEvidenceValidationCode =
  "INVALID_EVENT" | "PROHIBITED_FIELD" | "UNKNOWN_FIELD" | "UNSUPPORTED_SCHEMA";

export class LearningEvidenceValidationError extends Error {
  readonly code: LearningEvidenceValidationCode;
  readonly path: string;

  constructor(code: LearningEvidenceValidationCode, path: string, message: string) {
    super(`${code} ${path}: ${message}`);
    this.name = "LearningEvidenceValidationError";
    this.code = code;
    this.path = path;
  }
}

const BASE_FIELDS: readonly string[] = ["schema", "id", "sequence", "assistanceLevel", "kind"];

const FIELDS_BY_KIND: Readonly<Record<EvidenceEventKind, readonly string[]>> = {
  predictionMade: ["prediction", "matchedRuntimeOutcome"],
  proposalDecided: ["decision", "inspectedDiff", "testedWithRuntime", "challengedCompanion"],
  reflectionRecorded: ["reflectionKind", "storage", "contentRetained"],
  scaffoldDelivered: ["scaffoldKind", "level", "answeredByLearner"],
  programRevisedAfterExecution: ["revisionKind", "changedNodeCount", "afterUnsuccessfulRun"],
  debuggingSucceeded: ["attemptsBeforeSuccess", "usedRuntimeEvidence"],
  codeViewUsed: ["view"],
  modelComparisonDecided: ["alternativesCompared", "decisionJustified"],
  missionCompleted: ["runtimeOutcome"],
};

/**
 * Documented field inventory with retention assumptions. `docs/product/LEARNING_EVIDENCE.md`
 * renders the same table for review; this map is the machine-readable source.
 */
export const EVIDENCE_FIELD_RETENTION: Readonly<Record<string, RetentionClass>> = {
  schema: "notStored",
  id: "localEphemeral",
  sequence: "sessionMemory",
  assistanceLevel: "sessionMemory",
  kind: "sessionMemory",
  prediction: "sessionMemory",
  matchedRuntimeOutcome: "sessionMemory",
  decision: "sessionMemory",
  inspectedDiff: "sessionMemory",
  testedWithRuntime: "sessionMemory",
  challengedCompanion: "sessionMemory",
  reflectionKind: "sessionMemory",
  storage: "notStored",
  contentRetained: "notStored",
  scaffoldKind: "sessionMemory",
  level: "sessionMemory",
  answeredByLearner: "sessionMemory",
  revisionKind: "sessionMemory",
  changedNodeCount: "sessionMemory",
  afterUnsuccessfulRun: "sessionMemory",
  attemptsBeforeSuccess: "sessionMemory",
  usedRuntimeEvidence: "sessionMemory",
  view: "sessionMemory",
  alternativesCompared: "sessionMemory",
  decisionJustified: "sessionMemory",
  runtimeOutcome: "sessionMemory",
};

export interface RetentionDescription {
  readonly field: string;
  readonly retention: RetentionClass;
  readonly purpose: string;
}

const FIELD_PURPOSES: Readonly<Record<string, string>> = {
  schema: "Version marker for forward-compatible local parsing.",
  id: "Stable local handle for one evidence event; carries no identity.",
  sequence: "Ordering of events inside one mission attempt.",
  assistanceLevel: "Discloses how much of the work the AI performed.",
  kind: "Selects the event shape and its competency trace.",
  prediction: "What the learner expected before running.",
  matchedRuntimeOutcome: "Whether the prediction matched deterministic runtime evidence.",
  decision: "Learner accept/reject/modify outcome for a proposal.",
  inspectedDiff: "Whether the learner opened the proposal diff before deciding.",
  testedWithRuntime: "Whether the learner executed the proposal before trusting it.",
  challengedCompanion: "Whether the learner contradicted the companion.",
  reflectionKind: "Which prompt family the learner answered.",
  storage: "Declares local-only storage for any reflection content.",
  contentRetained: "Always false; reflection text never enters the evidence record.",
  scaffoldKind: "Class of scaffolding delivered.",
  level: "Scaffolding intensity on the 1-5 hint ladder.",
  answeredByLearner: "Whether the learner responded rather than dismissing the scaffold.",
  revisionKind: "Which part of the canonical program the learner changed.",
  changedNodeCount: "Size of the learner-authored edit.",
  afterUnsuccessfulRun: "Whether the edit followed a failed execution, i.e. debugging.",
  attemptsBeforeSuccess: "Number of evidence-backed repair attempts.",
  usedRuntimeEvidence: "Whether runtime observations drove the repair.",
  view: "Which code projection the learner inspected.",
  alternativesCompared: "Breadth of the comparison the learner performed.",
  decisionJustified: "Whether the learner recorded a reason for the choice.",
  runtimeOutcome: "Deterministic runtime result that proves mission completion.",
};

export function describeRetention(): readonly RetentionDescription[] {
  return Object.keys(EVIDENCE_FIELD_RETENTION)
    .sort()
    .map((field) => ({
      field,
      retention: EVIDENCE_FIELD_RETENTION[field] as RetentionClass,
      purpose: FIELD_PURPOSES[field] ?? "Undocumented field.",
    }));
}

export function assertRetentionCoverage(): void {
  const documented = new Set(Object.keys(EVIDENCE_FIELD_RETENTION));
  for (const kind of EVENT_KINDS) {
    for (const field of [...BASE_FIELDS, ...FIELDS_BY_KIND[kind]]) {
      if (!documented.has(field)) {
        throw new LearningEvidenceValidationError(
          "INVALID_EVENT",
          field,
          "evidence field has no documented retention class",
        );
      }
      if (FIELD_PURPOSES[field] === undefined) {
        throw new LearningEvidenceValidationError(
          "INVALID_EVENT",
          field,
          "evidence field has no documented purpose",
        );
      }
    }
  }
}

/**
 * Competency trace for every event kind, plus the schema-level invariant that
 * backs `aiLiteracy.privateDataUnnecessary`.
 */
export const EVENT_COMPETENCY_TRACE: Readonly<Record<EvidenceEventKind, readonly string[]>> = {
  predictionMade: ["collaboration.predictingBehavior"],
  proposalDecided: [
    "collaboration.inspectingProposals",
    "collaboration.decidingOnProposals",
    "collaboration.testingProposals",
    "collaboration.challengingAiAnswer",
    "aiLiteracy.aiCanBeWrong",
    "aiLiteracy.learnerIsAuthor",
  ],
  reflectionRecorded: [
    "collaboration.expressingIntent",
    "collaboration.explainingDecision",
    "aiLiteracy.fluentLanguageIsNotProof",
    "aiLiteracy.runtimeEvidenceMatters",
  ],
  scaffoldDelivered: ["collaboration.answeringClarifyingQuestions"],
  programRevisedAfterExecution: [
    "programming.sequence",
    "programming.events",
    "programming.repetition",
    "programming.conditions",
    "programming.state.variables",
    "programming.decomposition.functions",
    "programming.modifyingTextualCode",
    "programming.debugging",
  ],
  debuggingSucceeded: ["programming.debugging", "aiLiteracy.runtimeEvidenceMatters"],
  codeViewUsed: ["programming.readingCode"],
  modelComparisonDecided: ["collaboration.comparingAlternatives", "aiLiteracy.modelsCanDisagree"],
  missionCompleted: [],
};

export const SCHEMA_INVARIANT_COMPETENCIES: readonly string[] = [
  "aiLiteracy.privateDataUnnecessary",
];

export function assertCompetencyTraceCoverage(): void {
  for (const kind of EVENT_KINDS) {
    for (const competency of EVENT_COMPETENCY_TRACE[kind]) {
      if (!isCompetencyId(competency) || !COMPETENCY_IDS.includes(competency)) {
        throw new Error(`Event ${kind} maps to unknown competency ${competency}`);
      }
    }
  }
  for (const competency of SCHEMA_INVARIANT_COMPETENCIES) {
    if (!isCompetencyId(competency)) {
      throw new Error(`Schema invariant maps to unknown competency ${competency}`);
    }
  }
  const traced = new Set<string>([
    ...Object.values(EVENT_COMPETENCY_TRACE).flat(),
    ...SCHEMA_INVARIANT_COMPETENCIES,
  ]);
  const uncovered = COMPETENCY_IDS.filter((id) => !traced.has(id));
  if (uncovered.length > 0) {
    throw new Error(`Competencies without evidence source: ${uncovered.join(", ")}`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fail(code: LearningEvidenceValidationCode, path: string, message: string): never {
  throw new LearningEvidenceValidationError(code, path, message);
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail("INVALID_EVENT", path, `expected one of ${allowed.join(", ")}`);
  }
}

const SCAFFOLD_LEVELS = [1, 2, 3, 4, 5] as const;

function assertScaffoldLevel(value: unknown, path: string): asserts value is 1 | 2 | 3 | 4 | 5 {
  if (typeof value !== "number" || !SCAFFOLD_LEVELS.includes(value as 1 | 2 | 3 | 4 | 5)) {
    fail("INVALID_EVENT", path, `expected one of ${SCAFFOLD_LEVELS.join(", ")}`);
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail("INVALID_EVENT", path, "expected boolean");
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail("INVALID_EVENT", path, "expected non-negative integer");
  }
}

function assertIdentifier(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    fail("INVALID_EVENT", path, "expected non-empty identifier");
  }
}

/**
 * Validates one event. Fails closed on unknown fields and on any field that would
 * introduce identity, free text, timing or AI-usage telemetry.
 */
export function validateEvidenceEvent(input: unknown): LearningEvidenceEvent {
  if (!isRecord(input)) {
    fail("INVALID_EVENT", "$", "expected evidence event object");
  }
  if (input.schema !== EVIDENCE_EVENT_SCHEMA_VERSION) {
    fail("UNSUPPORTED_SCHEMA", "$.schema", `expected ${EVIDENCE_EVENT_SCHEMA_VERSION}`);
  }
  assertEnum(input.kind, EVENT_KINDS, "$.kind");

  const kind: EvidenceEventKind = input.kind;

  for (const key of Object.keys(input)) {
    if (PROHIBITED_EVIDENCE_FIELDS.includes(key)) {
      fail(
        "PROHIBITED_FIELD",
        `$.${key}`,
        "field would introduce profiling, identity, free text, timing or AI-usage telemetry",
      );
    }
  }

  const allowed = new Set([...BASE_FIELDS, ...FIELDS_BY_KIND[kind]]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      fail("UNKNOWN_FIELD", `$.${key}`, `not part of ${kind} evidence schema`);
    }
  }

  assertIdentifier(input.id, "$.id");
  assertNonNegativeInteger(input.sequence, "$.sequence");
  assertEnum(input.assistanceLevel, ASSISTANCE_LEVELS, "$.assistanceLevel");

  switch (kind) {
    case "predictionMade":
      assertEnum(input.prediction, PREDICTIONS, "$.prediction");
      assertBoolean(input.matchedRuntimeOutcome, "$.matchedRuntimeOutcome");
      break;
    case "proposalDecided":
      assertEnum(input.decision, PROPOSAL_DECISIONS, "$.decision");
      assertBoolean(input.inspectedDiff, "$.inspectedDiff");
      assertBoolean(input.testedWithRuntime, "$.testedWithRuntime");
      assertBoolean(input.challengedCompanion, "$.challengedCompanion");
      break;
    case "reflectionRecorded":
      assertEnum(input.reflectionKind, REFLECTION_KINDS, "$.reflectionKind");
      if (input.storage !== "localEphemeral") {
        fail("INVALID_EVENT", "$.storage", 'expected "localEphemeral"');
      }
      if (input.contentRetained !== false) {
        fail("INVALID_EVENT", "$.contentRetained", "reflection content must not be retained");
      }
      break;
    case "scaffoldDelivered":
      assertEnum(input.scaffoldKind, SCAFFOLD_KINDS, "$.scaffoldKind");
      assertScaffoldLevel(input.level, "$.level");
      assertBoolean(input.answeredByLearner, "$.answeredByLearner");
      break;
    case "programRevisedAfterExecution":
      assertEnum(input.revisionKind, REVISION_KINDS, "$.revisionKind");
      assertNonNegativeInteger(input.changedNodeCount, "$.changedNodeCount");
      assertBoolean(input.afterUnsuccessfulRun, "$.afterUnsuccessfulRun");
      break;
    case "debuggingSucceeded":
      assertNonNegativeInteger(input.attemptsBeforeSuccess, "$.attemptsBeforeSuccess");
      assertBoolean(input.usedRuntimeEvidence, "$.usedRuntimeEvidence");
      break;
    case "codeViewUsed":
      assertEnum(input.view, CODE_VIEWS, "$.view");
      break;
    case "modelComparisonDecided":
      assertNonNegativeInteger(input.alternativesCompared, "$.alternativesCompared");
      assertBoolean(input.decisionJustified, "$.decisionJustified");
      break;
    case "missionCompleted":
      assertEnum(input.runtimeOutcome, RUNTIME_OUTCOMES, "$.runtimeOutcome");
      break;
    default:
      fail("INVALID_EVENT", "$.kind", "unsupported evidence kind");
  }

  return input as unknown as LearningEvidenceEvent;
}

export function validateEvidenceEvents(input: unknown): readonly LearningEvidenceEvent[] {
  if (!Array.isArray(input)) {
    fail("INVALID_EVENT", "$", "expected array of evidence events");
  }
  return input.map((event: unknown, index: number) => {
    try {
      return validateEvidenceEvent(event);
    } catch (error) {
      if (error instanceof LearningEvidenceValidationError) {
        throw new LearningEvidenceValidationError(
          error.code,
          `$[${index}]${error.path}`,
          error.message.replace(`${error.code} ${error.path}: `, ""),
        );
      }
      throw error;
    }
  });
}

export function peakAssistance(events: readonly LearningEvidenceEvent[]): AssistanceLevel {
  let peak: AssistanceLevel = "independent";
  for (const event of events) {
    if (ASSISTANCE_RANK[event.assistanceLevel] > ASSISTANCE_RANK[peak]) {
      peak = event.assistanceLevel;
    }
  }
  return peak;
}
