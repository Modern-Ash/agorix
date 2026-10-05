import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  createWorldState,
  runProgram,
  touchingGoal,
  type RunOutcome,
  type WorldStateInput,
} from "@agorix/runtime";
import {
  EVIDENCE_EVENT_SCHEMA_VERSION,
  validateEvidenceEvent,
  type LearningEvidenceEvent,
  type Prediction,
} from "./evidence.js";

export const MODEL_COMPARISON_ACTIVITY_SCHEMA_VERSION = "agorix/model-comparison-activity/v1";

export type ModelComparisonActivitySchemaVersion = typeof MODEL_COMPARISON_ACTIVITY_SCHEMA_VERSION;

export type ModelComparisonRuntimeStatus =
  "reaches-goal" | "does-not-reach-goal" | "runtime-error" | "invalid-proposal";

export type ModelComparisonConclusion =
  "both-work" | "one-works" | "neither-works" | "inconclusive";

export type ModelComparisonReflection =
  "runtime-evidence" | "different-structure" | "needs-debugging";

export interface ModelComparisonAlternativeInput {
  /** Learner-facing alias such as "Proposal A"; not a provider or model identity. */
  readonly id: string;
  readonly label: string;
  readonly program: ProjectProgram;
}

export interface ModelComparisonActivityInput {
  readonly id: string;
  readonly baseProgram: ProjectProgram;
  readonly alternatives: readonly ModelComparisonAlternativeInput[];
  readonly world?: WorldStateInput;
  readonly maxSteps?: number;
}

export interface ModelComparisonAlternativeResult {
  readonly id: string;
  readonly label: string;
  readonly valid: boolean;
  readonly runtimeStatus: ModelComparisonRuntimeStatus;
  readonly outcome?: RunOutcome;
  readonly reachedGoal: boolean;
  readonly stepsUsed: number;
  readonly changedFromBase: boolean;
}

export interface ModelComparisonActivity {
  readonly schema: ModelComparisonActivitySchemaVersion;
  readonly id: string;
  readonly alternatives: readonly ModelComparisonAlternativeResult[];
  /** No automatic winner: the learner must inspect, predict and conclude from evidence. */
  readonly autoSelectedAlternativeId?: undefined;
}

export interface ModelComparisonDecisionInput {
  readonly activity: ModelComparisonActivity;
  readonly inspectedAlternativeIds: readonly string[];
  readonly prediction: Prediction;
  readonly conclusion: ModelComparisonConclusion;
  readonly reflection: ModelComparisonReflection;
  readonly sequence: number;
  readonly id?: string;
}

export interface ModelComparisonDecision {
  readonly event: LearningEvidenceEvent;
  readonly evidenceBacked: boolean;
}

export function createModelComparisonActivity(
  input: ModelComparisonActivityInput,
): ModelComparisonActivity {
  assertBoundedId(input.id, "$.id");
  const baseProgram = validateProgram(input.baseProgram);
  if (input.alternatives.length < 2) {
    throw new ModelComparisonActivityError(
      "INVALID_ACTIVITY",
      "$.alternatives",
      "expected at least two alternatives",
    );
  }
  const ids = new Set<string>();
  const alternatives = input.alternatives.map((alternative, index) => {
    assertBoundedId(alternative.id, `$.alternatives[${index}].id`);
    assertBoundedLabel(alternative.label, `$.alternatives[${index}].label`);
    if (ids.has(alternative.id)) {
      throw new ModelComparisonActivityError(
        "INVALID_ACTIVITY",
        `$.alternatives[${index}].id`,
        "expected unique alternative ids",
      );
    }
    ids.add(alternative.id);
    return evaluateAlternative(alternative, baseProgram, input.world, input.maxSteps);
  });
  return {
    schema: MODEL_COMPARISON_ACTIVITY_SCHEMA_VERSION,
    id: input.id,
    alternatives,
  };
}

export function recordModelComparisonDecision(
  input: ModelComparisonDecisionInput,
): ModelComparisonDecision {
  if (input.activity.schema !== MODEL_COMPARISON_ACTIVITY_SCHEMA_VERSION) {
    throw new ModelComparisonActivityError("INVALID_ACTIVITY", "$.activity.schema", "bad schema");
  }
  const inspected = new Set(input.inspectedAlternativeIds);
  const known = new Set(input.activity.alternatives.map((alternative) => alternative.id));
  if (inspected.size < 2 || [...inspected].some((id) => !known.has(id))) {
    throw new ModelComparisonActivityError(
      "DECISION_BEFORE_INSPECTION",
      "$.inspectedAlternativeIds",
      "expected at least two inspected alternatives from this activity",
    );
  }
  const evidenceBacked = conclusionMatchesEvidence(input.activity, input.conclusion);
  const decisionJustified = evidenceBacked && input.reflection === "runtime-evidence";
  const event = validateEvidenceEvent({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: input.id ?? `${input.activity.id}:decision`,
    sequence: input.sequence,
    assistanceLevel: "independent",
    kind: "modelComparisonDecided",
    alternativesCompared: inspected.size,
    decisionJustified,
  });
  return { event, evidenceBacked };
}

export type ModelComparisonActivityErrorCode = "INVALID_ACTIVITY" | "DECISION_BEFORE_INSPECTION";

export class ModelComparisonActivityError extends Error {
  readonly code: ModelComparisonActivityErrorCode;
  readonly path: string;

  constructor(code: ModelComparisonActivityErrorCode, path: string, message: string) {
    super(`${code} ${path}: ${message}`);
    this.name = "ModelComparisonActivityError";
    this.code = code;
    this.path = path;
  }
}

function evaluateAlternative(
  alternative: ModelComparisonAlternativeInput,
  baseProgram: ProjectProgram,
  world: WorldStateInput | undefined,
  maxSteps: number | undefined,
): ModelComparisonAlternativeResult {
  let program: ProjectProgram;
  try {
    program = validateProgram(alternative.program);
  } catch {
    return invalidAlternative(alternative, baseProgram);
  }
  try {
    const result = runProgram(
      program,
      createWorldState(world),
      maxSteps === undefined ? undefined : { maxSteps },
    );
    const reachedGoal = touchingGoal(result.world);
    return {
      id: alternative.id,
      label: alternative.label,
      valid: true,
      runtimeStatus: reachedGoal ? "reaches-goal" : "does-not-reach-goal",
      outcome: result.outcome,
      reachedGoal,
      stepsUsed: result.stepsUsed,
      changedFromBase: !programsEqual(program, baseProgram),
    };
  } catch {
    return {
      id: alternative.id,
      label: alternative.label,
      valid: true,
      runtimeStatus: "runtime-error",
      reachedGoal: false,
      stepsUsed: 0,
      changedFromBase: !programsEqual(program, baseProgram),
    };
  }
}

function invalidAlternative(
  alternative: ModelComparisonAlternativeInput,
  baseProgram: ProjectProgram,
): ModelComparisonAlternativeResult {
  return {
    id: alternative.id,
    label: alternative.label,
    valid: false,
    runtimeStatus: "invalid-proposal",
    reachedGoal: false,
    stepsUsed: 0,
    changedFromBase: !programsEqual(alternative.program, baseProgram),
  };
}

function conclusionMatchesEvidence(
  activity: ModelComparisonActivity,
  conclusion: ModelComparisonConclusion,
): boolean {
  const reaching = activity.alternatives.filter((alternative) => alternative.reachedGoal).length;
  if (conclusion === "both-work") return reaching >= 2;
  if (conclusion === "one-works") return reaching === 1;
  if (conclusion === "neither-works") return reaching === 0;
  return false;
}

function programsEqual(a: ProjectProgram, b: ProjectProgram): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertBoundedId(value: string, path: string): void {
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(value)) {
    throw new ModelComparisonActivityError("INVALID_ACTIVITY", path, "expected stable id");
  }
}

function assertBoundedLabel(value: string, path: string): void {
  if (value.length < 1 || value.length > 80) {
    throw new ModelComparisonActivityError("INVALID_ACTIVITY", path, "expected bounded label");
  }
}
