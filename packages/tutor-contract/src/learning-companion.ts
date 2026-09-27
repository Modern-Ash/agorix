import type { MissionConcept } from "@agorix/curriculum";
import {
  createProgramProposal,
  validateProgramProposal,
  type ProgramProposal,
} from "@agorix/proposals";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import type { RuntimeObservation, RunOutcome, WorldState } from "@agorix/runtime";
import type {
  TutorHintLevel,
  TutorMissionContext,
  TutorReadingConfig,
  TutorRequest,
  TutorResponse,
  TutorRuntimeContext,
} from "./index.js";

export const LEARNING_COMPANION_REQUEST_SCHEMA_VERSION = "agorix/learning-companion-request/v1";
export const LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION = "agorix/learning-companion-response/v1";

export type LearningCompanionRequestSchemaVersion =
  typeof LEARNING_COMPANION_REQUEST_SCHEMA_VERSION;
export type LearningCompanionResponseSchemaVersion =
  typeof LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION;

export type LearningCompanionCapability =
  "coach" | "builder" | "debugger" | "explainer" | "challenger" | "reflector";
export type LearningCompanionScaffoldLevel = 0 | TutorHintLevel;

export interface LearningCompanionMissionContext extends TutorMissionContext {
  readonly learningObjective: string;
}

export interface LearningCompanionRuntimeContext {
  readonly outcome: RunOutcome;
  readonly stepsUsed: number;
  readonly finalWorld: WorldState;
  readonly observations: readonly RuntimeObservation[];
  readonly error?: {
    readonly code: string;
    readonly nodeId?: string;
    readonly message: string;
  };
}

export interface LearningCompanionRuntimeFact {
  readonly id: string;
  readonly observationIndex?: number;
  readonly nodeId?: string;
  readonly fact: string;
}

export interface LearningCompanionScaffoldHistoryEntry {
  readonly capability: LearningCompanionCapability;
  readonly level: LearningCompanionScaffoldLevel;
  readonly concept?: MissionConcept;
  readonly nodeId?: string;
}

export interface LearningCompanionRequest {
  readonly schema: LearningCompanionRequestSchemaVersion;
  readonly capability: LearningCompanionCapability;
  readonly mission: LearningCompanionMissionContext;
  readonly program: ProjectProgram;
  readonly selectedNodeIds: readonly string[];
  readonly runtime?: LearningCompanionRuntimeContext;
  readonly runtimeFacts: readonly LearningCompanionRuntimeFact[];
  readonly scaffoldHistory: readonly LearningCompanionScaffoldHistoryEntry[];
  readonly learnerIntent?: string;
  readonly reading?: TutorReadingConfig;
}

export interface LearningCompanionMetadata {
  readonly capability: LearningCompanionCapability;
  readonly scaffoldLevel: LearningCompanionScaffoldLevel;
  readonly provenance: "deterministic-fake" | "local-provider" | "remote-provider";
  readonly uncertainty: "low" | "medium" | "high";
}

export interface LearningCompanionResponseBase {
  readonly schema: LearningCompanionResponseSchemaVersion;
  readonly capability: LearningCompanionCapability;
  readonly message: string;
  readonly nodeIds: readonly string[];
  readonly concepts: readonly MissionConcept[];
  readonly metadata: LearningCompanionMetadata;
}

export interface LearningCompanionCoachResponse extends LearningCompanionResponseBase {
  readonly capability: "coach";
  readonly payload: {
    readonly kind: "question";
    readonly question: string;
  };
}

export interface LearningCompanionBuilderResponse extends LearningCompanionResponseBase {
  readonly capability: "builder";
  readonly payload: {
    readonly kind: "program-proposal";
    readonly proposal: ProgramProposal;
    readonly reviewState: "proposed";
    readonly validation: {
      readonly status: "valid" | "invalid";
      readonly errors: readonly string[];
    };
    readonly preview: {
      readonly summary: string;
      readonly affectedNodeIds: readonly string[];
    };
  };
}

export interface LearningCompanionDebuggerResponse extends LearningCompanionResponseBase {
  readonly capability: "debugger";
  readonly payload: {
    readonly kind: "evidence-grounded-debug";
    readonly facts: readonly LearningCompanionRuntimeFact[];
    readonly suggestions: readonly string[];
  };
}

export interface LearningCompanionExplainerResponse extends LearningCompanionResponseBase {
  readonly capability: "explainer";
  readonly payload: {
    readonly kind: "explanation";
    readonly explanation: string;
  };
}

export interface LearningCompanionChallengerResponse extends LearningCompanionResponseBase {
  readonly capability: "challenger";
  readonly payload: {
    readonly kind: "prediction";
    readonly prompt: string;
  };
}

export interface LearningCompanionReflectorResponse extends LearningCompanionResponseBase {
  readonly capability: "reflector";
  readonly payload: {
    readonly kind: "reflection";
    readonly prompt: string;
  };
}

export type LearningCompanionResponse =
  | LearningCompanionCoachResponse
  | LearningCompanionBuilderResponse
  | LearningCompanionDebuggerResponse
  | LearningCompanionExplainerResponse
  | LearningCompanionChallengerResponse
  | LearningCompanionReflectorResponse;

export class LearningCompanionContractValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "LearningCompanionContractValidationError";
    this.path = path;
  }
}

const CAPABILITIES = new Set<LearningCompanionCapability>([
  "coach",
  "builder",
  "debugger",
  "explainer",
  "challenger",
  "reflector",
]);
const CONCEPTS = new Set<MissionConcept>([
  "sequence",
  "events",
  "movement",
  "repetition",
  "conditions",
]);
const OUTCOMES = new Set<RunOutcome>(["completed", "budget-exceeded", "stopped"]);

export function createLearningCompanionRequest(
  input: Omit<LearningCompanionRequest, "schema">,
): LearningCompanionRequest {
  return validateLearningCompanionRequest({
    schema: LEARNING_COMPANION_REQUEST_SCHEMA_VERSION,
    ...input,
  });
}

export function createLearningCompanionResponse(
  input: Omit<LearningCompanionResponse, "schema">,
): LearningCompanionResponse {
  return validateLearningCompanionResponse({
    schema: LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION,
    ...input,
  } as LearningCompanionResponse);
}

export function parseLearningCompanionResponse(providerOutput: unknown): LearningCompanionResponse {
  return validateLearningCompanionResponse(providerOutput as LearningCompanionResponse);
}

export function assertLearningCompanionProviderContract(
  providerName: string,
  makeResponse: () => unknown,
): LearningCompanionResponse {
  assertBoundedString(providerName, "providerName", 1, 80);
  return parseLearningCompanionResponse(makeResponse());
}

export function createLearningCompanionRequestFromTutorRequest(
  request: TutorRequest,
): LearningCompanionRequest {
  return createLearningCompanionRequest({
    capability: "coach",
    mission: {
      id: request.mission.id,
      version: request.mission.version,
      concepts: request.mission.concepts,
      learningObjective: request.mission.concepts.join(", "),
    },
    program: request.program,
    selectedNodeIds: firstUsefulNodeIds(request),
    runtime: request.runtime,
    runtimeFacts: runtimeFactsFromRuntime(request.runtime),
    scaffoldHistory: request.hintHistory.map((entry) => ({
      capability: "coach",
      level: entry.level,
      ...(entry.concept === undefined ? {} : { concept: entry.concept }),
      ...(entry.nodeId === undefined ? {} : { nodeId: entry.nodeId }),
    })),
    ...(request.learnerQuestion === undefined ? {} : { learnerIntent: request.learnerQuestion }),
    ...(request.reading === undefined ? {} : { reading: request.reading }),
  });
}

export function createTutorResponseFromLearningCompanionResponse(
  response: LearningCompanionResponse,
): TutorResponse {
  const validated = validateLearningCompanionResponse(response);
  return {
    schema: "agorix/tutor-response/v1",
    hintLevel: toTutorHintLevel(validated.metadata.scaffoldLevel),
    message: validated.message,
    nodeIds: validated.nodeIds,
    concepts: validated.concepts,
  };
}

export function createDeterministicLearningCompanionResponse(
  request: LearningCompanionRequest,
): LearningCompanionResponse {
  const validated = validateLearningCompanionRequest(request);
  switch (validated.capability) {
    case "coach":
      return createCoachResponse(validated);
    case "builder":
      return createBuilderResponse(validated);
    case "debugger":
      return createDebuggerResponse(validated);
    case "explainer":
      return createTextResponse(
        validated,
        "explainer",
        "explanation",
        `This program is working on ${validated.mission.learningObjective}. Compare each block with the visible result.`,
      );
    case "challenger":
      return createTextResponse(
        validated,
        "challenger",
        "prediction",
        "Before running again, what do you predict the sprite will do first?",
      );
    case "reflector":
      return createTextResponse(
        validated,
        "reflector",
        "reflection",
        "What changed in your program, and what did the runtime prove?",
      );
  }
}

export function validateLearningCompanionRequest(
  request: LearningCompanionRequest,
): LearningCompanionRequest {
  assertPlainObject(request, "$", [
    "schema",
    "capability",
    "mission",
    "program",
    "selectedNodeIds",
    "runtime",
    "runtimeFacts",
    "scaffoldHistory",
    "learnerIntent",
    "reading",
  ]);
  if (request.schema !== LEARNING_COMPANION_REQUEST_SCHEMA_VERSION) {
    fail("$.schema", `expected ${LEARNING_COMPANION_REQUEST_SCHEMA_VERSION}`);
  }
  assertCapability(request.capability, "$.capability");
  assertMission(request.mission, "$.mission");
  validateProgram(request.program);
  assertStringArray(request.selectedNodeIds, "$.selectedNodeIds");
  if (request.runtime !== undefined) {
    assertRuntime(request.runtime, "$.runtime");
  }
  assertRuntimeFacts(request.runtimeFacts, "$.runtimeFacts");
  assertScaffoldHistory(request.scaffoldHistory, "$.scaffoldHistory");
  if (request.learnerIntent !== undefined) {
    assertBoundedString(request.learnerIntent, "$.learnerIntent", 1, 600);
  }
  if (request.reading !== undefined) {
    assertReading(request.reading, "$.reading");
  }
  return request;
}

export function validateLearningCompanionResponse(
  response: LearningCompanionResponse,
): LearningCompanionResponse {
  assertPlainObject(response, "$", [
    "schema",
    "capability",
    "message",
    "nodeIds",
    "concepts",
    "metadata",
    "payload",
  ]);
  if (response.schema !== LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION) {
    fail("$.schema", `expected ${LEARNING_COMPANION_RESPONSE_SCHEMA_VERSION}`);
  }
  assertCapability(response.capability, "$.capability");
  assertBoundedString(response.message, "$.message", 1, 1_000);
  assertStringArray(response.nodeIds, "$.nodeIds");
  assertConcepts(response.concepts, "$.concepts", true);
  assertMetadata(response.metadata, response.capability);
  assertPayload(response.payload, response.capability);
  return response;
}

function createCoachResponse(request: LearningCompanionRequest): LearningCompanionCoachResponse {
  const level = nextScaffoldLevel(request.scaffoldHistory);
  const message =
    level === 1
      ? "What should happen first when you run this program?"
      : "Look at the highlighted program area, then compare it with the runtime result.";
  return createLearningCompanionResponse({
    capability: "coach",
    message,
    nodeIds: request.selectedNodeIds,
    concepts: request.mission.concepts.slice(0, 2),
    metadata: metadata("coach", level),
    payload: { kind: "question", question: message },
  }) as LearningCompanionCoachResponse;
}

function createBuilderResponse(
  request: LearningCompanionRequest,
): LearningCompanionBuilderResponse {
  const proposal = createProgramProposal({
    id: "deterministic-builder-proposal",
    baseProgram: request.program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: "Try one visible movement step",
    rationale: "This is a proposal for the learner to inspect before changing accepted state.",
    affectedNodeIds: ["scripts[0]/statements[0]"],
    operations: [
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "move", steps: 10 },
      },
    ],
  });
  return createLearningCompanionResponse({
    capability: "builder",
    message: "Here is a proposal you can inspect before changing your accepted program.",
    nodeIds: proposal.affectedNodeIds,
    concepts: request.mission.concepts.slice(0, 1),
    metadata: metadata("builder", 4),
    payload: {
      kind: "program-proposal",
      proposal,
      reviewState: "proposed",
      validation: { status: "valid", errors: [] },
      preview: {
        summary: "Append one Move block as a proposal.",
        affectedNodeIds: proposal.affectedNodeIds,
      },
    },
  }) as LearningCompanionBuilderResponse;
}

function createDebuggerResponse(
  request: LearningCompanionRequest,
): LearningCompanionDebuggerResponse {
  const facts =
    request.runtimeFacts.length > 0
      ? request.runtimeFacts
      : request.runtime === undefined
        ? []
        : runtimeFactsFromRuntime(request.runtime).slice(0, 2);
  return createLearningCompanionResponse({
    capability: "debugger",
    message: "Use the runtime facts first, then decide what to try next.",
    nodeIds: facts.flatMap((fact) => (fact.nodeId === undefined ? [] : [fact.nodeId])),
    concepts: request.mission.concepts.slice(0, 2),
    metadata: metadata("debugger", 3),
    payload: {
      kind: "evidence-grounded-debug",
      facts,
      suggestions: ["Change one thing, run again, and compare the new evidence."],
    },
  }) as LearningCompanionDebuggerResponse;
}

function createTextResponse(
  request: LearningCompanionRequest,
  capability: "explainer" | "challenger" | "reflector",
  kind: "explanation" | "prediction" | "reflection",
  text: string,
):
  | LearningCompanionExplainerResponse
  | LearningCompanionChallengerResponse
  | LearningCompanionReflectorResponse {
  const payload = kind === "explanation" ? { kind, explanation: text } : { kind, prompt: text };
  return createLearningCompanionResponse({
    capability,
    message: text,
    nodeIds: request.selectedNodeIds,
    concepts: request.mission.concepts.slice(0, 2),
    metadata: metadata(capability, capability === "explainer" ? 2 : 1),
    payload,
  } as Omit<LearningCompanionResponse, "schema">) as
    | LearningCompanionExplainerResponse
    | LearningCompanionChallengerResponse
    | LearningCompanionReflectorResponse;
}

function runtimeFactsFromRuntime(
  runtime: LearningCompanionRuntimeContext | TutorRuntimeContext,
): readonly LearningCompanionRuntimeFact[] {
  return runtime.observations.slice(0, 5).map((observation, index) => ({
    id: `runtime-observation-${index}`,
    observationIndex: index,
    nodeId: observation.nodeId,
    fact: `Runtime observed ${observation.kind} at step ${observation.step}.`,
  }));
}

function firstUsefulNodeIds(request: TutorRequest): readonly string[] {
  const traceNode = [...request.runtime.observations]
    .reverse()
    .find((observation) => observation.nodeId !== "$" && observation.statementType !== undefined);
  if (traceNode !== undefined) {
    return [traceNode.nodeId];
  }
  return request.program.scripts[0]?.statements[0] === undefined
    ? []
    : ["scripts[0]/statements[0]"];
}

function nextScaffoldLevel(
  history: readonly LearningCompanionScaffoldHistoryEntry[],
): TutorHintLevel {
  const highest = history.reduce((level, entry) => Math.max(level, entry.level), 0);
  return Math.min(highest + 1, 5) as TutorHintLevel;
}

function metadata(
  capability: LearningCompanionCapability,
  scaffoldLevel: LearningCompanionScaffoldLevel,
): LearningCompanionMetadata {
  return {
    capability,
    scaffoldLevel,
    provenance: "deterministic-fake",
    uncertainty: "low",
  };
}

function toTutorHintLevel(level: LearningCompanionScaffoldLevel): TutorHintLevel {
  return level === 0 ? 1 : level;
}

function assertMission(value: LearningCompanionMissionContext, path: string): void {
  assertPlainObject(value, path, ["id", "version", "concepts", "learningObjective"]);
  assertBoundedString(value.id, `${path}.id`, 1, 120);
  assertPositiveInteger(value.version, `${path}.version`);
  assertConcepts(value.concepts, `${path}.concepts`, false);
  assertBoundedString(value.learningObjective, `${path}.learningObjective`, 1, 240);
}

function assertRuntime(value: LearningCompanionRuntimeContext, path: string): void {
  assertPlainObject(value, path, ["outcome", "stepsUsed", "finalWorld", "observations", "error"]);
  if (!OUTCOMES.has(value.outcome)) {
    fail(`${path}.outcome`, "expected runtime outcome");
  }
  assertNonNegativeInteger(value.stepsUsed, `${path}.stepsUsed`);
  assertPlainObject(value.finalWorld, `${path}.finalWorld`);
  if (!Array.isArray(value.observations)) {
    fail(`${path}.observations`, "expected observations array");
  }
  value.observations.forEach((observation, index) => {
    assertPlainObject(observation, `${path}.observations[${index}]`);
    const observed = observation as unknown as RuntimeObservation;
    assertBoundedString(observed.nodeId, `${path}.observations[${index}].nodeId`, 1, 160);
  });
  if (value.error !== undefined) {
    assertPlainObject(value.error, `${path}.error`, ["code", "nodeId", "message"]);
    assertBoundedString(value.error.code, `${path}.error.code`, 1, 80);
    assertBoundedString(value.error.message, `${path}.error.message`, 1, 400);
    if (value.error.nodeId !== undefined) {
      assertBoundedString(value.error.nodeId, `${path}.error.nodeId`, 1, 160);
    }
  }
}

function assertRuntimeFacts(value: readonly LearningCompanionRuntimeFact[], path: string): void {
  if (!Array.isArray(value)) {
    fail(path, "expected runtime facts array");
  }
  value.forEach((fact, index) => {
    const factPath = `${path}[${index}]`;
    assertPlainObject(fact, factPath, ["id", "observationIndex", "nodeId", "fact"]);
    const runtimeFact = fact as unknown as LearningCompanionRuntimeFact;
    assertBoundedString(runtimeFact.id, `${factPath}.id`, 1, 120);
    if (runtimeFact.observationIndex !== undefined) {
      assertNonNegativeInteger(runtimeFact.observationIndex, `${factPath}.observationIndex`);
    }
    if (runtimeFact.nodeId !== undefined) {
      assertBoundedString(runtimeFact.nodeId, `${factPath}.nodeId`, 1, 160);
    }
    assertBoundedString(runtimeFact.fact, `${factPath}.fact`, 1, 400);
  });
}

function assertScaffoldHistory(
  value: readonly LearningCompanionScaffoldHistoryEntry[],
  path: string,
): void {
  if (!Array.isArray(value)) {
    fail(path, "expected scaffold history array");
  }
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    assertPlainObject(entry, entryPath, ["capability", "level", "concept", "nodeId"]);
    const historyEntry = entry as unknown as LearningCompanionScaffoldHistoryEntry;
    assertCapability(historyEntry.capability, `${entryPath}.capability`);
    assertScaffoldLevel(historyEntry.level, `${entryPath}.level`);
    if (historyEntry.concept !== undefined && !CONCEPTS.has(historyEntry.concept)) {
      fail(`${entryPath}.concept`, "expected supported concept");
    }
    if (historyEntry.nodeId !== undefined) {
      assertBoundedString(historyEntry.nodeId, `${entryPath}.nodeId`, 1, 160);
    }
  });
}

function assertMetadata(
  value: LearningCompanionMetadata,
  capability: LearningCompanionCapability,
): void {
  assertPlainObject(value, "$.metadata", [
    "capability",
    "scaffoldLevel",
    "provenance",
    "uncertainty",
  ]);
  if (value.capability !== capability) {
    fail("$.metadata.capability", "expected metadata capability to match response capability");
  }
  assertScaffoldLevel(value.scaffoldLevel, "$.metadata.scaffoldLevel");
  if (
    !(["deterministic-fake", "local-provider", "remote-provider"] as const).includes(
      value.provenance,
    )
  ) {
    fail("$.metadata.provenance", "expected supported provenance");
  }
  if (!(["low", "medium", "high"] as const).includes(value.uncertainty)) {
    fail("$.metadata.uncertainty", "expected supported uncertainty");
  }
}

function assertPayload(value: unknown, capability: LearningCompanionCapability): void {
  switch (capability) {
    case "coach":
      assertPlainObject(value, "$.payload", ["kind", "question"]);
      if (value.kind !== "question") fail("$.payload.kind", "expected question");
      assertBoundedString(value.question as string, "$.payload.question", 1, 800);
      break;
    case "builder":
      assertPlainObject(value, "$.payload", [
        "kind",
        "proposal",
        "reviewState",
        "validation",
        "preview",
      ]);
      if (value.kind !== "program-proposal") fail("$.payload.kind", "expected program-proposal");
      validateProgramProposal(value.proposal as ProgramProposal);
      if (value.reviewState !== "proposed") fail("$.payload.reviewState", "expected proposed");
      assertBuilderValidation(value.validation);
      assertBuilderPreview(value.preview);
      break;
    case "debugger":
      assertPlainObject(value, "$.payload", ["kind", "facts", "suggestions"]);
      if (value.kind !== "evidence-grounded-debug") {
        fail("$.payload.kind", "expected evidence-grounded-debug");
      }
      assertRuntimeFacts(value.facts as readonly LearningCompanionRuntimeFact[], "$.payload.facts");
      assertStringArray(value.suggestions as readonly string[], "$.payload.suggestions");
      break;
    case "explainer":
      assertPlainObject(value, "$.payload", ["kind", "explanation"]);
      if (value.kind !== "explanation") fail("$.payload.kind", "expected explanation");
      assertBoundedString(value.explanation as string, "$.payload.explanation", 1, 1_000);
      break;
    case "challenger":
      assertPlainObject(value, "$.payload", ["kind", "prompt"]);
      if (value.kind !== "prediction") fail("$.payload.kind", "expected prediction");
      assertBoundedString(value.prompt as string, "$.payload.prompt", 1, 800);
      break;
    case "reflector":
      assertPlainObject(value, "$.payload", ["kind", "prompt"]);
      if (value.kind !== "reflection") fail("$.payload.kind", "expected reflection");
      assertBoundedString(value.prompt as string, "$.payload.prompt", 1, 800);
      break;
  }
}

function assertBuilderValidation(value: unknown): void {
  assertPlainObject(value, "$.payload.validation", ["status", "errors"]);
  if (value.status !== "valid" && value.status !== "invalid") {
    fail("$.payload.validation.status", "expected validation status");
  }
  assertStringArray(value.errors as readonly string[], "$.payload.validation.errors");
}

function assertBuilderPreview(value: unknown): void {
  assertPlainObject(value, "$.payload.preview", ["summary", "affectedNodeIds"]);
  assertBoundedString(value.summary as string, "$.payload.preview.summary", 1, 400);
  assertStringArray(
    value.affectedNodeIds as readonly string[],
    "$.payload.preview.affectedNodeIds",
  );
}

function assertReading(value: TutorReadingConfig, path: string): void {
  assertPlainObject(value, path, ["locale", "readingLevel"]);
  assertBoundedString(value.locale, `${path}.locale`, 2, 35);
  if (
    value.readingLevel !== undefined &&
    !(["early-reader", "middle-grade", "plain"] as const).includes(value.readingLevel)
  ) {
    fail(`${path}.readingLevel`, "expected supported reading level");
  }
}

function assertCapability(
  value: unknown,
  path: string,
): asserts value is LearningCompanionCapability {
  if (typeof value !== "string" || !CAPABILITIES.has(value as LearningCompanionCapability)) {
    fail(path, "expected learning companion capability");
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

function assertStringArray(value: readonly string[], path: string): void {
  if (!Array.isArray(value)) {
    fail(path, "expected string array");
  }
  value.forEach((item, index) => assertBoundedString(item, `${path}[${index}]`, 1, 160));
}

function assertScaffoldLevel(value: number, path: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    fail(path, "expected scaffold level 0-5");
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
  allowedKeys?: readonly string[],
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "expected object");
  }
  if (allowedKeys !== undefined) {
    const allowed = new Set(allowedKeys);
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        fail(`${path}.${key}`, "unexpected provider-specific field");
      }
    }
  }
}

function fail(path: string, message: string): never {
  throw new LearningCompanionContractValidationError(path, message);
}
