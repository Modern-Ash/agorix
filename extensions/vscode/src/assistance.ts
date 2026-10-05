import {
  canShowHelp,
  canUseCompanionAction,
  type AgentAgreements,
  type CompanionActionName,
} from "@agorix/agent-workflow";
import type { ProactiveOfferAction } from "@agorix/learning-decision-plane";

/** One plain sentence for any surface that declines because of the learner's help level (ADR 0008). */
export function ceilingMessage(agreements: AgentAgreements): string {
  return `Your help level is ${agreements.assistanceCeiling}. Raise it in the agent agreements to use this.`;
}

export function canPropose(agreements: AgentAgreements): boolean {
  return canShowHelp(agreements, "proposal");
}

export function canDoCompanionAction(
  agreements: AgentAgreements,
  action: CompanionActionName,
): boolean {
  return canUseCompanionAction(agreements, action);
}

/** An ambient offer names "propose"; the Companion calls the same thing "build". */
export function offerActionAllowed(
  agreements: AgentAgreements,
  action: ProactiveOfferAction,
): boolean {
  return canUseCompanionAction(agreements, action === "propose" ? "build" : action);
}
