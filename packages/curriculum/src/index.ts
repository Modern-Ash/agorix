/** Mission definitions, completion predicates and hint ladders. */
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
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
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type MissionSchemaVersion = typeof MISSION_SCHEMA_VERSION;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type MissionConcept = "sequence" | "events" | "movement" | "repetition" | "conditions";

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
  readonly locale?: string;
}

export interface MissionEvaluation {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly completed: boolean;
  readonly predicate: CompletionPredicate["type"];
  readonly finalWorld: WorldState;
  readonly observations: readonly RuntimeObservation[];
}

export interface MissionRunFeedback {
  readonly completed: boolean;
  readonly message: string;
  readonly reflectionPrompt?: string;
}

interface MissionLocaleContent {
  readonly title: string;
  readonly goal: MissionGoal;
  readonly constraints: readonly MissionConstraint[];
  readonly hintLadder: readonly MissionHint[];
  readonly reflectionPrompt: string;
}

interface MissionFeedbackMessages {
  readonly complete: string;
  readonly nothingMoved: string;
  readonly stoppedShort: string;
  readonly passedGoal: string;
  readonly adjustBlock: string;
}

export const FIRST_MISSION = Object.freeze({
  schema: MISSION_SCHEMA_VERSION,
  id: "first-mission.reach-goal",
  version: 1,
  title: "Reach the Goal",
  goal: {
    title: "Get your sprite to the goal",
    learnerFacing: "Use blocks to move the sprite until it reaches the goal.",
  },
  concepts: ["sequence", "events", "movement"],
  starterProject: {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [],
      },
    ],
  },
  starterStage: {
    sprite: { x: 52, y: 128, heading: 0 },
    goal: { x: 212, y: 128 },
  },
  completion: { type: "spriteTouchingGoal" },
  constraints: [
    {
      id: "poc-blocks-only",
      description: "The mission is solvable with the POC Move block and no tutor dependency.",
    },
    {
      id: "runtime-completion",
      description: "Completion is evaluated from runtime world state, not an LLM judgment.",
    },
  ],
  hintLadder: [
    { level: 1, text: "What changed on the stage after you pressed Run?" },
    { level: 2, text: "A Move block changes how far the sprite travels." },
    { level: 3, text: "Compare the Move steps with the gap between the sprite and the goal." },
    { level: 4, text: "Try one Move block that travels the same distance as the gap." },
    { level: 5, text: "From this starter stage, Move 160 steps reaches the goal." },
  ],
  reflectionPrompt: "What number made the sprite reach the goal, and why did it work?",
} satisfies MissionDefinition);

const FIRST_MISSION_LOCALIZED_CONTENT = {
  en: {
    title: "Reach the Goal",
    goal: {
      title: "Get your sprite to the goal",
      learnerFacing: "Use blocks to move the sprite until it reaches the goal.",
    },
    constraints: FIRST_MISSION.constraints,
    hintLadder: FIRST_MISSION.hintLadder,
    reflectionPrompt: "What number made the sprite reach the goal, and why did it work?",
  },
  es: {
    title: "Alcanza la meta",
    goal: {
      title: "Lleva tu personaje hasta la meta",
      learnerFacing: "Usa bloques para mover el personaje hasta que llegue a la meta.",
    },
    constraints: [
      {
        id: "poc-blocks-only",
        description:
          "La misión se puede resolver con el bloque Mover del POC, sin depender del tutor.",
      },
      {
        id: "runtime-completion",
        description:
          "La finalización se evalúa con el estado del mundo en runtime, no con juicio de un LLM.",
      },
    ],
    hintLadder: [
      { level: 1, text: "¿Qué cambió en el escenario después de presionar Ejecutar?" },
      { level: 2, text: "Un bloque Mover cambia qué tan lejos viaja el personaje." },
      {
        level: 3,
        text: "Compara los pasos del bloque Mover con la distancia entre el personaje y la meta.",
      },
      { level: 4, text: "Prueba un bloque Mover que recorra la misma distancia que falta." },
      { level: 5, text: "Desde este escenario inicial, Mover 160 pasos llega a la meta." },
    ],
    reflectionPrompt: "¿Qué número hizo que el personaje llegara a la meta y por qué funcionó?",
  },
} as const satisfies Record<SupportedLocale, MissionLocaleContent>;

const FEEDBACK_MESSAGES = {
  en: {
    complete: "Mission complete: your sprite reached the goal.",
    nothingMoved: "Nothing moved yet. Add a Move block, then press Run again.",
    stoppedShort:
      "Not there yet: the sprite moved toward the goal but stopped short. Try more steps.",
    passedGoal: "The sprite passed the goal. Try fewer steps so it stops on the goal.",
    adjustBlock:
      "The sprite did not finish on the goal. Compare the stage with your generated code, then adjust one block.",
  },
  es: {
    complete: "Misión completa: tu personaje llegó a la meta.",
    nothingMoved: "Todavía no se movió nada. Agrega un bloque Mover y vuelve a presionar Ejecutar.",
    stoppedShort:
      "Todavía falta: el personaje avanzó hacia la meta, pero se quedó corto. Prueba más pasos.",
    passedGoal: "El personaje pasó la meta. Prueba menos pasos para que se detenga sobre la meta.",
    adjustBlock:
      "El personaje no terminó sobre la meta. Compara el escenario con tu código generado y ajusta un bloque.",
  },
} as const satisfies Record<SupportedLocale, MissionFeedbackMessages>;

export function normalizeLocale(locale: string | undefined): SupportedLocale {
  if (locale === undefined) {
    return DEFAULT_LOCALE;
  }
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.includes(language as SupportedLocale)
    ? (language as SupportedLocale)
    : DEFAULT_LOCALE;
}

export function getLocalizedFirstMission(
  locale: string | undefined = DEFAULT_LOCALE,
): MissionDefinition {
  const content = FIRST_MISSION_LOCALIZED_CONTENT[normalizeLocale(locale)];
  return validateMission({
    ...FIRST_MISSION,
    title: content.title,
    goal: content.goal,
    constraints: content.constraints,
    hintLadder: content.hintLadder,
    reflectionPrompt: content.reflectionPrompt,
  });
}

export function assertFirstMissionLocaleCompleteness(): void {
  const expectedLevels = FIRST_MISSION.hintLadder.map((hint) => hint.level);
  for (const locale of SUPPORTED_LOCALES) {
    const mission = getLocalizedFirstMission(locale);
    if (mission.hintLadder.length !== expectedLevels.length) {
      fail(`$.locales.${locale}.hintLadder`, "expected complete hint ladder");
    }
    mission.hintLadder.forEach((hint, index) => {
      if (hint.level !== expectedLevels[index]) {
        fail(`$.locales.${locale}.hintLadder[${index}].level`, "expected matching hint level");
      }
    });
  }
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

export function createMissionRunFeedback(input: MissionEvaluationInput): MissionRunFeedback {
  const mission = validateMission(input.mission);
  const evaluation = evaluateMission({ mission, result: input.result });
  const messages = FEEDBACK_MESSAGES[normalizeLocale(input.locale)];
  if (evaluation.completed) {
    return {
      completed: true,
      message: messages.complete,
      reflectionPrompt: mission.reflectionPrompt,
    };
  }

  const start = createWorldState(mission.starterStage);
  const final = evaluation.finalWorld;
  const sameRow = final.sprite.y === final.goal.y;
  if (input.result.stepsUsed === 0) {
    return {
      completed: false,
      message: messages.nothingMoved,
    };
  }
  if (sameRow && final.sprite.x < final.goal.x) {
    return {
      completed: false,
      message: messages.stoppedShort,
    };
  }
  if (sameRow && final.sprite.x > final.goal.x && start.sprite.x < final.goal.x) {
    return {
      completed: false,
      message: messages.passedGoal,
    };
  }
  return {
    completed: false,
    message: messages.adjustBlock,
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
  const allowed = new Set<MissionConcept>([
    "sequence",
    "events",
    "movement",
    "repetition",
    "conditions",
  ]);
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
export * from "./worlds.js";
