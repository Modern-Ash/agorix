import type {
  LearningCompanionCapability,
  LearningCompanionScaffoldLevel,
} from "@agorix/tutor-contract";
import type { SolutionAllowance } from "./index.js";

export type LearningProgressionStage =
  "explore" | "connect" | "translate" | "collaborate" | "create" | "critique";
export type ExplanationDepth = "brief" | "guided" | "detailed";
export type RequiredLearnerPrompt = "none" | "prediction" | "reflection";

export interface ScaffoldingPolicyInput {
  readonly stage: LearningProgressionStage;
  readonly requestedCapability: LearningCompanionCapability;
  readonly attemptCount: number;
  readonly priorHintLevels: readonly LearningCompanionScaffoldLevel[];
  readonly strongerHelpRequested: boolean;
  readonly lessHelpRequested: boolean;
  readonly hasRuntimeEvidence: boolean;
  readonly priorProposalDecisions: readonly ("accepted" | "modified" | "rejected")[];
}

export interface ScaffoldingPolicy {
  readonly allowedCapability: LearningCompanionCapability;
  readonly maximumAssistanceLevel: LearningCompanionScaffoldLevel;
  readonly solutionAllowance: SolutionAllowance;
  readonly requiredLearnerPrompt: RequiredLearnerPrompt;
  readonly explanationDepth: ExplanationDepth;
  readonly reasons: readonly string[];
}

const STAGE_MAXIMUM: Readonly<Record<LearningProgressionStage, LearningCompanionScaffoldLevel>> = {
  explore: 2,
  connect: 3,
  translate: 3,
  collaborate: 4,
  create: 4,
  critique: 3,
};

export function resolveScaffoldingPolicy(input: ScaffoldingPolicyInput): ScaffoldingPolicy {
  const reasons: string[] = ["stage:" + input.stage];
  let maximum = STAGE_MAXIMUM[input.stage];
  if (input.attemptCount >= 3) {
    maximum = increment(maximum);
    reasons.push("repeated-attempts");
  }
  if (input.strongerHelpRequested) {
    maximum = increment(maximum);
    reasons.push("explicit-stronger-help");
  }
  if (input.lessHelpRequested) {
    maximum = Math.max(0, maximum - 1) as LearningCompanionScaffoldLevel;
    reasons.push("explicit-less-help");
  }
  const priorMaximum = input.priorHintLevels.reduce<LearningCompanionScaffoldLevel>(
    (value, level) => Math.max(value, level) as LearningCompanionScaffoldLevel,
    0,
  );
  if (input.attemptCount > 0 && priorMaximum > maximum) {
    maximum = priorMaximum;
    reasons.push("preserve-prior-help-level");
  }
  const completeAllowed =
    input.requestedCapability === "builder" &&
    input.strongerHelpRequested &&
    input.attemptCount >= 3 &&
    maximum >= 4;
  const solutionAllowance: SolutionAllowance =
    input.requestedCapability !== "builder" ? "none" : completeAllowed ? "complete" : "partial";
  const requiredLearnerPrompt: RequiredLearnerPrompt =
    input.requestedCapability === "challenger"
      ? "prediction"
      : input.requestedCapability === "reflector"
        ? "reflection"
        : input.requestedCapability === "builder" && maximum >= 3
          ? "prediction"
          : "none";
  const explanationDepth: ExplanationDepth =
    maximum <= 1 ? "brief" : maximum <= 3 ? "guided" : "detailed";
  if (input.requestedCapability === "debugger" && !input.hasRuntimeEvidence)
    reasons.push("debugger-awaits-runtime-evidence");
  if (input.priorProposalDecisions.includes("rejected"))
    reasons.push("learner-rejected-prior-proposal");
  return {
    allowedCapability: input.requestedCapability,
    maximumAssistanceLevel: maximum,
    solutionAllowance,
    requiredLearnerPrompt,
    explanationDepth,
    reasons,
  };
}

function increment(level: LearningCompanionScaffoldLevel): LearningCompanionScaffoldLevel {
  return Math.min(level + 1, 5) as LearningCompanionScaffoldLevel;
}
