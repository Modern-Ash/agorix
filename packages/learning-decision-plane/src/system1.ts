import type {
  ClarificationNeed,
  GenerativeNeed,
  LearningContextNeed,
  LearningDecisionAnswer,
  LearningDecisionSet,
  LearningDecisionState,
  LearningReasoningTier,
  RuntimeEvidenceNeed,
  SolutionAllowance,
} from "./index.js";
import type {
  LearningCompanionCapability,
  LearningCompanionScaffoldLevel,
} from "@agorix/tutor-contract";

export type LearningDecisionQuestionId = keyof LearningDecisionSet;

export interface LearningDecisionQuestion {
  readonly id: LearningDecisionQuestionId;
  readonly choices: readonly (string | number)[];
  readonly threshold: number;
}

export interface LearningSystem1Answer {
  readonly questionId: LearningDecisionQuestionId;
  readonly value: string | number;
  readonly confidence: number;
}

export interface LearningSystem1Provider {
  readonly id: string;
  decideMany(
    state: Readonly<Record<string, string | number | boolean>>,
    questions: readonly LearningDecisionQuestion[],
  ): Promise<readonly LearningSystem1Answer[]>;
}

export interface LearningDecisionCache {
  readonly get: (key: string) => LearningDecisionSet | undefined;
  readonly set: (key: string, value: LearningDecisionSet) => void;
}

export interface LearningSystem1Evaluation {
  readonly decisions: LearningDecisionSet;
  readonly accepted: readonly LearningDecisionQuestionId[];
  readonly abstained: readonly LearningDecisionQuestionId[];
  readonly providerAvailable: boolean;
  readonly cacheHit: boolean;
}

const QUESTIONS: readonly LearningDecisionQuestion[] = [
  { id: "generativeNeeded", choices: ["no", "yes"], threshold: 0.9 },
  { id: "clarificationNeeded", choices: ["no", "yes"], threshold: 0.9 },
  { id: "assistanceLevel", choices: [0, 1, 2, 3, 4, 5], threshold: 0.92 },
  {
    id: "learningCapability",
    choices: ["coach", "builder", "debugger", "explainer", "challenger", "reflector"],
    threshold: 0.95,
  },
  {
    id: "solutionAllowance",
    choices: ["none", "partial", "complete"],
    threshold: 0.95,
  },
  { id: "runtimeEvidenceNeeded", choices: ["no", "yes"], threshold: 0.95 },
  {
    id: "contextNeed",
    choices: ["none", "program", "mission", "runtime", "history", "bounded"],
    threshold: 0.9,
  },
  {
    id: "reasoningTier",
    choices: ["deterministic", "local", "remote"],
    threshold: 0.9,
  },
];

export function createMemoryLearningDecisionCache(): LearningDecisionCache {
  const values = new Map<string, LearningDecisionSet>();
  return {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
  };
}

export async function evaluateLearningSystem1(
  state: LearningDecisionState,
  provider: LearningSystem1Provider,
  options: {
    readonly cache?: LearningDecisionCache;
    readonly unresolved?: readonly LearningDecisionQuestionId[];
  } = {},
): Promise<LearningSystem1Evaluation> {
  const unresolved = new Set(options.unresolved ?? QUESTIONS.map((question) => question.id));
  const questions = QUESTIONS.filter((question) => unresolved.has(question.id));
  if (questions.length === 0) {
    return {
      decisions: {},
      accepted: [],
      abstained: [],
      providerAvailable: true,
      cacheHit: false,
    };
  }

  const compact = compactLearningState(state);
  const key = cacheKey(provider.id, compact, questions);
  const cached = options.cache?.get(key);
  if (cached !== undefined) {
    return {
      decisions: cached,
      accepted: Object.keys(cached) as LearningDecisionQuestionId[],
      abstained: [],
      providerAvailable: true,
      cacheHit: true,
    };
  }

  let answers: readonly LearningSystem1Answer[];
  try {
    answers = await provider.decideMany(compact, questions);
  } catch {
    return {
      decisions: {},
      accepted: [],
      abstained: questions.map((question) => question.id),
      providerAvailable: false,
      cacheHit: false,
    };
  }

  const decisions: MutableDecisionSet = {};
  const accepted: LearningDecisionQuestionId[] = [];
  const abstained: LearningDecisionQuestionId[] = [];
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));

  for (const question of questions) {
    const candidate = byId.get(question.id);
    if (
      candidate === undefined ||
      !question.choices.includes(candidate.value) ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < question.threshold
    ) {
      abstained.push(question.id);
      continue;
    }
    setDecision(decisions, question.id, candidate.value, candidate.confidence);
    accepted.push(question.id);
  }

  options.cache?.set(key, decisions);
  return { decisions, accepted, abstained, providerAvailable: true, cacheHit: false };
}

export function compactLearningState(
  state: LearningDecisionState,
): Readonly<Record<string, string | number | boolean>> {
  return Object.freeze({
    capability: state.capability,
    scaffoldLevel: state.scaffoldLevel,
    scaffoldHistoryLength: state.scaffoldHistoryLength,
    hasLearnerIntent: state.hasLearnerIntent,
    hasRuntime: state.hasRuntime,
    runtimeFactCount: state.runtimeFactCount,
    selectedNodeCount: state.selectedNodeCount,
    offline: state.offline,
    explicitStrongerHelpRequested: state.explicitStrongerHelpRequested,
  });
}

function cacheKey(
  providerId: string,
  state: Readonly<Record<string, string | number | boolean>>,
  questions: readonly LearningDecisionQuestion[],
): string {
  return JSON.stringify({
    schema: "agorix/learning-system1/v1",
    providerId,
    state,
    questions: questions.map(({ id, choices, threshold }) => ({ id, choices, threshold })),
  });
}

type MutableDecisionSet = {
  -readonly [K in keyof LearningDecisionSet]: LearningDecisionSet[K];
};

function system1<T extends string | number>(
  value: T,
  confidence: number,
): LearningDecisionAnswer<T> {
  return { value, confidence, source: "system1", reason: "system1-classification" };
}

function setDecision(
  decisions: MutableDecisionSet,
  id: LearningDecisionQuestionId,
  value: string | number,
  confidence: number,
): void {
  switch (id) {
    case "generativeNeeded":
      decisions.generativeNeeded = system1(value as GenerativeNeed, confidence);
      return;
    case "clarificationNeeded":
      decisions.clarificationNeeded = system1(value as ClarificationNeed, confidence);
      return;
    case "assistanceLevel":
      decisions.assistanceLevel = system1(value as LearningCompanionScaffoldLevel, confidence);
      return;
    case "learningCapability":
      decisions.learningCapability = system1(value as LearningCompanionCapability, confidence);
      return;
    case "solutionAllowance":
      decisions.solutionAllowance = system1(value as SolutionAllowance, confidence);
      return;
    case "runtimeEvidenceNeeded":
      decisions.runtimeEvidenceNeeded = system1(value as RuntimeEvidenceNeed, confidence);
      return;
    case "contextNeed":
      decisions.contextNeed = system1(value as LearningContextNeed, confidence);
      return;
    case "reasoningTier":
      decisions.reasoningTier = system1(value as LearningReasoningTier, confidence);
  }
}
