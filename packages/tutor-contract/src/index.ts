/** Provider-neutral request/response model and pedagogical guardrails for the AI tutor. */
import { normalizeLocale, type MissionConcept, type SupportedLocale } from "@agorix/curriculum";
import type { ProjectProgram } from "@agorix/program-model";
import { validateProgram } from "@agorix/program-model";
import {
  createWorldState,
  type RunOutcome,
  type RuntimeObservation,
  type WorldState,
} from "@agorix/runtime";

export const PACKAGE_NAME = "@agorix/tutor-contract";

export const TUTOR_REQUEST_SCHEMA_VERSION = "agorix/tutor-request/v1";
export const TUTOR_RESPONSE_SCHEMA_VERSION = "agorix/tutor-response/v1";

export type TutorRequestSchemaVersion = typeof TUTOR_REQUEST_SCHEMA_VERSION;
export type TutorResponseSchemaVersion = typeof TUTOR_RESPONSE_SCHEMA_VERSION;
export type TutorHintLevel = 1 | 2 | 3 | 4 | 5;

export interface TutorMissionContext {
  readonly id: string;
  readonly version: number;
  readonly concepts: readonly MissionConcept[];
}

export interface TutorRuntimeContext {
  readonly outcome: RunOutcome;
  readonly stepsUsed: number;
  readonly finalWorld: WorldState;
  readonly observations: readonly RuntimeObservation[];
  readonly error?: TutorRuntimeError;
}

export interface TutorRuntimeError {
  readonly code: string;
  readonly nodeId?: string;
  readonly message: string;
}

export interface TutorHintHistoryEntry {
  readonly level: TutorHintLevel;
  readonly concept?: MissionConcept;
  readonly nodeId?: string;
}

export interface TutorReadingConfig {
  readonly locale: string;
  readonly readingLevel?: "early-reader" | "middle-grade" | "plain";
}

export interface TutorRequest {
  readonly schema: TutorRequestSchemaVersion;
  readonly mission: TutorMissionContext;
  readonly program: ProjectProgram;
  readonly runtime: TutorRuntimeContext;
  readonly hintHistory: readonly TutorHintHistoryEntry[];
  readonly learnerQuestion?: string;
  readonly reading?: TutorReadingConfig;
}

export interface TutorResponse {
  readonly schema: TutorResponseSchemaVersion;
  readonly hintLevel: TutorHintLevel;
  readonly message: string;
  readonly nodeIds: readonly string[];
  readonly concepts: readonly MissionConcept[];
}

export class TutorContractValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "TutorContractValidationError";
    this.path = path;
  }
}

const REQUEST_KEYS = new Set([
  "schema",
  "mission",
  "program",
  "runtime",
  "hintHistory",
  "learnerQuestion",
  "reading",
]);
const RESPONSE_KEYS = new Set(["schema", "hintLevel", "message", "nodeIds", "concepts"]);
const MISSION_KEYS = new Set(["id", "version", "concepts"]);
const RUNTIME_KEYS = new Set(["outcome", "stepsUsed", "finalWorld", "observations", "error"]);
const RUNTIME_ERROR_KEYS = new Set(["code", "nodeId", "message"]);
const HISTORY_KEYS = new Set(["level", "concept", "nodeId"]);
const READING_KEYS = new Set(["locale", "readingLevel"]);
const CONCEPTS = new Set<MissionConcept>([
  "sequence",
  "events",
  "movement",
  "repetition",
  "conditions",
]);
const OUTCOMES = new Set<RunOutcome>(["completed", "budget-exceeded", "stopped"]);

export function validateTutorRequest(request: TutorRequest): TutorRequest {
  assertPlainObject(request, "$", REQUEST_KEYS);
  if (request.schema !== TUTOR_REQUEST_SCHEMA_VERSION) {
    fail("$.schema", `expected ${TUTOR_REQUEST_SCHEMA_VERSION}`);
  }
  assertMission(request.mission, "$.mission");
  validateProgram(request.program);
  assertRuntime(request.runtime, "$.runtime");
  assertHintHistory(request.hintHistory, "$.hintHistory");
  if (request.learnerQuestion !== undefined) {
    assertBoundedString(request.learnerQuestion, "$.learnerQuestion", 1, 600);
  }
  if (request.reading !== undefined) {
    assertReading(request.reading, "$.reading");
  }
  return request;
}

export function validateTutorResponse(response: TutorResponse): TutorResponse {
  assertPlainObject(response, "$", RESPONSE_KEYS);
  if (response.schema !== TUTOR_RESPONSE_SCHEMA_VERSION) {
    fail("$.schema", `expected ${TUTOR_RESPONSE_SCHEMA_VERSION}`);
  }
  assertHintLevel(response.hintLevel, "$.hintLevel");
  assertBoundedString(response.message, "$.message", 1, 800);
  assertStringArray(response.nodeIds, "$.nodeIds");
  assertConcepts(response.concepts, "$.concepts", true);
  return response;
}

export function parseTutorResponse(providerOutput: unknown): TutorResponse {
  return validateTutorResponse(providerOutput as TutorResponse);
}

export function createTutorRequest(input: Omit<TutorRequest, "schema">): TutorRequest {
  return validateTutorRequest({ schema: TUTOR_REQUEST_SCHEMA_VERSION, ...input });
}

export function createTutorResponse(input: Omit<TutorResponse, "schema">): TutorResponse {
  return validateTutorResponse({ schema: TUTOR_RESPONSE_SCHEMA_VERSION, ...input });
}

export function assertTutorProviderContract(
  providerName: string,
  makeResponse: () => unknown,
): TutorResponse {
  assertBoundedString(providerName, "providerName", 1, 80);
  return parseTutorResponse(makeResponse());
}

export function createDeterministicTutorResponse(request: TutorRequest): TutorResponse {
  const validated = validateTutorRequest(request);
  const hintLevel = nextHintLevel(validated.hintHistory);
  const nodeIds = firstUsefulNodeId(validated);
  const concepts = preferredConcepts(validated);
  return createTutorResponse({
    hintLevel,
    message: messageForHintLevel(hintLevel, validated),
    nodeIds,
    concepts,
  });
}

function nextHintLevel(history: readonly TutorHintHistoryEntry[]): TutorHintLevel {
  const highest = history.reduce((level, entry) => Math.max(level, entry.level), 0);
  return Math.min(highest + 1, 5) as TutorHintLevel;
}

function firstUsefulNodeId(request: TutorRequest): readonly string[] {
  const traceNode = [...request.runtime.observations]
    .reverse()
    .find((observation) => observation.nodeId !== "$" && observation.statementType !== undefined);
  if (traceNode !== undefined) {
    return [traceNode.nodeId];
  }

  for (let scriptIndex = 0; scriptIndex < request.program.scripts.length; scriptIndex += 1) {
    const script = request.program.scripts[scriptIndex];
    if (script !== undefined && script.statements.length > 0) {
      return [`scripts[${scriptIndex}]/statements[0]`];
    }
  }
  return [];
}

function preferredConcepts(request: TutorRequest): readonly MissionConcept[] {
  return request.mission.concepts.slice(0, 2);
}

function messageForHintLevel(level: TutorHintLevel, request: TutorRequest): string {
  const locale = normalizeLocale(request.reading?.locale);
  const hasBlocks = request.program.scripts.some((script) => script.statements.length > 0);
  const reachedGoal =
    request.runtime.finalWorld.sprite.x === request.runtime.finalWorld.goal.x &&
    request.runtime.finalWorld.sprite.y === request.runtime.finalWorld.goal.y;

  if (reachedGoal) {
    return tutorMessages(locale).reachedGoal;
  }

  if (!hasBlocks) {
    return level === 1
      ? tutorMessages(locale).emptyFirstHint
      : tutorMessages(locale).emptyLaterHint;
  }

  return tutorMessages(locale).levels[level];
}

function tutorMessages(locale: SupportedLocale): {
  readonly reachedGoal: string;
  readonly emptyFirstHint: string;
  readonly emptyLaterHint: string;
  readonly levels: Record<TutorHintLevel, string>;
} {
  if (locale === "es") {
    return {
      reachedGoal:
        "Tu programa llegó a la meta. ¿Qué bloque hizo que el personaje se moviera hasta ahí?",
      emptyFirstHint:
        "¿Qué debería pasar después de presionar Ejecutar? Prueba agregando primero un bloque de movimiento.",
      emptyLaterHint:
        "Agrega un bloque Mover y vuelve a ejecutar para comparar el personaje con la meta.",
      levels: {
        1: "¿Qué cambió en el escenario después de Ejecutar y qué todavía necesita cambiar?",
        2: "El personaje se mueve según el número de tu bloque Mover. Compara ese número con la distancia hasta la meta.",
        3: "Mira el bloque resaltado. Ese es el primer lugar para ajustar qué tan lejos viaja el personaje.",
        4: "Prueba cambiar los pasos de Mover de a poco, vuelve a ejecutar y observa si el personaje se acerca.",
        5: "Una solución simple es mover el personaje la misma distancia que falta hasta la meta; luego ejecuta y revisa el escenario.",
      },
    };
  }

  return {
    reachedGoal: "Your program reached the goal. What block made the sprite move there?",
    emptyFirstHint: "What should happen after you press Run? Try adding one movement block first.",
    emptyLaterHint: "Add a Move block, then run again so you can compare the sprite with the goal.",
    levels: {
      1: "What changed on the stage after Run, and what still needs to change?",
      2: "The sprite moves by the number in your Move block. Compare that number with the distance to the goal.",
      3: "Look at the highlighted block. That is the first place to adjust how far the sprite travels.",
      4: "Try changing the Move steps a little at a time, then run again and watch whether the sprite gets closer.",
      5: "A simple solution is to move the sprite the same distance as the gap to the goal, then run and check the stage.",
    },
  };
}

function assertMission(value: TutorMissionContext, path: string): void {
  assertPlainObject(value, path, MISSION_KEYS);
  assertBoundedString(value.id, `${path}.id`, 1, 120);
  assertPositiveInteger(value.version, `${path}.version`);
  assertConcepts(value.concepts, `${path}.concepts`, false);
}

function assertRuntime(value: TutorRuntimeContext, path: string): void {
  assertPlainObject(value, path, RUNTIME_KEYS);
  if (!OUTCOMES.has(value.outcome)) {
    fail(`${path}.outcome`, "expected runtime outcome");
  }
  assertNonNegativeInteger(value.stepsUsed, `${path}.stepsUsed`);
  createWorldState(value.finalWorld);
  if (!Array.isArray(value.observations)) {
    fail(`${path}.observations`, "expected observations array");
  }
  value.observations.forEach((observation, index) =>
    assertObservation(observation, `${path}.observations[${index}]`),
  );
  if (value.error !== undefined) {
    assertRuntimeError(value.error, `${path}.error`);
  }
}

function assertObservation(value: RuntimeObservation, path: string): void {
  assertPlainObject(value, path);
  if (!["statement-start", "statement-end", "run-complete"].includes(String(value.kind))) {
    fail(`${path}.kind`, "expected runtime observation kind");
  }
  assertNonNegativeInteger(value.step, `${path}.step`);
  assertBoundedString(value.nodeId, `${path}.nodeId`, 1, 160);
  createWorldState(value.world);
}

function assertRuntimeError(value: TutorRuntimeError, path: string): void {
  assertPlainObject(value, path, RUNTIME_ERROR_KEYS);
  assertBoundedString(value.code, `${path}.code`, 1, 80);
  assertBoundedString(value.message, `${path}.message`, 1, 400);
  if (value.nodeId !== undefined) {
    assertBoundedString(value.nodeId, `${path}.nodeId`, 1, 160);
  }
}

function assertHintHistory(value: readonly TutorHintHistoryEntry[], path: string): void {
  if (!Array.isArray(value)) {
    fail(path, "expected hint history array");
  }
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertPlainObject(entry, entryPath, HISTORY_KEYS);
    assertHintLevel(entry.level as number, `${entryPath}.level`);
    const concept = entry.concept;
    if (concept !== undefined && (!isMissionConcept(concept) || !CONCEPTS.has(concept))) {
      fail(`${entryPath}.concept`, "expected supported concept");
    }
    const nodeId = entry.nodeId;
    if (nodeId !== undefined) {
      assertBoundedString(nodeId as string, `${entryPath}.nodeId`, 1, 160);
    }
  });
}

function assertReading(value: TutorReadingConfig, path: string): void {
  assertPlainObject(value, path, READING_KEYS);
  assertBoundedString(value.locale, `${path}.locale`, 2, 35);
  if (
    value.readingLevel !== undefined &&
    !["early-reader", "middle-grade", "plain"].includes(value.readingLevel)
  ) {
    fail(`${path}.readingLevel`, "expected supported reading level");
  }
}

function assertConcepts(value: readonly MissionConcept[], path: string, allowEmpty: boolean): void {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(path, allowEmpty ? "expected concepts array" : "expected at least one concept");
  }
  value.forEach((concept, index) => {
    if (!CONCEPTS.has(concept)) {
      fail(`${path}[${index}]`, "expected supported concept");
    }
  });
}

function isMissionConcept(value: unknown): value is MissionConcept {
  return typeof value === "string" && CONCEPTS.has(value as MissionConcept);
}

function assertStringArray(value: readonly string[], path: string): void {
  if (!Array.isArray(value)) {
    fail(path, "expected string array");
  }
  value.forEach((item, index) => assertBoundedString(item, `${path}[${index}]`, 1, 160));
}

function assertHintLevel(value: number, path: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    fail(path, "expected hint level 1-5");
  }
}

function assertPositiveInteger(value: number, path: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    fail(path, "expected positive integer");
  }
}

function assertNonNegativeInteger(value: number, path: string): void {
  if (!Number.isInteger(value) || value < 0) {
    fail(path, "expected non-negative integer");
  }
}

function assertBoundedString(value: string, path: string, min: number, max: number): void {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    fail(path, `expected string length ${min}-${max}`);
  }
}

function assertPlainObject(
  value: unknown,
  path: string,
  allowedKeys?: ReadonlySet<string>,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected object");
  }
  if (allowedKeys !== undefined) {
    for (const key of Object.keys(value)) {
      if (!allowedKeys.has(key)) {
        fail(`${path}.${key}`, "unexpected provider-specific field");
      }
    }
  }
}

function fail(path: string, message: string): never {
  throw new TutorContractValidationError(path, message);
}

export * from "./learning-companion.js";
