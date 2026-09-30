/**
 * Competency catalog traced to issue #70 (docs/product/LEARNING_PROGRESSION.md).
 *
 * The catalog is the single mapping target for learning evidence. Every evidence
 * event type must declare which competencies it can support, so an assessment can
 * never silently produce a competency claim that has no observable source.
 */

export const COMPETENCY_DIMENSIONS = ["programming", "collaboration", "aiLiteracy"] as const;

export type CompetencyDimension = (typeof COMPETENCY_DIMENSIONS)[number];

export interface CompetencyDefinition {
  readonly id: string;
  readonly dimension: CompetencyDimension;
  /** Learner-facing wording, also used in the interpretation summary. */
  readonly description: string;
  /** Minimum stage from #70 that exercises this competency. */
  readonly introducedAtStage: number;
}

const define = (
  id: string,
  dimension: CompetencyDimension,
  description: string,
  introducedAtStage: number,
): CompetencyDefinition => ({ id, dimension, description, introducedAtStage });

export const COMPETENCIES: readonly CompetencyDefinition[] = [
  // Programming dimension (#70 "Programming" section).
  define(
    "programming.sequence",
    "programming",
    "Orders actions so a program does what was intended.",
    1,
  ),
  define(
    "programming.events",
    "programming",
    "Triggers behavior from an event such as run start.",
    1,
  ),
  define(
    "programming.repetition",
    "programming",
    "Repeats a block of actions a controlled number of times.",
    2,
  ),
  define("programming.conditions", "programming", "Chooses between paths using a condition.", 2),
  define(
    "programming.state.variables",
    "programming",
    "Stores and updates a value the program depends on.",
    5,
  ),
  define(
    "programming.decomposition.functions",
    "programming",
    "Splits behavior into named parts that can be reused and tested.",
    5,
  ),
  define(
    "programming.debugging",
    "programming",
    "Locates a defect from runtime evidence and repairs it.",
    2,
  ),
  define(
    "programming.readingCode",
    "programming",
    "Reads generated code as the program behind the blocks.",
    2,
  ),
  define(
    "programming.modifyingTextualCode",
    "programming",
    "Modifies textual code and keeps runtime proof central.",
    5,
  ),

  // Human-AI collaboration dimension (#70 "Human-AI collaboration" section).
  define(
    "collaboration.expressingIntent",
    "collaboration",
    "States the goal the program should achieve.",
    1,
  ),
  define(
    "collaboration.answeringClarifyingQuestions",
    "collaboration",
    "Answers a companion question with information about their own intent.",
    1,
  ),
  define(
    "collaboration.inspectingProposals",
    "collaboration",
    "Inspects a proposed change before it can reach the program.",
    4,
  ),
  define(
    "collaboration.decidingOnProposals",
    "collaboration",
    "Accepts, rejects or modifies a proposal and gives a reason.",
    4,
  ),
  define(
    "collaboration.predictingBehavior",
    "collaboration",
    "Predicts runtime behavior before running.",
    2,
  ),
  define(
    "collaboration.testingProposals",
    "collaboration",
    "Tests a proposal against runtime evidence.",
    4,
  ),
  define(
    "collaboration.challengingAiAnswer",
    "collaboration",
    "Challenges a companion answer using runtime facts.",
    4,
  ),
  define(
    "collaboration.comparingAlternatives",
    "collaboration",
    "Compares two approaches and identifies a trade-off.",
    6,
  ),
  define(
    "collaboration.explainingDecision",
    "collaboration",
    "Explains why a decision was made.",
    1,
  ),

  // AI literacy dimension (#70 "AI literacy" section).
  define("aiLiteracy.aiCanBeWrong", "aiLiteracy", "Treats a companion suggestion as fallible.", 1),
  define(
    "aiLiteracy.fluentLanguageIsNotProof",
    "aiLiteracy",
    "Does not accept fluent wording as proof.",
    2,
  ),
  define(
    "aiLiteracy.runtimeEvidenceMatters",
    "aiLiteracy",
    "Requires runtime evidence before believing a claim.",
    2,
  ),
  define(
    "aiLiteracy.modelsCanDisagree",
    "aiLiteracy",
    "Expects different models to give different answers.",
    6,
  ),
  define(
    "aiLiteracy.privateDataUnnecessary",
    "aiLiteracy",
    "Solves programming tasks without sharing private data.",
    1,
  ),
  define(
    "aiLiteracy.learnerIsAuthor",
    "aiLiteracy",
    "Keeps authorship and decisions with the learner.",
    4,
  ),
];

export const COMPETENCY_IDS: readonly string[] = COMPETENCIES.map((competency) => competency.id);

const COMPETENCY_BY_ID = new Map(COMPETENCIES.map((competency) => [competency.id, competency]));

export function isCompetencyId(value: unknown): value is string {
  return typeof value === "string" && COMPETENCY_BY_ID.has(value);
}

export function getCompetency(id: string): CompetencyDefinition {
  const competency = COMPETENCY_BY_ID.get(id);
  if (competency === undefined) {
    throw new Error(`Unknown competency: ${id}`);
  }
  return competency;
}

export function competenciesForDimension(
  dimension: CompetencyDimension,
): readonly CompetencyDefinition[] {
  return COMPETENCIES.filter((competency) => competency.dimension === dimension);
}
