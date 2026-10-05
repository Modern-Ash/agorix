import type { LayaBatchTransport } from "./laya.js";
import type { StudioSignal } from "./studio-signals.js";
import { createStudioSignal } from "./studio-signals.js";
import type { LearningDecisionState } from "./index.js";
import type { StudioPipeline } from "./studio-pipeline.js";

export type ProactiveSignalKind =
  "repeat-pattern" | "first-step" | "runtime-error" | "stalled" | "repeated-error";

/** Kinds introduced for Studio; Web behaviour for the original two is unchanged. */
export const STUDIO_PROACTIVE_KINDS = ["runtime-error", "stalled", "repeated-error"] as const;

export interface ProactiveSignal {
  readonly kind: ProactiveSignalKind;
  /** repeat-pattern: times the same steps were written in a row. first-step: statements so far. */
  readonly occurrences: number;
  /** The learner is executing the program right now. */
  readonly running: boolean;
  /** The learner already said no to this exact program. */
  readonly declinedForCurrentProgram: boolean;
  /** How many suggestions of this kind the learner declined this session. */
  readonly declinedCount: number;
  /** Studio: the learner is typing or stepping right now. */
  readonly typing?: boolean;
  /** Studio: AI is disabled or unavailable. Undefined means enabled (Web default). */
  readonly aiEnabled?: boolean;
  /** Studio: error code (runtime-error evidence). Opaque token, never a message. */
  readonly code?: string | undefined;
  /** Studio: stalled duration in whole seconds. */
  readonly seconds?: number | undefined;
  /** Studio: signals elapsed since the last decline; undefined when never declined. */
  readonly sinceLastDecline?: number | undefined;
  /** Studio: signals elapsed since the last offer; undefined when never offered. */
  readonly sinceLastOffer?: number | undefined;
  /** Studio: offers shown and ignored (neither accepted nor declined) in a row. */
  readonly ignoredCount?: number;
}

export type ProactiveOfferAction = "explain" | "debug" | "challenge" | "propose";

export type ProactiveSilenceReason =
  | "learner-is-executing"
  | "learner-is-typing"
  | "recently-declined"
  | "learner-declined-this-program"
  | "learner-repeatedly-declined"
  | "cooldown-active"
  | "pattern-too-weak"
  | "learner-already-started"
  | "evidence-too-weak"
  | "ai-disabled";

export const PROACTIVE_SILENCE_REASONS: readonly ProactiveSilenceReason[] = [
  "learner-is-executing",
  "learner-is-typing",
  "recently-declined",
  "learner-declined-this-program",
  "learner-repeatedly-declined",
  "cooldown-active",
  "pattern-too-weak",
  "learner-already-started",
  "evidence-too-weak",
  "ai-disabled",
];

export type ProactiveAction = "silence" | "offer";

export interface ProactiveDecision {
  readonly action: ProactiveAction;
  readonly reason: string;
  /** Proactive suggestions are always deterministic; no provider is involved. */
  readonly generativeNeeded: "no";
  /** Which layer produced the decision. */
  readonly source: "system0" | "laya";
  /** Studio offers only: what the agent can do. Never content. */
  readonly actions?: readonly ProactiveOfferAction[];
}

export const PROACTIVE_MIN_OCCURRENCES = 3;
export const PROACTIVE_MAX_DECLINES = 2;
/** Studio evidence thresholds. */
export const PROACTIVE_MIN_STALL_SECONDS = 60;
export const PROACTIVE_MIN_REPEATED_ERRORS = 2;
/** Signals that must pass after a decline before offering again. */
export const PROACTIVE_RECENT_DECLINE_WINDOW = 5;
/** Base signals between offers; grows with each ignored offer (decay). */
export const PROACTIVE_COOLDOWN_SIGNALS = 3;
/** Every N ignored offers count as one decline toward the cap. */
export const PROACTIVE_IGNORES_PER_DECLINE = 2;

const STUDIO_ACTIONS: Record<
  (typeof STUDIO_PROACTIVE_KINDS)[number],
  readonly ProactiveOfferAction[]
> = {
  "runtime-error": ["explain", "debug"],
  stalled: ["propose", "challenge"],
  "repeated-error": ["debug", "explain", "challenge"],
};

export function proactiveCooldownFor(ignoredCount: number): number {
  return PROACTIVE_COOLDOWN_SIGNALS * (1 + Math.max(0, Math.trunc(ignoredCount)));
}

function isStudioKind(kind: ProactiveSignalKind): kind is (typeof STUDIO_PROACTIVE_KINDS)[number] {
  return (STUDIO_PROACTIVE_KINDS as readonly string[]).includes(kind);
}

function studioEvidenceTooWeak(signal: ProactiveSignal): boolean {
  switch (signal.kind) {
    case "runtime-error":
      return signal.code === undefined;
    case "stalled":
      return (signal.seconds ?? 0) < PROACTIVE_MIN_STALL_SECONDS;
    case "repeated-error":
      return signal.occurrences < PROACTIVE_MIN_REPEATED_ERRORS;
    default:
      return false;
  }
}

/**
 * System-0 rule for unprompted help: staying quiet is a first-class outcome.
 * Pure and deterministic, so it works offline and never selects a provider.
 */
export function decideProactiveSuggestion(signal: ProactiveSignal): ProactiveDecision {
  const studioContext =
    signal.typing !== undefined ||
    signal.aiEnabled !== undefined ||
    signal.sinceLastDecline !== undefined ||
    signal.sinceLastOffer !== undefined ||
    signal.ignoredCount !== undefined;
  const silence = (reason: ProactiveSilenceReason): ProactiveDecision => ({
    action: "silence",
    reason,
    generativeNeeded: "no",
    source: "system0",
  });
  if (signal.aiEnabled === false) {
    return silence("ai-disabled");
  }
  if (signal.running) {
    return silence("learner-is-executing");
  }
  if (signal.typing === true) {
    return silence("learner-is-typing");
  }
  if (isStudioKind(signal.kind) && studioEvidenceTooWeak(signal)) {
    return silence("evidence-too-weak");
  }
  if (signal.kind === "repeat-pattern" && signal.occurrences < PROACTIVE_MIN_OCCURRENCES) {
    return silence("pattern-too-weak");
  }
  if (signal.kind === "first-step" && signal.occurrences > 0) {
    return silence("learner-already-started");
  }
  if (signal.declinedForCurrentProgram) {
    return silence("learner-declined-this-program");
  }
  if (
    signal.sinceLastDecline !== undefined &&
    signal.sinceLastDecline < PROACTIVE_RECENT_DECLINE_WINDOW
  ) {
    return silence("recently-declined");
  }
  const ignored = Math.max(0, Math.trunc(signal.ignoredCount ?? 0));
  const effectiveDeclines =
    signal.declinedCount + Math.floor(ignored / PROACTIVE_IGNORES_PER_DECLINE);
  if (effectiveDeclines >= PROACTIVE_MAX_DECLINES) {
    return silence("learner-repeatedly-declined");
  }
  if (
    signal.sinceLastOffer !== undefined &&
    signal.sinceLastOffer < proactiveCooldownFor(ignored)
  ) {
    return silence("cooldown-active");
  }
  if (isStudioKind(signal.kind)) {
    return {
      action: "offer",
      reason: `${signal.kind}-detected`,
      generativeNeeded: "no",
      source: "system0",
      actions: STUDIO_ACTIONS[signal.kind],
    };
  }
  if (studioContext && signal.kind === "first-step") {
    return {
      action: "offer",
      reason: "empty-program",
      generativeNeeded: "no",
      source: "system0",
      actions: ["propose"],
    };
  }
  if (studioContext && signal.kind === "repeat-pattern") {
    return {
      action: "offer",
      reason: "repeated-steps-detected",
      generativeNeeded: "no",
      source: "system0",
      actions: ["propose", "challenge"],
    };
  }
  return {
    action: "offer",
    reason: signal.kind === "first-step" ? "empty-program" : "repeated-steps-detected",
    generativeNeeded: "no",
    source: "system0",
  };
}

export const LAYA_PROACTIVE_QUESTION = "proactiveAction";
export const LAYA_PROACTIVE_THRESHOLD = 0.9;

/**
 * System-0 decides first. Laya can only make the product quieter: when System-0
 * says offer, Laya may veto with high confidence. It can never create an offer
 * that System-0 refused, and any transport failure falls back to System-0.
 */
export async function decideProactiveWithLaya(
  signal: ProactiveSignal,
  transport: LayaBatchTransport | undefined,
): Promise<ProactiveDecision> {
  const base = decideProactiveSuggestion(signal);
  if (base.action === "silence" || transport === undefined) {
    return base;
  }
  try {
    const [answer] = await transport.decideMany({
      state: {
        kind: signal.kind,
        occurrences: signal.occurrences,
        declinedCount: signal.declinedCount,
      },
      questions: [{ id: LAYA_PROACTIVE_QUESTION, type: "choice", choices: ["silence", "offer"] }],
    });
    if (
      answer?.id === LAYA_PROACTIVE_QUESTION &&
      answer.value === "silence" &&
      answer.confidence >= LAYA_PROACTIVE_THRESHOLD
    ) {
      return { ...base, action: "silence", reason: "laya-judged-not-now", source: "laya" };
    }
  } catch {
    // Laya is optional; System-0 stays authoritative.
  }
  return base;
}

export interface StudioProactivePipelineOptions {
  readonly pipeline: StudioPipeline;
  readonly studioSignal?: StudioSignal;
  readonly programHash?: string;
  readonly locale?: string;
  readonly state?: LearningDecisionState;
}

/**
 * Routes proactive offers through the Studio decision pipeline. The proactive offer itself stays
 * deterministic and content-free; the pipeline may only make the agent quieter before acceptance.
 */
export async function decideProactiveWithStudioPipeline(
  signal: ProactiveSignal,
  options: StudioProactivePipelineOptions,
): Promise<ProactiveDecision> {
  const base = decideProactiveSuggestion(signal);
  if (base.action === "silence") return base;
  const studioSignal =
    options.studioSignal ??
    createStudioSignal(signal.kind, 0, {
      occurrences: signal.occurrences,
      ...(signal.code === undefined ? {} : { code: signal.code }),
      ...(signal.seconds === undefined ? {} : { seconds: signal.seconds }),
    });
  if (studioSignal === undefined) return base;
  try {
    const decision = await options.pipeline.decide({
      signal: studioSignal,
      state: options.state ?? stateFromProactiveSignal(signal),
      ...(options.programHash === undefined ? {} : { programHash: options.programHash }),
      ...(options.locale === undefined ? {} : { locale: options.locale }),
    });
    if (decision.degradedReason !== undefined) {
      return {
        ...base,
        action: "silence",
        reason: `studio-pipeline-${decision.degradedReason}`,
        source: decision.source === "system1" ? "laya" : "system0",
      };
    }
    if (decision.source === "system1" && decision.requirements.generativeNeeded === "no") {
      return { ...base, action: "silence", reason: "laya-judged-not-now", source: "laya" };
    }
  } catch {
    // Pipeline diagnostics are advisory; proactive System-0 remains available offline.
  }
  return base;
}

function stateFromProactiveSignal(signal: ProactiveSignal): LearningDecisionState {
  const debugging = signal.kind === "runtime-error" || signal.kind === "repeated-error";
  const builder =
    signal.kind === "first-step" || signal.kind === "repeat-pattern" || signal.kind === "stalled";
  return {
    capability: debugging ? "debugger" : builder ? "builder" : "coach",
    scaffoldLevel: 1,
    scaffoldHistoryLength: 0,
    hasLearnerIntent: false,
    hasRuntime: debugging,
    runtimeFactCount: debugging ? 1 : 0,
    selectedNodeCount: 1,
    offline: signal.aiEnabled === false,
    explicitStrongerHelpRequested: false,
  };
}

/** Decline/ignore memory. Pure data; the host stores it per session. */
export interface ProactiveProgramMemory {
  readonly declines: number;
  readonly lastDeclineSequence?: number;
}

export interface ProactiveMemory {
  readonly sessionDeclines: number;
  readonly ignoredInRow: number;
  readonly lastDeclineSequence?: number;
  readonly lastOfferSequence?: number;
  readonly programs: Readonly<Record<string, ProactiveProgramMemory>>;
}

export type ProactiveOutcome = "offered" | "declined" | "ignored" | "accepted";

export const EMPTY_PROACTIVE_MEMORY: ProactiveMemory = {
  sessionDeclines: 0,
  ignoredInRow: 0,
  programs: {},
};

export function recordProactiveOutcome(
  memory: ProactiveMemory,
  programId: string,
  outcome: ProactiveOutcome,
  sequence: number,
): ProactiveMemory {
  switch (outcome) {
    case "offered":
      return { ...memory, lastOfferSequence: sequence };
    case "ignored":
      return { ...memory, ignoredInRow: memory.ignoredInRow + 1 };
    case "accepted":
      return { ...memory, ignoredInRow: 0 };
    case "declined": {
      const prior = memory.programs[programId];
      return {
        ...memory,
        sessionDeclines: memory.sessionDeclines + 1,
        ignoredInRow: 0,
        lastDeclineSequence: sequence,
        programs: {
          ...memory.programs,
          [programId]: { declines: (prior?.declines ?? 0) + 1, lastDeclineSequence: sequence },
        },
      };
    }
  }
}

export interface StudioProactiveContext {
  readonly programId: string;
  readonly running: boolean;
  readonly typing: boolean;
  readonly aiEnabled: boolean;
  readonly memory: ProactiveMemory;
}

/** Map a Studio signal plus host state into a ProactiveSignal. Undefined for non-proactive kinds. */
export function proactiveSignalFromStudio(
  signal: StudioSignal,
  ctx: StudioProactiveContext,
): ProactiveSignal | undefined {
  if (
    signal.kind !== "runtime-error" &&
    signal.kind !== "stalled" &&
    signal.kind !== "repeated-error" &&
    signal.kind !== "repeat-pattern" &&
    signal.kind !== "first-step"
  ) {
    return undefined;
  }
  const { memory } = ctx;
  const since = (at: number | undefined): number | undefined =>
    at === undefined ? undefined : Math.max(0, signal.sequence - at);
  return {
    kind: signal.kind as ProactiveSignalKind,
    occurrences: signal.occurrences ?? 0,
    running: ctx.running,
    typing: ctx.typing,
    aiEnabled: ctx.aiEnabled,
    declinedForCurrentProgram: (memory.programs[ctx.programId]?.declines ?? 0) > 0,
    declinedCount: memory.sessionDeclines,
    ...(signal.code !== undefined ? { code: signal.code } : {}),
    ...(signal.seconds !== undefined ? { seconds: signal.seconds } : {}),
    ...(since(memory.lastDeclineSequence) !== undefined
      ? { sinceLastDecline: since(memory.lastDeclineSequence) }
      : {}),
    ...(since(memory.lastOfferSequence) !== undefined
      ? { sinceLastOffer: since(memory.lastOfferSequence) }
      : {}),
    ignoredCount: memory.ignoredInRow,
  };
}
