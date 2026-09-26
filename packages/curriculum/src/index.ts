/** Mission definitions, completion predicates and hint ladders. */
import type { ProjectProgram } from "@agorix/program-model";
import { validateProgram } from "@agorix/program-model";
import {
  createWorldState,
  touchingGoal,
  type RunOutcome,
  type RunResult,
  type RuntimeObservation,
  type WorldState,
  type WorldStateInput,
} from "@agorix/runtime";

export const PACKAGE_NAME = "@agorix/curriculum";

export const MISSION_SCHEMA_VERSION = "agorix/mission/v1";

export type MissionSchemaVersion = typeof MISSION_SCHEMA_VERSION;

export type MissionConcept = "sequence" | "events" | "repetition" | "conditions";

export type CompletionPredicate =
  | {
      readonly type: "spriteTouchingGoal";
    }
  | {
      readonly type: "runtimeOutcome";
      readonly outcome: RunOutcome;
    }
  | {
      readonly type: "all";
      readonly predicates: readonly CompletionPredicate[];
    };

export interface MissionGoal {
  readonly title: string;
  readonly learnerFacing: string;
}

export interface MissionConstraint {
  readonly id: string;
  readonly description: string;
}

export interface MissionHint {
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly text: string;
}

export interface MissionDefinition {
  readonly schema: MissionSchemaVersion;
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly goal: MissionGoal;
  readonly concepts: readonly MissionConcept[];
  readonly starterProject: ProjectProgram;
  readonly starterStage: WorldStateInput;
  readonly completion: CompletionPredicate;
  readonly constraints: readonly MissionConstraint[];
  readonly hintLadder: readonly MissionHint[];
  readonly reflectionPrompt: string;
}

export interface MissionEvaluationInput {
  readonly mission: MissionDefinition;
  readonly result: RunResult;
}

export interface MissionEvaluation {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly completed: boolean;
  readonly predicate: CompletionPredicate["type"];
  readonly finalWorld: WorldState;
  readonly observations: readonly RuntimeObservation[];
}

export class MissionValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "MissionValidationError";
    this.path = path;
  }
}

export function validateMission(mission: MissionDefinition): MissionDefinition {
  if (typeof mission !== "object" || mission === null || Array.isArray(mission)) {
    fail("$", "expected mission object");
  }
  if (mission.schema !== MISSION_SCHEMA_VERSION) {
    fail("$.schema", `expected ${MISSION_SCHEMA_VERSION}`);
  }
  assertNonEmptyString(mission.id, "$.id");
  assertPositiveInteger(mission.version, "$.version");
  assertNonEmptyString(mission.title, "$.title");
  assertGoal(mission.goal);
  assertConcepts(mission.concepts);
  validateProgram(mission.starterProject);
  createWorldState(mission.starterStage);
  assertCompletionPredicate(mission.completion, "$.completion");
  assertConstraints(mission.constraints);
  assertHintLadder(mission.hintLadder);
  assertNonEmptyString(mission.reflectionPrompt, "$.reflectionPrompt");
  return mission;
}

export function evaluateMission(input: MissionEvaluationInput): MissionEvaluation {
  const mission = validateMission(input.mission);
  const finalWorld = createWorldState(input.result.world);
  return {
    missionId: mission.id,
    missionVersion: mission.version,
    completed: evaluatePredicate(mission.completion, input.result),
    predicate: mission.completion.type,
    finalWorld,
    observations: input.result.observations.map((observation) => ({
      ...observation,
      world: createWorldState(observation.world),
    })),
  };
}

function evaluatePredicate(predicate: CompletionPredicate, result: RunResult): boolean {
  switch (predicate.type) {
    case "spriteTouchingGoal":
      return touchingGoal(result.world);
    case "runtimeOutcome":
      return result.outcome === predicate.outcome;
    case "all":
      return predicate.predicates.every((child) => evaluatePredicate(child, result));
  }
}

function fail(path: string, message: string): never {
  throw new MissionValidationError(path, message);
}

function assertNonEmptyString(value: string, path: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "expected non-empty string");
  }
}

function assertPositiveInteger(value: number, path: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    fail(path, "expected positive integer");
  }
}

function assertGoal(goal: MissionGoal): void {
  if (typeof goal !== "object" || goal === null || Array.isArray(goal)) {
    fail("$.goal", "expected goal object");
  }
  assertNonEmptyString(goal.title, "$.goal.title");
  assertNonEmptyString(goal.learnerFacing, "$.goal.learnerFacing");
}

function assertConcepts(concepts: readonly MissionConcept[]): void {
  if (!Array.isArray(concepts) || concepts.length === 0) {
    fail("$.concepts", "expected at least one concept");
  }
  const allowed = new Set<MissionConcept>(["sequence", "events", "repetition", "conditions"]);
  concepts.forEach((concept, index) => {
    if (!allowed.has(concept)) {
      fail(`$.concepts[${index}]`, "expected supported POC concept");
    }
  });
}

function assertCompletionPredicate(predicate: CompletionPredicate, path: string): void {
  if (typeof predicate !== "object" || predicate === null || Array.isArray(predicate)) {
    fail(path, "expected completion predicate object");
  }
  switch (predicate.type) {
    case "spriteTouchingGoal":
      return;
    case "runtimeOutcome":
      if (!["completed", "budget-exceeded", "stopped"].includes(predicate.outcome)) {
        fail(`${path}.outcome`, "expected runtime outcome");
      }
      return;
    case "all":
      if (!Array.isArray(predicate.predicates) || predicate.predicates.length === 0) {
        fail(`${path}.predicates`, "expected at least one predicate");
      }
      predicate.predicates.forEach((child, index) =>
        assertCompletionPredicate(child, `${path}.predicates[${index}]`),
      );
      return;
    default:
      fail(`${path}.type`, "expected supported completion predicate");
  }
}

function assertConstraints(constraints: readonly MissionConstraint[]): void {
  if (!Array.isArray(constraints)) {
    fail("$.constraints", "expected constraints array");
  }
  constraints.forEach((constraint, index) => {
    assertNonEmptyString(constraint.id, `$.constraints[${index}].id`);
    assertNonEmptyString(constraint.description, `$.constraints[${index}].description`);
  });
}

function assertHintLadder(hints: readonly MissionHint[]): void {
  if (!Array.isArray(hints) || hints.length === 0) {
    fail("$.hintLadder", "expected at least one hint");
  }
  let previous = 0;
  hints.forEach((hint, index) => {
    if (!Number.isInteger(hint.level) || hint.level < 1 || hint.level > 5) {
      fail(`$.hintLadder[${index}].level`, "expected level 1-5");
    }
    if (hint.level <= previous) {
      fail(`$.hintLadder[${index}].level`, "expected strictly increasing levels");
    }
    previous = hint.level;
    assertNonEmptyString(hint.text, `$.hintLadder[${index}].text`);
  });
}
