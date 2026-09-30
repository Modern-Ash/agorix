import type { LearningCompanionCapability, LearningCompanionRequest } from "@agorix/tutor-contract";
import type { LearningContextNeed, SolutionAllowance } from "./index.js";
import type { RequiredLearnerPrompt } from "./scaffolding.js";

export interface LearningRoleProfile {
  readonly capability: LearningCompanionCapability;
  readonly defaultContext: LearningContextNeed;
  readonly solutionAllowance: SolutionAllowance;
  readonly requiredPrompt: RequiredLearnerPrompt;
  readonly deterministicWhen: "always" | "no-runtime" | "runtime-available" | "never";
}

const PROFILES: Readonly<Record<LearningCompanionCapability, LearningRoleProfile>> = {
  coach: { capability: "coach", defaultContext: "bounded", solutionAllowance: "none", requiredPrompt: "none", deterministicWhen: "never" },
  builder: { capability: "builder", defaultContext: "program", solutionAllowance: "partial", requiredPrompt: "prediction", deterministicWhen: "never" },
  debugger: { capability: "debugger", defaultContext: "runtime", solutionAllowance: "none", requiredPrompt: "none", deterministicWhen: "no-runtime" },
  explainer: { capability: "explainer", defaultContext: "program", solutionAllowance: "none", requiredPrompt: "none", deterministicWhen: "never" },
  challenger: { capability: "challenger", defaultContext: "program", solutionAllowance: "none", requiredPrompt: "prediction", deterministicWhen: "always" },
  reflector: { capability: "reflector", defaultContext: "runtime", solutionAllowance: "none", requiredPrompt: "reflection", deterministicWhen: "runtime-available" },
};

export function learningRoleProfile(capability: LearningCompanionCapability): LearningRoleProfile {
  return PROFILES[capability];
}

export function roleCanUseDeterministicFixture(request: LearningCompanionRequest): boolean {
  const mode = PROFILES[request.capability].deterministicWhen;
  if (mode === "always") return true;
  if (mode === "no-runtime") return request.runtime === undefined || request.runtimeFacts.length === 0;
  if (mode === "runtime-available") return request.runtime !== undefined && request.runtimeFacts.length > 0;
  return false;
}
