import type {
  LearningCompanionCapability,
  LearningCompanionRequest,
  LearningCompanionScaffoldLevel,
} from "@agorix/tutor-contract";

export const LEARNING_REQUIREMENTS_SCHEMA_VERSION = "agorix/learning-requirements/v1";

export type GenerativeNeed = "no" | "yes";
export type ClarificationNeed = "no" | "yes";
export type SolutionAllowance = "none" | "partial" | "complete";
export type RuntimeEvidenceNeed = "no" | "yes";
export type LearningContextNeed =
  "none" | "program" | "mission" | "runtime" | "history" | "bounded";
export type LearningReasoningTier = "deterministic" | "local" | "remote";
export type DecisionSource = "system0" | "system1" | "fallback";

export interface LearningDecisionState {
  readonly capability: LearningCompanionCapability;
  readonly scaffoldLevel: LearningCompanionScaffoldLevel;
  readonly scaffoldHistoryLength: number;
  readonly hasLearnerIntent: boolean;
  readonly hasRuntime: boolean;
  readonly runtimeFactCount: number;
  readonly selectedNodeCount: number;
  readonly offline: boolean;
  readonly explicitStrongerHelpRequested: boolean;
}

export interface LearningDecisionAnswer<T extends string | number> {
  readonly value: T;
  readonly source: DecisionSource;
  readonly confidence: number;
  readonly reason: string;
}

export interface LearningDecisionSet {
  readonly generativeNeeded?: LearningDecisionAnswer<GenerativeNeed>;
  readonly clarificationNeeded?: LearningDecisionAnswer<ClarificationNeed>;
  readonly assistanceLevel?: LearningDecisionAnswer<LearningCompanionScaffoldLevel>;
  readonly learningCapability?: LearningDecisionAnswer<LearningCompanionCapability>;
  readonly solutionAllowance?: LearningDecisionAnswer<SolutionAllowance>;
  readonly runtimeEvidenceNeeded?: LearningDecisionAnswer<RuntimeEvidenceNeed>;
  readonly contextNeed?: LearningDecisionAnswer<LearningContextNeed>;
  readonly reasoningTier?: LearningDecisionAnswer<LearningReasoningTier>;
}

export interface LearningRequirements {
  readonly schema: typeof LEARNING_REQUIREMENTS_SCHEMA_VERSION;
  readonly generativeNeeded: GenerativeNeed;
  readonly clarificationNeeded: ClarificationNeed;
  readonly assistanceLevel: LearningCompanionScaffoldLevel;
  readonly learningCapability: LearningCompanionCapability;
  readonly solutionAllowance: SolutionAllowance;
  readonly runtimeEvidenceNeeded: RuntimeEvidenceNeed;
  readonly contextNeed: LearningContextNeed;
  readonly reasoningTier: LearningReasoningTier;
  readonly provenance: Readonly<Record<keyof LearningDecisionSet, DecisionSource>>;
}

export function stateFromLearningCompanionRequest(
  request: LearningCompanionRequest,
  options: {
    readonly offline?: boolean;
    readonly explicitStrongerHelpRequested?: boolean;
  } = {},
): LearningDecisionState {
  const highest = request.scaffoldHistory.reduce<LearningCompanionScaffoldLevel>(
    (level, entry) => Math.max(level, entry.level) as LearningCompanionScaffoldLevel,
    0,
  );
  return {
    capability: request.capability,
    scaffoldLevel: highest,
    scaffoldHistoryLength: request.scaffoldHistory.length,
    hasLearnerIntent:
      request.learnerIntent !== undefined && request.learnerIntent.trim().length > 0,
    hasRuntime: request.runtime !== undefined,
    runtimeFactCount: request.runtimeFacts.length,
    selectedNodeCount: request.selectedNodeIds.length,
    offline: options.offline ?? false,
    explicitStrongerHelpRequested: options.explicitStrongerHelpRequested ?? false,
  };
}

export function resolveLearningSystem0(state: LearningDecisionState): LearningDecisionSet {
  const answers: MutableLearningDecisionSet = {};

  if (state.offline) {
    answers.generativeNeeded = answer("no", "offline-mode");
    answers.reasoningTier = answer("deterministic", "offline-mode");
  }

  if (state.capability === "debugger") {
    answers.runtimeEvidenceNeeded = answer("yes", "debugger-must-be-evidence-grounded");
    answers.contextNeed = answer("runtime", "debugger-uses-runtime-evidence");
    if (!state.hasRuntime || state.runtimeFactCount === 0) {
      answers.generativeNeeded = answer("no", "debugger-needs-runtime-evidence-before-generation");
      answers.reasoningTier = answer(
        "deterministic",
        "debugger-needs-runtime-evidence-before-generation",
      );
    }
  } else {
    answers.runtimeEvidenceNeeded = answer("no", "non-debugger-capability");
  }

  if (state.capability === "reflector" && state.hasRuntime) {
    answers.contextNeed ??= answer("runtime", "reflection-after-runtime");
  }

  if (state.capability === "builder") {
    answers.solutionAllowance = answer(
      state.explicitStrongerHelpRequested && state.scaffoldLevel >= 4 ? "complete" : "partial",
      "builder-scaffolding-floor",
    );
  } else {
    answers.solutionAllowance = answer("none", "non-builder-capability");
  }

  if (state.capability === "coach" && !state.hasLearnerIntent) {
    answers.clarificationNeeded = answer("yes", "coach-needs-learner-intent");
  }

  if (state.capability === "challenger" || state.capability === "reflector") {
    answers.assistanceLevel = answer(
      Math.min(state.scaffoldLevel, 2) as LearningCompanionScaffoldLevel,
      "reflection-and-prediction-are-low-assistance",
    );
  }

  if (state.capability === "challenger") {
    answers.generativeNeeded ??= answer("no", "prediction-prompt-has-deterministic-fixture");
    answers.reasoningTier ??= answer(
      "deterministic",
      "prediction-prompt-has-deterministic-fixture",
    );
    answers.contextNeed ??= answer("program", "prediction-is-program-grounded");
  }
  if (state.capability === "reflector" && state.hasRuntime && state.runtimeFactCount > 0) {
    answers.generativeNeeded ??= answer(
      "no",
      "reflection-prompt-has-deterministic-runtime-fixture",
    );
    answers.reasoningTier ??= answer(
      "deterministic",
      "reflection-prompt-has-deterministic-runtime-fixture",
    );
  }
  if (state.capability === "explainer") {
    answers.contextNeed ??= answer("program", "explanation-is-program-grounded");
  }

  answers.learningCapability = answer(state.capability, "requested-capability-is-an-upper-bound");
  return answers;
}

export function projectLearningRequirements(
  state: LearningDecisionState,
  advisory: LearningDecisionSet = {},
): LearningRequirements {
  const system0 = resolveLearningSystem0(state);
  const generativeNeeded = pick(
    system0.generativeNeeded,
    advisory.generativeNeeded,
    "yes",
    "fallback",
  );
  const clarificationNeeded = pick(
    system0.clarificationNeeded,
    advisory.clarificationNeeded,
    "no",
    "fallback",
  );
  const assistanceLevel = minimumAssistance(
    system0.assistanceLevel,
    advisory.assistanceLevel,
    state.scaffoldLevel,
  );
  const learningCapability = pick(
    system0.learningCapability,
    advisory.learningCapability,
    state.capability,
    "fallback",
  );
  const solutionAllowance = minimumSolutionAllowance(
    system0.solutionAllowance,
    advisory.solutionAllowance,
  );
  const runtimeEvidenceNeeded = pick(
    system0.runtimeEvidenceNeeded,
    advisory.runtimeEvidenceNeeded,
    state.capability === "debugger" ? "yes" : "no",
    "fallback",
  );
  const contextNeed = pick(
    system0.contextNeed,
    advisory.contextNeed,
    state.capability === "debugger" ? "runtime" : "bounded",
    "fallback",
  );
  const reasoningTier = pick(
    system0.reasoningTier,
    advisory.reasoningTier,
    generativeNeeded.value === "no" ? "deterministic" : "local",
    "fallback",
  );

  return {
    schema: LEARNING_REQUIREMENTS_SCHEMA_VERSION,
    generativeNeeded: generativeNeeded.value,
    clarificationNeeded: clarificationNeeded.value,
    assistanceLevel: assistanceLevel.value,
    learningCapability: learningCapability.value,
    solutionAllowance: solutionAllowance.value,
    runtimeEvidenceNeeded: runtimeEvidenceNeeded.value,
    contextNeed: contextNeed.value,
    reasoningTier: reasoningTier.value,
    provenance: {
      generativeNeeded: generativeNeeded.source,
      clarificationNeeded: clarificationNeeded.source,
      assistanceLevel: assistanceLevel.source,
      learningCapability: learningCapability.source,
      solutionAllowance: solutionAllowance.source,
      runtimeEvidenceNeeded: runtimeEvidenceNeeded.source,
      contextNeed: contextNeed.source,
      reasoningTier: reasoningTier.source,
    },
  };
}

type MutableLearningDecisionSet = {
  -readonly [K in keyof LearningDecisionSet]: LearningDecisionSet[K];
};

function answer<T extends string | number>(value: T, reason: string): LearningDecisionAnswer<T> {
  return { value, source: "system0", confidence: 1, reason };
}

function pick<T extends string | number>(
  floor: LearningDecisionAnswer<T> | undefined,
  advisory: LearningDecisionAnswer<T> | undefined,
  fallback: T,
  fallbackSource: DecisionSource,
): LearningDecisionAnswer<T> {
  if (floor !== undefined) {
    return floor;
  }
  if (advisory !== undefined && advisory.confidence >= 0.9) {
    return advisory;
  }
  return {
    value: fallback,
    source: fallbackSource,
    confidence: 1,
    reason: "safe-fallback",
  };
}

function minimumAssistance(
  floor: LearningDecisionAnswer<LearningCompanionScaffoldLevel> | undefined,
  advisory: LearningDecisionAnswer<LearningCompanionScaffoldLevel> | undefined,
  current: LearningCompanionScaffoldLevel,
): LearningDecisionAnswer<LearningCompanionScaffoldLevel> {
  const maximum = floor?.value ?? current;
  if (advisory !== undefined && advisory.confidence >= 0.9) {
    return {
      ...advisory,
      value: Math.min(advisory.value, maximum) as LearningCompanionScaffoldLevel,
    };
  }
  return (
    floor ?? {
      value: maximum,
      source: "fallback",
      confidence: 1,
      reason: "current-scaffold-floor",
    }
  );
}

function minimumSolutionAllowance(
  floor: LearningDecisionAnswer<SolutionAllowance> | undefined,
  advisory: LearningDecisionAnswer<SolutionAllowance> | undefined,
): LearningDecisionAnswer<SolutionAllowance> {
  const order: readonly SolutionAllowance[] = ["none", "partial", "complete"];
  if (floor !== undefined) {
    if (advisory === undefined || advisory.confidence < 0.9) {
      return floor;
    }
    return order.indexOf(advisory.value) <= order.indexOf(floor.value) ? advisory : floor;
  }
  if (advisory !== undefined && advisory.confidence >= 0.9) {
    return advisory;
  }
  return {
    value: "none",
    source: "fallback",
    confidence: 1,
    reason: "safe-solution-fallback",
  };
}

export * from "./system1.js";
export * from "./laya.js";
export * from "./scaffolding.js";
export * from "./roles.js";
export * from "./builder-policy.js";
export * from "./proactive.js";
export * from "./studio-signals.js";
export * from "./studio-context.js";
export * from "./studio-pipeline.js";
