import type { LearningRequirements } from "./index.js";
import type { LearningCompanionRequest, LearningCompanionResponse } from "@agorix/tutor-contract";

export type BuilderProposalPermission = "forbidden" | "bounded" | "complete";

export function builderProposalPermission(
  requirements: LearningRequirements,
): BuilderProposalPermission {
  if (requirements.learningCapability !== "builder") return "forbidden";
  if (requirements.solutionAllowance === "none") return "forbidden";
  return requirements.solutionAllowance === "complete" ? "complete" : "bounded";
}

export function assertBuilderResponseAllowed(
  request: LearningCompanionRequest,
  response: LearningCompanionResponse,
  requirements: LearningRequirements,
): void {
  if (response.capability !== "builder") return;
  if (request.capability !== "builder" || requirements.learningCapability !== "builder") {
    throw new Error("builder proposal requires builder capability");
  }
  const permission = builderProposalPermission(requirements);
  if (permission === "forbidden")
    throw new Error("builder proposal forbidden by learning requirements");
  if (permission === "bounded" && response.payload.proposal.operations.length > 1) {
    throw new Error("bounded builder assistance permits at most one proposal operation");
  }
}
