/**
 * Mission assessment model (issue #102).
 *
 * Two independent results, never collapsed into one number:
 * - completion: proven only by the deterministic runtime outcome;
 * - understanding: per-competency indicators derived from learner-authored
 *   evidence, with the assistance level that produced each one kept visible.
 *
 * Understanding credit is a non-increasing function of assistance rank, so a
 * metric built on this report cannot reward over-assistance.
 */

import {
  COMPETENCIES,
  getCompetency,
  isCompetencyId,
  type CompetencyDefinition,
  type CompetencyDimension,
} from "./competencies.js";
import {
  ASSISTANCE_LEVELS,
  ASSISTANCE_RANK,
  EVENT_COMPETENCY_TRACE,
  MISSION_ASSESSMENT_SCHEMA_VERSION,
  SCHEMA_INVARIANT_COMPETENCIES,
  peakAssistance,
  validateEvidenceEvents,
  type AssistanceLevel,
  type LearningEvidenceEvent,
  type RuntimeOutcome,
} from "./evidence.js";

export type UnderstandingStatus = "demonstrated" | "partial" | "notObserved";

export type IndicatorSource = "learnerEvidence" | "schemaInvariant";

export interface CompetencyIndicator {
  readonly competencyId: string;
  readonly dimension: CompetencyDimension;
  readonly description: string;
  readonly status: UnderstandingStatus;
  /**
   * `schemaInvariant` indicators are proven by the evidence schema itself, not by
   * a learner action, so they never count as demonstrated understanding.
   */
  readonly source: IndicatorSource;
  /** Evidence event ids that produced this indicator, in sequence order. */
  readonly supportingEventIds: readonly string[];
  /** Most AI-led assistance level among the supporting events. */
  readonly assistanceLevel: AssistanceLevel;
  /** Human-readable reason, always naming the assistance level. */
  readonly rationale: string;
}

export interface CompletionAssessment {
  readonly completed: boolean;
  readonly basis: "deterministicRuntime";
  readonly runtimeOutcome: RuntimeOutcome | "notRun";
  /** Explicitly false when the mission finished without understanding evidence. */
  readonly impliesUnderstanding: false;
}

export interface OverAssistanceFlag {
  readonly code:
    | "aiSolvedBeforeLearnerActed"
    | "proposalAcceptedWithoutInspection"
    | "learnerActionMissingUnderHighScaffolding";
  readonly detail: string;
  readonly assistanceLevel: AssistanceLevel;
}

export interface MissionAssessmentReport {
  readonly schema: typeof MISSION_ASSESSMENT_SCHEMA_VERSION;
  readonly missionId: string;
  readonly missionVersion: number;
  readonly completion: CompletionAssessment;
  readonly understanding: {
    /** Competencies demonstrated by a learner action. Never by the schema alone. */
    readonly demonstrated: readonly string[];
    readonly partial: readonly string[];
    readonly notObserved: readonly string[];
    /** Competencies proven by the evidence schema's own privacy guarantees. */
    readonly schemaInvariantsProven: readonly string[];
    readonly indicators: readonly CompetencyIndicator[];
  };
  /** Highest assistance level anywhere in the evidence. Always surfaced. */
  readonly peakAssistanceLevel: AssistanceLevel;
  readonly overAssistanceFlags: readonly OverAssistanceFlag[];
  /** Completion and understanding reported side by side, never merged. */
  readonly interpretation: {
    readonly completionStatement: string;
    readonly understandingStatement: string;
    readonly assistanceStatement: string;
    readonly cautions: readonly string[];
  };
}

export class MissionAssessmentError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "MissionAssessmentError";
    this.path = path;
  }
}

export interface AssessMissionInput {
  readonly missionId: string;
  readonly missionVersion: number;
  readonly events: readonly unknown[];
}

const REVISION_COMPETENCY: Readonly<Record<string, readonly string[]>> = {
  sequenceChange: ["programming.sequence"],
  eventOrder: ["programming.events"],
  loopChange: ["programming.repetition"],
  conditionChange: ["programming.conditions"],
  stateChange: ["programming.state.variables"],
  decomposition: ["programming.decomposition.functions"],
  textEdit: ["programming.modifyingTextualCode"],
};

interface EvidenceSignal {
  readonly eventId: string;
  readonly sequence: number;
  readonly assistanceLevel: AssistanceLevel;
  /**
   * The single competency this signal speaks for. Signals are keyed explicitly,
   * never by position, so adding a competency to a trace can never silently
   * re-attribute another competency's evidence.
   */
  readonly competencyId: string;
  /** false when the event does not actually demonstrate the competency. */
  readonly qualifies: boolean;
  readonly detail: string;
}

function signalsFor(event: LearningEvidenceEvent): readonly EvidenceSignal[] {
  const base = {
    eventId: event.id,
    sequence: event.sequence,
    assistanceLevel: event.assistanceLevel,
  };
  const signal = (competencyId: string, qualifies: boolean, detail: string): EvidenceSignal => ({
    ...base,
    competencyId,
    qualifies,
    detail,
  });
  switch (event.kind) {
    case "predictionMade":
      return [
        signal("collaboration.predictingBehavior", true, "Prediction recorded before execution."),
      ];
    case "proposalDecided": {
      const inspected = event.inspectedDiff;
      const rejected = event.decision === "reject";
      return [
        signal(
          "collaboration.inspectingProposals",
          inspected || rejected,
          inspected
            ? "Proposal diff inspected before deciding."
            : `Proposal ${event.decision}ed without opening the diff.`,
        ),
        signal(
          "aiLiteracy.aiCanBeWrong",
          inspected || rejected,
          inspected
            ? "Companion suggestion treated as fallible and checked against the diff."
            : rejected
              ? "Companion suggestion rejected as fallible."
              : "Companion suggestion accepted without treating it as fallible.",
        ),
        signal("collaboration.decidingOnProposals", true, `Learner decision: ${event.decision}.`),
        signal(
          "aiLiteracy.learnerIsAuthor",
          true,
          `Learner retained authorship with an explicit ${event.decision} decision.`,
        ),
        signal(
          "collaboration.testingProposals",
          event.testedWithRuntime,
          event.testedWithRuntime
            ? "Proposal tested with runtime evidence before acceptance."
            : "Proposal was not tested with runtime evidence.",
        ),
        signal(
          "collaboration.challengingAiAnswer",
          event.challengedCompanion,
          "Learner challenged the companion instead of accepting it.",
        ),
      ];
    }
    case "reflectionRecorded": {
      const competencyId =
        event.reflectionKind === "intent"
          ? "collaboration.expressingIntent"
          : event.reflectionKind === "decision"
            ? "collaboration.explainingDecision"
            : "aiLiteracy.fluentLanguageIsNotProof";
      return [
        signal(competencyId, true, `Local ${event.reflectionKind} reflection answered.`),
        ...(event.reflectionKind === "verification"
          ? [
              signal(
                "aiLiteracy.runtimeEvidenceMatters",
                true,
                "Verification reflection recorded without retaining text.",
              ),
            ]
          : []),
      ];
    }
    case "scaffoldDelivered":
      return [
        signal(
          "collaboration.answeringClarifyingQuestions",
          event.answeredByLearner && event.scaffoldKind !== "solution",
          event.answeredByLearner
            ? `Answered a ${event.scaffoldKind} at level ${event.level}.`
            : "Scaffold was not answered by the learner.",
        ),
      ];
    case "programRevisedAfterExecution": {
      const revisionCompetency = REVISION_COMPETENCY[event.revisionKind]?.[0];
      if (revisionCompetency === undefined) {
        return [];
      }
      return [
        signal(
          revisionCompetency,
          event.changedNodeCount > 0,
          `Learner revision: ${event.revisionKind} (${event.changedNodeCount} node(s)).`,
        ),
        // A revision that followed a failed run is debugging evidence in its own
        // right, independent of a separate debuggingSucceeded event.
        ...(event.afterUnsuccessfulRun
          ? [signal("programming.debugging", true, "Revision followed an unsuccessful run.")]
          : []),
      ];
    }
    case "debuggingSucceeded":
      return [
        signal(
          "programming.debugging",
          event.usedRuntimeEvidence,
          `Repaired after ${event.attemptsBeforeSuccess} attempt(s) using runtime evidence.`,
        ),
        signal(
          "aiLiteracy.runtimeEvidenceMatters",
          event.usedRuntimeEvidence,
          "Repair was driven by runtime evidence rather than by fluent wording.",
        ),
      ];
    case "codeViewUsed":
      return [signal("programming.readingCode", true, `Inspected the ${event.view} projection.`)];
    case "modelComparisonDecided":
      return [
        signal(
          "collaboration.comparingAlternatives",
          event.decisionJustified,
          event.decisionJustified
            ? `Compared ${event.alternativesCompared} alternative(s) and justified a choice.`
            : "Alternatives were not compared with a justified decision.",
        ),
        signal(
          "aiLiteracy.modelsCanDisagree",
          event.decisionJustified,
          "Learner expected alternative models to disagree and recorded the choice.",
        ),
      ];
    case "missionCompleted":
      return [];
    default:
      return [];
  }
}

/** Competencies an event kind can support, refined by the event payload. */
function competenciesForEvent(event: LearningEvidenceEvent): readonly string[] {
  const traced = EVENT_COMPETENCY_TRACE[event.kind];
  if (event.kind === "programRevisedAfterExecution") {
    const revision = REVISION_COMPETENCY[event.revisionKind] ?? traced;
    // A revision that followed a failed run also supports debugging, which the
    // event's own trace declares.
    return event.afterUnsuccessfulRun && !revision.includes("programming.debugging")
      ? [...revision, "programming.debugging"]
      : revision;
  }
  if (event.kind === "reflectionRecorded") {
    if (event.reflectionKind === "intent") {
      return ["collaboration.expressingIntent"];
    }
    if (event.reflectionKind === "decision") {
      return ["collaboration.explainingDecision"];
    }
    return ["aiLiteracy.fluentLanguageIsNotProof", "aiLiteracy.runtimeEvidenceMatters"];
  }
  return traced;
}

function buildIndicators(events: readonly LearningEvidenceEvent[]): readonly CompetencyIndicator[] {
  const signalsByCompetency = new Map<string, EvidenceSignal[]>();

  const push = (competencyId: string, signal: EvidenceSignal): void => {
    const existing = signalsByCompetency.get(competencyId) ?? [];
    existing.push(signal);
    signalsByCompetency.set(competencyId, existing);
  };

  for (const event of events) {
    const allowed = new Set(competenciesForEvent(event));
    for (const signal of signalsFor(event)) {
      // A signal may only speak for a competency the event's trace declares, so an
      // assessment can never credit a competency the event schema never supported.
      if (!allowed.has(signal.competencyId)) {
        throw new MissionAssessmentError(
          `$.${event.kind}`,
          `signal claims ${signal.competencyId}, which ${event.kind} does not trace`,
        );
      }
      push(signal.competencyId, signal);
    }
  }

  // Schema invariant: evidence validation forbids identity, free text, timing and
  // AI-usage fields, so private data is structurally unnecessary.
  for (const competencyId of SCHEMA_INVARIANT_COMPETENCIES) {
    signalsByCompetency.set(competencyId, [
      {
        eventId: "schema:evidence-validation",
        sequence: -1,
        assistanceLevel: "independent",
        competencyId,
        qualifies: true,
        detail: "Evidence schema accepts no identity, free-text, timing or AI-usage field.",
      },
    ]);
  }

  return COMPETENCIES.map((competency: CompetencyDefinition) => {
    const signals = signalsByCompetency.get(competency.id) ?? [];
    const ordered = [...signals].sort((a, b) => a.sequence - b.sequence);
    const source: IndicatorSource = SCHEMA_INVARIANT_COMPETENCIES.includes(competency.id)
      ? "schemaInvariant"
      : "learnerEvidence";
    const supporting = ordered.filter((signal) => signal.qualifies);
    const status: UnderstandingStatus =
      supporting.length > 0 ? "demonstrated" : ordered.length > 0 ? "partial" : "notObserved";
    const level = ordered.reduce<AssistanceLevel>(
      (worst, signal) =>
        ASSISTANCE_RANK[signal.assistanceLevel] > ASSISTANCE_RANK[worst]
          ? signal.assistanceLevel
          : worst,
      "independent",
    );
    const evidenceSummary =
      ordered.length === 0
        ? "no evidence recorded"
        : supporting.length > 0
          ? supporting.map((signal) => signal.detail).join(" ")
          : `evidence recorded but not sufficient: ${ordered
              .map((signal) => signal.detail)
              .join(" ")}`;
    return {
      competencyId: competency.id,
      dimension: competency.dimension,
      description: competency.description,
      status,
      source,
      supportingEventIds: supporting.map((signal) => signal.eventId),
      assistanceLevel: level,
      rationale: `${status}; assistance level ${level}; ${evidenceSummary.replace(/\.$/, "")}.`,
    } satisfies CompetencyIndicator;
  });
}

function buildOverAssistanceFlags(
  events: readonly LearningEvidenceEvent[],
): readonly OverAssistanceFlag[] {
  const flags: OverAssistanceFlag[] = [];
  for (const event of events) {
    if (event.kind === "scaffoldDelivered" && event.scaffoldKind === "solution") {
      flags.push({
        code: "aiSolvedBeforeLearnerActed",
        detail: "Companion delivered a full solution; learner authorship evidence is missing.",
        assistanceLevel: event.assistanceLevel,
      });
    }
    if (event.kind === "proposalDecided" && event.decision === "accept" && !event.inspectedDiff) {
      flags.push({
        code: "proposalAcceptedWithoutInspection",
        detail: "Proposal accepted without opening the diff.",
        assistanceLevel: event.assistanceLevel,
      });
    }
    if (
      event.kind === "scaffoldDelivered" &&
      !event.answeredByLearner &&
      ASSISTANCE_RANK[event.assistanceLevel] >= ASSISTANCE_RANK.hinted
    ) {
      flags.push({
        code: "learnerActionMissingUnderHighScaffolding",
        detail: "Scaffolding escalated while the learner took no recorded action.",
        assistanceLevel: event.assistanceLevel,
      });
    }
  }
  return flags;
}

function buildInterpretation(
  completion: CompletionAssessment,
  indicators: readonly CompetencyIndicator[],
  level: AssistanceLevel,
  flags: readonly OverAssistanceFlag[],
): MissionAssessmentReport["interpretation"] {
  const demonstrated = indicators.filter(
    (indicator) => indicator.status === "demonstrated" && indicator.source === "learnerEvidence",
  );
  const byDimension = new Map<CompetencyDimension, number>();
  for (const indicator of demonstrated) {
    byDimension.set(indicator.dimension, (byDimension.get(indicator.dimension) ?? 0) + 1);
  }
  const dimensionSummary = (["programming", "collaboration", "aiLiteracy"] as const)
    .map((dimension) => `${dimension} ${byDimension.get(dimension) ?? 0}`)
    .join(", ");

  const cautions: string[] = [];
  if (completion.completed && demonstrated.length === 0) {
    cautions.push(
      "Mission completed without any demonstrated understanding evidence; completion is not understanding.",
    );
  }
  if (level === "delegated") {
    cautions.push("Peak assistance was delegated to the AI; treat all indicators as assisted.");
  } else if (ASSISTANCE_RANK[level] >= ASSISTANCE_RANK.proposed) {
    cautions.push("Peak assistance reached the AI-proposal level; learner inspection is required.");
  }
  for (const flag of flags) {
    cautions.push(`${flag.code}: ${flag.detail}`);
  }

  return {
    completionStatement: completion.completed
      ? `Runtime proved completion (${completion.runtimeOutcome}).`
      : `Runtime did not prove completion (${completion.runtimeOutcome}).`,
    understandingStatement:
      demonstrated.length === 0
        ? "No competency is demonstrated by the recorded evidence."
        : `${demonstrated.length} of ${indicators.length} competencies demonstrated (${dimensionSummary}).`,
    assistanceStatement: `Peak assistance level: ${level}.`,
    cautions,
  };
}

export function assessMission(input: AssessMissionInput): MissionAssessmentReport {
  if (typeof input.missionId !== "string" || input.missionId.length === 0) {
    throw new MissionAssessmentError("$.missionId", "expected non-empty identifier");
  }
  if (!Number.isInteger(input.missionVersion) || input.missionVersion < 1) {
    throw new MissionAssessmentError("$.missionVersion", "expected positive integer");
  }
  const events = validateEvidenceEvents(input.events);
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);

  const completionEvent = ordered
    .filter(
      (event): event is Extract<LearningEvidenceEvent, { kind: "missionCompleted" }> =>
        event.kind === "missionCompleted",
    )
    .at(-1);

  const completion: CompletionAssessment = {
    completed: completionEvent?.runtimeOutcome === "completed",
    basis: "deterministicRuntime",
    runtimeOutcome: completionEvent?.runtimeOutcome ?? "notRun",
    impliesUnderstanding: false,
  };

  const indicators = buildIndicators(ordered);
  const level = peakAssistance(ordered);
  const flags = buildOverAssistanceFlags(ordered);

  return {
    schema: MISSION_ASSESSMENT_SCHEMA_VERSION,
    missionId: input.missionId,
    missionVersion: input.missionVersion,
    completion,
    understanding: {
      demonstrated: indicators
        .filter(
          (indicator) =>
            indicator.status === "demonstrated" && indicator.source === "learnerEvidence",
        )
        .map((indicator) => indicator.competencyId),
      partial: indicators
        .filter((indicator) => indicator.status === "partial")
        .map((indicator) => indicator.competencyId),
      notObserved: indicators
        .filter((indicator) => indicator.status === "notObserved")
        .map((indicator) => indicator.competencyId),
      schemaInvariantsProven: indicators
        .filter(
          (indicator) =>
            indicator.source === "schemaInvariant" && indicator.status === "demonstrated",
        )
        .map((indicator) => indicator.competencyId),
      indicators,
    },
    peakAssistanceLevel: level,
    overAssistanceFlags: flags,
    interpretation: buildInterpretation(completion, indicators, level, flags),
  };
}

/**
 * Credit factors, non-increasing in assistance rank. Exported so any downstream
 * metric can be tested against the same monotonicity guarantee.
 */
export const ASSISTANCE_CREDIT: Readonly<Record<AssistanceLevel, number>> = {
  independent: 1,
  hinted: 0.75,
  proposed: 0.4,
  delegated: 0,
};

const STATUS_WEIGHT: Readonly<Record<UnderstandingStatus, number>> = {
  demonstrated: 1,
  partial: 0.4,
  notObserved: 0,
};

/**
 * Assistance-adjusted understanding score in [0, 1]. A competency contributes
 * `statusWeight * assistanceCredit`, and assistance credit never grows as the
 * AI does more of the work.
 */
export function understandingScore(
  report: MissionAssessmentReport,
  dimension?: CompetencyDimension,
): number {
  const relevant = report.understanding.indicators.filter(
    (indicator) =>
      indicator.source === "learnerEvidence" &&
      (dimension === undefined || indicator.dimension === dimension),
  );
  if (relevant.length === 0) {
    return 0;
  }
  const total = relevant.reduce(
    (sum, indicator) =>
      sum + STATUS_WEIGHT[indicator.status] * ASSISTANCE_CREDIT[indicator.assistanceLevel],
    0,
  );
  return total / relevant.length;
}

export function assertAssistanceCreditMonotonic(): void {
  for (let i = 1; i < ASSISTANCE_LEVELS.length; i += 1) {
    const previous = ASSISTANCE_LEVELS[i - 1] as AssistanceLevel;
    const current = ASSISTANCE_LEVELS[i] as AssistanceLevel;
    if (ASSISTANCE_CREDIT[current] > ASSISTANCE_CREDIT[previous]) {
      throw new Error(
        `assistance credit increases from ${previous} to ${current}; metrics could reward over-assistance`,
      );
    }
  }
  if (ASSISTANCE_CREDIT.delegated !== 0) {
    throw new Error("delegated assistance must earn zero understanding credit");
  }
}

export { getCompetency, isCompetencyId };
