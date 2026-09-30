/**
 * Intent-to-plan learning dialogue (issue #86).
 *
 * The learner expresses and decomposes intent *before* any code or program
 * structure is proposed. This module is the provider-neutral contract plus the
 * deterministic fake planner that drives it:
 *
 * - a clear intent produces a decomposed plan with no clarifying question;
 * - an ambiguous intent produces one pedagogically useful clarification;
 * - planning and every learner decision are read-only with respect to the
 *   canonical program: the plan is anchored by `baseProgramHash`, and each
 *   path re-proves that hash against a pre-decision snapshot instead of
 *   trusting the caller;
 * - the learner may edit or reject the plan before anything reaches the editor.
 *
 * Provider/model identity is an implementation detail: the request and response
 * contracts carry no provider fields, and the deterministic fake needs no
 * credentials, no network and no child personal data.
 */
import { normalizeLocale, type MissionConcept, type SupportedLocale } from "@agorix/curriculum";
import { programSemanticHash } from "@agorix/proposals";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import {
  assertNoHiddenProviderAction,
  assertNoPersonalDataRequest,
  type TutorReadingConfig,
} from "./index.js";

export const INTENT_PLAN_REQUEST_SCHEMA_VERSION = "agorix/intent-plan-request/v1";
export const INTENT_PLAN_RESPONSE_SCHEMA_VERSION = "agorix/intent-plan-response/v1";
export const INTENT_PLAN_SCHEMA_VERSION = "agorix/intent-plan/v1";
export const INTENT_PLAN_AUDIT_SCHEMA_VERSION = "agorix/intent-plan-audit/v1";

export type IntentPlanRequestSchemaVersion = typeof INTENT_PLAN_REQUEST_SCHEMA_VERSION;
export type IntentPlanResponseSchemaVersion = typeof INTENT_PLAN_RESPONSE_SCHEMA_VERSION;
export type IntentPlanSchemaVersion = typeof INTENT_PLAN_SCHEMA_VERSION;

export type IntentPlanStatus = "proposed" | "accepted" | "rejected";
export type IntentPlanDecision = "edit" | "accept" | "reject";

/** Why the planner asked instead of producing a plan. */
export type IntentPlanClarificationReason = "missing-action" | "vague-outcome" | "ambiguous-order";

export type IntentPlanProvenance = "deterministic-fake" | "local-provider" | "remote-provider";
export type IntentPlanUncertainty = "low" | "medium" | "high";

export interface IntentPlanMissionContext {
  readonly id: string;
  readonly version: number;
  readonly learningObjective: string;
  readonly concepts: readonly MissionConcept[];
}

export interface IntentPlanRequest {
  readonly schema: IntentPlanRequestSchemaVersion;
  readonly learnerIntent: string;
  readonly mission: IntentPlanMissionContext;
  readonly program: ProjectProgram;
  readonly selectedNodeIds: readonly string[];
  readonly priorClarifications: readonly string[];
  readonly reading?: TutorReadingConfig;
}

export interface IntentPlanStep {
  readonly id: string;
  /** 1-based position in the learner's own order. */
  readonly order: number;
  /** The learner's own words for this step, never invented program structure. */
  readonly description: string;
  /** Present only when the step maps to a concept this mission teaches. */
  readonly concept?: MissionConcept;
  /** Present only when the step maps to an existing canonical node. */
  readonly nodeId?: string;
  readonly rationale: string;
}

export interface IntentPlan {
  readonly schema: IntentPlanSchemaVersion;
  readonly id: string;
  /** Semantic hash of the canonical program the plan was written against. */
  readonly baseProgramHash: string;
  readonly status: IntentPlanStatus;
  readonly revision: number;
  readonly learnerIntent: string;
  readonly learningObjective: string;
  readonly concepts: readonly MissionConcept[];
  readonly steps: readonly IntentPlanStep[];
  /** Learner clauses left out of `steps` by the deterministic step cap. */
  readonly omittedSteps: number;
}

export interface IntentPlanClarification {
  readonly reason: IntentPlanClarificationReason;
  readonly question: string;
  /** Child-choosable answers; learner wording when they come from the intent. */
  readonly options: readonly string[];
}

export interface IntentPlanMetadata {
  readonly provenance: IntentPlanProvenance;
  readonly uncertainty: IntentPlanUncertainty;
  readonly questionsAsked: number;
}

export interface IntentPlanClarificationResponse {
  readonly schema: IntentPlanResponseSchemaVersion;
  readonly kind: "clarification";
  readonly message: string;
  readonly metadata: IntentPlanMetadata;
  readonly clarification: IntentPlanClarification;
}

export interface IntentPlanResponseWithPlan {
  readonly schema: IntentPlanResponseSchemaVersion;
  readonly kind: "plan";
  readonly message: string;
  readonly metadata: IntentPlanMetadata;
  readonly plan: IntentPlan;
}

export type IntentPlanResponse = IntentPlanClarificationResponse | IntentPlanResponseWithPlan;

export type IntentPlanResponseInput =
  Omit<IntentPlanClarificationResponse, "schema"> | Omit<IntentPlanResponseWithPlan, "schema">;

export interface IntentPlanAuditEvent {
  readonly schema: typeof INTENT_PLAN_AUDIT_SCHEMA_VERSION;
  readonly planId: string;
  readonly decision: IntentPlanDecision;
  readonly baseProgramHash: string;
  readonly programHash: string;
  readonly revision: number;
}

export interface IntentPlanDecisionResult {
  readonly plan: IntentPlan;
  readonly program: ProjectProgram;
  readonly audit: IntentPlanAuditEvent;
}

export type IntentPlanAction = "edit" | "confirm" | "reject";

export interface IntentPlanStepView {
  readonly id: string;
  readonly order: number;
  readonly description: string;
  readonly rationale: string;
  readonly concept?: MissionConcept;
  readonly nodeId?: string;
}

/** Surface-neutral view of the plan; display labels stay in the UI catalog. */
export interface IntentPlanCardView {
  readonly planId: string;
  readonly status: IntentPlanStatus;
  readonly learningObjective: string;
  readonly concepts: readonly MissionConcept[];
  readonly steps: readonly IntentPlanStepView[];
  readonly actions: readonly IntentPlanAction[];
}

export type IntentPlanErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "INVALID_PLAN"
  | "INVALID_CLARIFICATION"
  | "UNKNOWN_STEP"
  | "PLAN_NOT_EDITABLE"
  | "STALE_PLAN"
  | "CANONICAL_MUTATION";

export class IntentPlanValidationError extends Error {
  readonly code: IntentPlanErrorCode;
  readonly path: string;

  constructor(code: IntentPlanErrorCode, path: string, message: string) {
    super(`${code} ${path}: ${message}`);
    this.name = "IntentPlanValidationError";
    this.code = code;
    this.path = path;
  }
}

const CONCEPTS = new Set<MissionConcept>([
  "sequence",
  "events",
  "movement",
  "repetition",
  "conditions",
]);
const CLARIFICATION_REASONS = new Set<IntentPlanClarificationReason>([
  "missing-action",
  "vague-outcome",
  "ambiguous-order",
]);
const STATUSES = new Set<IntentPlanStatus>(["proposed", "accepted", "rejected"]);
const ACTIONS: readonly IntentPlanAction[] = ["edit", "confirm", "reject"];

/** Deterministic plan bound; extra learner clauses are reported, never dropped silently. */
export const MAX_INTENT_PLAN_STEPS = 8;

interface IntentAction {
  readonly concept: MissionConcept;
  readonly statementType?: Statement["type"];
}

/**
 * Bilingual, POC-sized action vocabulary. A clause matching nothing stays a
 * learner-authored step instead of being rewritten into invented structure.
 */
const ACTION_VOCABULARY: Readonly<Record<string, IntentAction>> = {
  move: { concept: "movement", statementType: "move" },
  walk: { concept: "movement", statementType: "move" },
  run: { concept: "movement", statementType: "move" },
  go: { concept: "movement", statementType: "move" },
  jump: { concept: "movement", statementType: "move" },
  travel: { concept: "movement", statementType: "move" },
  head: { concept: "movement", statementType: "move" },
  closer: { concept: "movement", statementType: "move" },
  reach: { concept: "movement", statementType: "move" },
  mover: { concept: "movement", statementType: "move" },
  caminar: { concept: "movement", statementType: "move" },
  avanzar: { concept: "movement", statementType: "move" },
  saltar: { concept: "movement", statementType: "move" },
  llegar: { concept: "movement", statementType: "move" },
  girar: { concept: "movement", statementType: "turn" },
  rotar: { concept: "movement", statementType: "turn" },
  vuelta: { concept: "movement", statementType: "turn" },
  turn: { concept: "movement", statementType: "turn" },
  rotate: { concept: "movement", statementType: "turn" },
  spin: { concept: "movement", statementType: "turn" },
  face: { concept: "movement", statementType: "turn" },
  repeat: { concept: "repetition", statementType: "repeat" },
  loop: { concept: "repetition", statementType: "repeat" },
  again: { concept: "repetition", statementType: "repeat" },
  repetir: { concept: "repetition", statementType: "repeat" },
  if: { concept: "conditions", statementType: "if" },
  check: { concept: "conditions", statementType: "if" },
  unless: { concept: "conditions", statementType: "if" },
  decide: { concept: "conditions", statementType: "if" },
  si: { concept: "conditions", statementType: "if" },
  cuando: { concept: "conditions", statementType: "if" },
  decidir: { concept: "conditions", statementType: "if" },
  start: { concept: "events" },
  begin: { concept: "events" },
  press: { concept: "events" },
  empezar: { concept: "events" },
  comenzar: { concept: "events" },
  pressionar: { concept: "events" },
};

const VAGUE_TOKENS = new Set([
  "better",
  "nicer",
  "nice",
  "cool",
  "fun",
  "good",
  "somehow",
  "magic",
  "awesome",
  "mejor",
  "mejorar",
  "divertido",
  "genial",
  "chido",
  "magico",
]);

const ORDER_WORDS = new Set(["then", "despues", "luego", "first", "after", "before", "primero"]);
const BARE_CONJUNCTIONS = new Set(["and", "y", "e"]);
const PUNCTUATION = /[,;.!?]/;

const CONCEPT_LABELS: Readonly<Record<SupportedLocale, Readonly<Record<MissionConcept, string>>>> =
  {
    en: {
      sequence: "sequence",
      events: "events",
      movement: "movement",
      repetition: "repetition",
      conditions: "conditions",
    },
    es: {
      sequence: "secuencia",
      events: "eventos",
      movement: "movimiento",
      repetition: "repeticion",
      conditions: "condiciones",
    },
  };

interface Clause {
  readonly text: string;
  readonly action?: IntentAction;
}

export function createIntentPlanRequest(
  input: Omit<IntentPlanRequest, "schema">,
): IntentPlanRequest {
  return validateIntentPlanRequest({ schema: INTENT_PLAN_REQUEST_SCHEMA_VERSION, ...input });
}

export function validateIntentPlanRequest(request: IntentPlanRequest): IntentPlanRequest {
  assertPlainObject(request, "INVALID_REQUEST", "$", [
    "schema",
    "learnerIntent",
    "mission",
    "program",
    "selectedNodeIds",
    "priorClarifications",
    "reading",
  ]);
  if (request.schema !== INTENT_PLAN_REQUEST_SCHEMA_VERSION) {
    fail("INVALID_REQUEST", "$.schema", `expected ${INTENT_PLAN_REQUEST_SCHEMA_VERSION}`);
  }
  assertBoundedString(request.learnerIntent, "INVALID_REQUEST", "$.learnerIntent", 1, 600);
  assertMission(request.mission, "$.mission");
  validateProgram(request.program);
  assertStringArray(request.selectedNodeIds, "INVALID_REQUEST", "$.selectedNodeIds", 160);
  assertStringArray(request.priorClarifications, "INVALID_REQUEST", "$.priorClarifications", 800);
  if (request.reading !== undefined) {
    assertReading(request.reading, "$.reading");
  }
  return request;
}

/**
 * Deterministic fake planner (AC-006): same request in, same plan out, with no
 * provider, credentials or child personal data. A clear intent never earns a
 * question; an ambiguous one earns exactly one clarification.
 */
export function createDeterministicIntentPlan(request: IntentPlanRequest): IntentPlanResponse {
  const validated = validateIntentPlanRequest(request);
  const snapshot = structuredClone(validated.program) as ProjectProgram;
  const program = validateProgram(validated.program);
  const locale = normalizeLocale(validated.reading?.locale);
  const clauses = splitClauses(validated.learnerIntent);
  const response = planOrClarify(validated, program, clauses, locale);
  assertPlanDidNotMutateProgram(snapshot, validateProgram(validated.program));
  return response;
}

export function createIntentPlanResponse(input: IntentPlanResponseInput): IntentPlanResponse {
  return validateIntentPlanResponse({
    schema: INTENT_PLAN_RESPONSE_SCHEMA_VERSION,
    ...input,
  } as IntentPlanResponse);
}

export function parseIntentPlanResponse(providerOutput: unknown): IntentPlanResponse {
  return validateIntentPlanResponse(providerOutput as IntentPlanResponse);
}

export function validateIntentPlanResponse(response: IntentPlanResponse): IntentPlanResponse {
  assertPlainObject(response, "INVALID_RESPONSE", "$", [
    "schema",
    "kind",
    "message",
    "metadata",
    "clarification",
    "plan",
  ]);
  if (response.schema !== INTENT_PLAN_RESPONSE_SCHEMA_VERSION) {
    fail("INVALID_RESPONSE", "$.schema", `expected ${INTENT_PLAN_RESPONSE_SCHEMA_VERSION}`);
  }
  assertBoundedString(response.message, "INVALID_RESPONSE", "$.message", 1, 1_000);
  assertMetadata(response.metadata, "$.metadata");
  if (response.kind === "clarification") {
    assertPlainObject(response, "INVALID_RESPONSE", "$", [
      "schema",
      "kind",
      "message",
      "metadata",
      "clarification",
    ]);
    assertClarification(response.clarification, "$.clarification");
  } else if (response.kind === "plan") {
    assertPlainObject(response, "INVALID_RESPONSE", "$", [
      "schema",
      "kind",
      "message",
      "metadata",
      "plan",
    ]);
    validateIntentPlan(response.plan);
  } else {
    fail("INVALID_RESPONSE", "$.kind", "expected clarification or plan");
  }
  assertPlanTextIsChildSafe(response);
  return response;
}

export function validateIntentPlan(plan: IntentPlan): IntentPlan {
  assertPlainObject(plan, "INVALID_PLAN", "$", [
    "schema",
    "id",
    "baseProgramHash",
    "status",
    "revision",
    "learnerIntent",
    "learningObjective",
    "concepts",
    "steps",
    "omittedSteps",
  ]);
  if (plan.schema !== INTENT_PLAN_SCHEMA_VERSION) {
    fail("INVALID_PLAN", "$.schema", `expected ${INTENT_PLAN_SCHEMA_VERSION}`);
  }
  assertBoundedString(plan.id, "INVALID_PLAN", "$.id", 1, 120);
  assertBoundedString(plan.baseProgramHash, "INVALID_PLAN", "$.baseProgramHash", 1, 120);
  if (!STATUSES.has(plan.status)) {
    fail("INVALID_PLAN", "$.status", "expected plan status");
  }
  if (!Number.isInteger(plan.revision) || plan.revision < 1) {
    fail("INVALID_PLAN", "$.revision", "expected positive integer revision");
  }
  assertBoundedString(plan.learnerIntent, "INVALID_PLAN", "$.learnerIntent", 1, 600);
  assertBoundedString(plan.learningObjective, "INVALID_PLAN", "$.learningObjective", 1, 240);
  assertConcepts(plan.concepts, "$.concepts", false);
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    fail("INVALID_PLAN", "$.steps", "expected at least one step");
  }
  if (plan.steps.length > MAX_INTENT_PLAN_STEPS) {
    fail("INVALID_PLAN", "$.steps", `expected at most ${MAX_INTENT_PLAN_STEPS} steps`);
  }
  plan.steps.forEach((step, index) => assertStep(step, `$.steps[${index}]`, index + 1));
  if (!Number.isInteger(plan.omittedSteps) || plan.omittedSteps < 0) {
    fail("INVALID_PLAN", "$.omittedSteps", "expected non-negative integer");
  }
  return plan;
}

/** Learner edits a plan step in their own words (AC-005). Program untouched. */
export function editIntentPlanStep(
  program: ProjectProgram,
  plan: IntentPlan,
  stepId: string,
  description: string,
): IntentPlanDecisionResult {
  const accepted = validateProgram(program);
  const snapshot = structuredClone(accepted) as ProjectProgram;
  const validated = validateIntentPlan(plan);
  if (validated.status !== "proposed") {
    fail("PLAN_NOT_EDITABLE", "$.status", `plan ${validated.id} is ${validated.status}`);
  }
  assertBoundedString(description, "INVALID_PLAN", "$.description", 1, 240);
  if (!validated.steps.some((step) => step.id === stepId)) {
    fail("UNKNOWN_STEP", "$.stepId", `unknown plan step ${stepId}`);
  }
  const nextPlan = validateIntentPlan({
    ...validated,
    status: "proposed",
    revision: validated.revision + 1,
    steps: validated.steps.map((step) =>
      step.id === stepId ? { ...step, description: description.trim() } : step,
    ),
  });
  return recordDecision(accepted, snapshot, nextPlan, "edit");
}

/**
 * Learner keeps the plan as the intent of record. This records a decision only:
 * the canonical program is returned unchanged, and any program structure still
 * has to travel through the proposal boundary.
 */
export function acceptIntentPlan(
  program: ProjectProgram,
  plan: IntentPlan,
): IntentPlanDecisionResult {
  const accepted = validateProgram(program);
  const snapshot = structuredClone(accepted) as ProjectProgram;
  const validated = validateIntentPlan(plan);
  assertFreshProgram(accepted, validated);
  if (validated.status !== "proposed") {
    fail("PLAN_NOT_EDITABLE", "$.status", `plan ${validated.id} is ${validated.status}`);
  }
  const nextPlan = validateIntentPlan({
    ...validated,
    status: "accepted",
    revision: validated.revision + 1,
  });
  return recordDecision(accepted, snapshot, nextPlan, "accept");
}

/** Learner rejects the plan. The canonical program stays exactly as it was. */
export function rejectIntentPlan(
  program: ProjectProgram,
  plan: IntentPlan,
): IntentPlanDecisionResult {
  const accepted = validateProgram(program);
  const snapshot = structuredClone(accepted) as ProjectProgram;
  const validated = validateIntentPlan(plan);
  const nextPlan = validateIntentPlan({
    ...validated,
    status: "rejected",
    revision: validated.revision + 1,
  });
  return recordDecision(accepted, snapshot, nextPlan, "reject");
}

export function createIntentPlanCardView(plan: IntentPlan): IntentPlanCardView {
  const validated = validateIntentPlan(plan);
  return {
    planId: validated.id,
    status: validated.status,
    learningObjective: validated.learningObjective,
    concepts: validated.concepts,
    steps: validated.steps.map((step) => ({
      id: step.id,
      order: step.order,
      description: step.description,
      rationale: step.rationale,
      ...(step.concept === undefined ? {} : { concept: step.concept }),
      ...(step.nodeId === undefined ? {} : { nodeId: step.nodeId }),
    })),
    actions: validated.status === "proposed" ? ACTIONS : ACTIONS.filter((a) => a === "reject"),
  };
}

/**
 * Structural proof for AC-003: if planning or a decision path ever changed the
 * canonical program, the semantic hash comparison fails loudly.
 */
export function assertPlanDidNotMutateProgram(before: ProjectProgram, after: ProjectProgram): void {
  const beforeHash = programSemanticHash(before);
  const afterHash = programSemanticHash(after);
  if (beforeHash !== afterHash) {
    throw new IntentPlanValidationError(
      "CANONICAL_MUTATION",
      "$.program",
      `intent planning must not mutate the canonical program (${beforeHash} -> ${afterHash})`,
    );
  }
}

function planOrClarify(
  request: IntentPlanRequest,
  program: ProjectProgram,
  clauses: readonly Clause[],
  locale: SupportedLocale,
): IntentPlanResponse {
  const messages = intentPlanMessages(locale);
  const answered = clauses.filter((clause) => clause.action !== undefined);

  if (answered.length === 0) {
    return clarificationResponse(request, "missing-action", messages.missingAction, [
      messages.optionMove,
      messages.optionTurn,
      messages.optionRepeat,
      messages.optionIfGoal,
    ]);
  }

  if (hasAmbiguousOrder(request.learnerIntent)) {
    return clarificationResponse(request, "ambiguous-order", messages.ambiguousOrder, [
      clauses[0]?.text ?? messages.optionMove,
      clauses[1]?.text ?? messages.optionTurn,
    ]);
  }

  if (answered.length === clauses.length && hasVagueTokens(request.learnerIntent)) {
    return clarificationResponse(
      request,
      "vague-outcome",
      messages.vagueOutcome,
      clauses.map((clause) => clause.text),
    );
  }

  return planResponse(request, program, clauses, locale, answered.length < clauses.length);
}

function planResponse(
  request: IntentPlanRequest,
  program: ProjectProgram,
  clauses: readonly Clause[],
  locale: SupportedLocale,
  uncertain: boolean,
): IntentPlanResponse {
  const kept = clauses.slice(0, MAX_INTENT_PLAN_STEPS);
  const omittedSteps = clauses.length - kept.length;
  const missionConcepts = new Set(request.mission.concepts);
  const nodeIds = canonicalNodeIdsByStatementType(program);
  const messages = intentPlanMessages(locale);

  const steps = kept.map((clause, index) => {
    const concept =
      clause.action !== undefined && missionConcepts.has(clause.action.concept)
        ? clause.action.concept
        : undefined;
    const nodeId =
      clause.action?.statementType === undefined
        ? undefined
        : nodeIds.get(clause.action.statementType);
    return {
      id: `intent-step-${index + 1}`,
      order: index + 1,
      description: clause.text,
      ...(concept === undefined ? {} : { concept }),
      ...(nodeId === undefined ? {} : { nodeId }),
      rationale:
        concept === undefined
          ? messages.rationaleLearnerStep
          : `${messages.rationaleConcept} ${CONCEPT_LABELS[locale][concept]}.`,
    };
  });

  const inferred = steps.flatMap((step) => (step.concept === undefined ? [] : [step.concept]));
  const concepts = [...new Set([...inferred, ...request.mission.concepts])].filter((concept) =>
    missionConcepts.has(concept),
  );
  const baseProgramHash = programSemanticHash(program);

  const plan = validateIntentPlan({
    schema: INTENT_PLAN_SCHEMA_VERSION,
    id: `intent-plan-${stableId(`${baseProgramHash}|${request.learnerIntent.trim()}`)}`,
    baseProgramHash,
    status: "proposed",
    revision: 1,
    learnerIntent: request.learnerIntent.trim(),
    learningObjective: request.mission.learningObjective,
    concepts,
    steps,
    omittedSteps,
  });

  return createIntentPlanResponse({
    kind: "plan",
    message:
      omittedSteps > 0
        ? `${messages.planReady} ${messages.planOmitted} ${omittedSteps}.`
        : messages.planReady,
    metadata: {
      provenance: "deterministic-fake",
      uncertainty: uncertain ? "medium" : "low",
      questionsAsked: request.priorClarifications.length,
    },
    plan,
  });
}

function clarificationResponse(
  request: IntentPlanRequest,
  reason: IntentPlanClarificationReason,
  question: string,
  options: readonly string[],
): IntentPlanResponse {
  return createIntentPlanResponse({
    kind: "clarification",
    message: question,
    metadata: {
      provenance: "deterministic-fake",
      uncertainty: "medium",
      questionsAsked: request.priorClarifications.length + 1,
    },
    clarification: { reason, question, options },
  });
}

function recordDecision(
  program: ProjectProgram,
  snapshot: ProjectProgram,
  plan: IntentPlan,
  decision: IntentPlanDecision,
): IntentPlanDecisionResult {
  const validatedProgram = validateProgram(program);
  assertPlanDidNotMutateProgram(snapshot, validatedProgram);
  return {
    plan,
    program: validatedProgram,
    audit: {
      schema: INTENT_PLAN_AUDIT_SCHEMA_VERSION,
      planId: plan.id,
      decision,
      baseProgramHash: plan.baseProgramHash,
      programHash: programSemanticHash(validatedProgram),
      revision: plan.revision,
    },
  };
}

function assertFreshProgram(program: ProjectProgram, plan: IntentPlan): void {
  const currentHash = programSemanticHash(program);
  if (currentHash !== plan.baseProgramHash) {
    fail(
      "STALE_PLAN",
      "$.baseProgramHash",
      `plan base ${plan.baseProgramHash} does not match current ${currentHash}`,
    );
  }
}

function splitClauses(intent: string): readonly Clause[] {
  const words = intent.split(/\s+/).filter((word) => word.length > 0);
  const parts: string[] = [];
  let current: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] as string;
    const bare = normalizeWord(word);
    const nextWord = index + 1 < words.length ? normalizeWord(words[index + 1] as string) : "";
    const isPunctuation = bare.length === 0 && PUNCTUATION.test(word);
    const isOrderWord = ORDER_WORDS.has(bare) || (bare === "and" && nextWord === "then");
    const isBareConjunction = BARE_CONJUNCTIONS.has(bare);

    if (isPunctuation || isOrderWord || isBareConjunction) {
      if (current.length > 0) {
        parts.push(current.join(" "));
        current = [];
      }
      if (bare === "and" && nextWord === "then") {
        index += 1;
      }
      continue;
    }
    current.push(word.replace(PUNCTUATION, ""));
  }
  if (current.length > 0) {
    parts.push(current.join(" "));
  }

  const clauses = parts.length > 0 ? parts : [intent.trim()];
  return clauses.map((text) => {
    const action = actionForClause(text);
    return action === undefined ? { text } : { text, action };
  });
}

function actionForClause(clause: string): IntentAction | undefined {
  for (const token of tokenize(clause)) {
    const action = ACTION_VOCABULARY[token];
    if (action !== undefined) {
      return action;
    }
  }
  return undefined;
}

/** A bare "and"/"y"/"e" joining two actions with no ordering word is ambiguous. */
function hasAmbiguousOrder(intent: string): boolean {
  const words = intent.split(/\s+/).filter((word) => word.length > 0);
  if (words.some((word) => ORDER_WORDS.has(normalizeWord(word)))) {
    return false;
  }
  const hasBareConjunction = words.some((word) => BARE_CONJUNCTIONS.has(normalizeWord(word)));
  const actionable = splitClauses(intent).filter((clause) => clause.action !== undefined);
  return hasBareConjunction && actionable.length > 1;
}

function hasVagueTokens(intent: string): boolean {
  return tokenize(intent).some((token) => VAGUE_TOKENS.has(token));
}

function tokenize(text: string): readonly string[] {
  return normalizeWord(text)
    .split(/[^a-z]+/)
    .filter((token) => token.length > 1);
}

function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function canonicalNodeIdsByStatementType(
  program: ProjectProgram,
): ReadonlyMap<Statement["type"], string> {
  const ids = new Map<Statement["type"], string>();
  program.scripts.forEach((script, scriptIndex) => {
    script.statements.forEach((statement, statementIndex) => {
      if (!ids.has(statement.type)) {
        ids.set(statement.type, `scripts[${scriptIndex}]/statements[${statementIndex}]`);
      }
    });
  });
  return ids;
}

function stableId(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function assertPlanTextIsChildSafe(response: IntentPlanResponse): void {
  const fields: Array<{ readonly path: string; readonly value: string }> = [
    { path: "$.message", value: response.message },
  ];
  if (response.kind === "clarification") {
    fields.push({ path: "$.clarification.question", value: response.clarification.question });
  } else {
    response.plan.steps.forEach((step, index) => {
      fields.push({ path: `$.plan.steps[${index}].description`, value: step.description });
      fields.push({ path: `$.plan.steps[${index}].rationale`, value: step.rationale });
    });
  }
  for (const { path, value } of fields) {
    assertNoPersonalDataRequest(value, path);
    assertNoHiddenProviderAction(value, path);
  }
}

function assertMission(value: IntentPlanMissionContext, path: string): void {
  assertPlainObject(value, "INVALID_REQUEST", path, [
    "id",
    "version",
    "learningObjective",
    "concepts",
  ]);
  assertBoundedString(value.id, "INVALID_REQUEST", `${path}.id`, 1, 120);
  if (!Number.isInteger(value.version) || value.version <= 0) {
    fail("INVALID_REQUEST", `${path}.version`, "expected positive integer");
  }
  assertBoundedString(
    value.learningObjective,
    "INVALID_REQUEST",
    `${path}.learningObjective`,
    1,
    240,
  );
  assertConcepts(value.concepts, `${path}.concepts`, false);
}

function assertStep(value: IntentPlanStep, path: string, expectedOrder: number): void {
  assertPlainObject(value, "INVALID_PLAN", path, [
    "id",
    "order",
    "description",
    "concept",
    "nodeId",
    "rationale",
  ]);
  assertBoundedString(value.id, "INVALID_PLAN", `${path}.id`, 1, 120);
  if (value.order !== expectedOrder) {
    fail("INVALID_PLAN", `${path}.order`, `expected order ${expectedOrder}`);
  }
  assertBoundedString(value.description, "INVALID_PLAN", `${path}.description`, 1, 240);
  assertBoundedString(value.rationale, "INVALID_PLAN", `${path}.rationale`, 1, 400);
  if (value.concept !== undefined && !CONCEPTS.has(value.concept)) {
    fail("INVALID_PLAN", `${path}.concept`, "expected supported concept");
  }
  if (value.nodeId !== undefined) {
    assertBoundedString(value.nodeId, "INVALID_PLAN", `${path}.nodeId`, 1, 160);
  }
}

function assertClarification(value: IntentPlanClarification, path: string): void {
  assertPlainObject(value, "INVALID_CLARIFICATION", path, ["reason", "question", "options"]);
  if (!CLARIFICATION_REASONS.has(value.reason)) {
    fail("INVALID_CLARIFICATION", `${path}.reason`, "expected clarification reason");
  }
  assertBoundedString(value.question, "INVALID_CLARIFICATION", `${path}.question`, 1, 800);
  if (!Array.isArray(value.options) || value.options.length === 0) {
    fail("INVALID_CLARIFICATION", `${path}.options`, "expected at least one option");
  }
  value.options.forEach((option, index) =>
    assertBoundedString(option, "INVALID_CLARIFICATION", `${path}.options[${index}]`, 1, 240),
  );
}

function assertMetadata(value: IntentPlanMetadata, path: string): void {
  assertPlainObject(value, "INVALID_RESPONSE", path, [
    "provenance",
    "uncertainty",
    "questionsAsked",
  ]);
  if (!["deterministic-fake", "local-provider", "remote-provider"].includes(value.provenance)) {
    fail("INVALID_RESPONSE", `${path}.provenance`, "expected supported provenance");
  }
  if (!["low", "medium", "high"].includes(value.uncertainty)) {
    fail("INVALID_RESPONSE", `${path}.uncertainty`, "expected supported uncertainty");
  }
  if (!Number.isInteger(value.questionsAsked) || value.questionsAsked < 0) {
    fail("INVALID_RESPONSE", `${path}.questionsAsked`, "expected non-negative integer");
  }
}

function assertReading(value: TutorReadingConfig, path: string): void {
  assertPlainObject(value, "INVALID_REQUEST", path, ["locale", "readingLevel"]);
  assertBoundedString(value.locale, "INVALID_REQUEST", `${path}.locale`, 2, 35);
  if (
    value.readingLevel !== undefined &&
    !["early-reader", "middle-grade", "plain"].includes(value.readingLevel)
  ) {
    fail("INVALID_REQUEST", `${path}.readingLevel`, "expected supported reading level");
  }
}

function assertConcepts(value: readonly MissionConcept[], path: string, allowEmpty: boolean): void {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(
      "INVALID_PLAN",
      path,
      allowEmpty ? "expected concepts array" : "expected at least one concept",
    );
  }
  value.forEach((concept, index) => {
    if (!CONCEPTS.has(concept)) {
      fail("INVALID_PLAN", `${path}[${index}]`, "expected supported concept");
    }
  });
}

function assertStringArray(
  value: unknown,
  code: IntentPlanErrorCode,
  path: string,
  max: number,
): void {
  if (!Array.isArray(value)) {
    fail(code, path, "expected string array");
  }
  value.forEach((item, index) => assertBoundedString(item, code, `${path}[${index}]`, 1, max));
}

function assertBoundedString(
  value: unknown,
  code: IntentPlanErrorCode,
  path: string,
  min: number,
  max: number,
): void {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    fail(code, path, `expected string length ${min}-${max}`);
  }
}

function assertPlainObject(
  value: unknown,
  code: IntentPlanErrorCode,
  path: string,
  allowedKeys: readonly string[],
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(code, path, "expected object");
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail(code, `${path}.${key}`, "unexpected provider-specific field");
    }
  }
}

function fail(code: IntentPlanErrorCode, path: string, message: string): never {
  throw new IntentPlanValidationError(code, path, message);
}

function intentPlanMessages(locale: SupportedLocale): {
  readonly missingAction: string;
  readonly vagueOutcome: string;
  readonly ambiguousOrder: string;
  readonly planReady: string;
  readonly planOmitted: string;
  readonly rationaleConcept: string;
  readonly rationaleLearnerStep: string;
  readonly optionMove: string;
  readonly optionTurn: string;
  readonly optionRepeat: string;
  readonly optionIfGoal: string;
} {
  if (locale === "es") {
    return {
      missingAction: "¿Qué debería hacer tu personaje primero?",
      vagueOutcome: "¿Qué tiene que pasar exactamente en el escenario?",
      ambiguousOrder: "Diste dos cosas: ¿cuál pasa primero?",
      planReady: "Aquí está tu plan, en tu orden y con tus palabras.",
      planOmitted: "Pasos que esperan su turno:",
      rationaleConcept: "Este paso practica",
      rationaleLearnerStep: "Esta idea es tuya: decides cómo construirla.",
      optionMove: "moverse hacia la meta",
      optionTurn: "girar",
      optionRepeat: "repetir un movimiento",
      optionIfGoal: "revisar si toca la meta",
    };
  }
  return {
    missingAction: "What should your sprite do first?",
    vagueOutcome: "What has to happen on the stage, exactly?",
    ambiguousOrder: "You said two things: which one happens first?",
    planReady: "Here is your plan, in your own order and words.",
    planOmitted: "Steps waiting for their turn:",
    rationaleConcept: "This step practices",
    rationaleLearnerStep: "This idea is yours: you decide how to build it.",
    optionMove: "move toward the goal",
    optionTurn: "turn",
    optionRepeat: "repeat a movement",
    optionIfGoal: "check if it touches the goal",
  };
}
