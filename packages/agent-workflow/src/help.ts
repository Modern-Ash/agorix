import type { AgentAgreements, AssistanceLevel } from "./assistance.js";

/** What kind of help the agent shows, ordered like the hint ladder in docs/product/PEDAGOGY.md. */
export type HelpKind = "question" | "concept" | "pointer" | "proposal";

export const HELP_KIND_LEVEL: Readonly<Record<HelpKind, AssistanceLevel>> = {
  question: 1,
  concept: 2,
  pointer: 3,
  proposal: 4,
};

const KINDS_BY_LEVEL: readonly HelpKind[] = ["question", "concept", "pointer", "proposal"];

export type CompanionActionName = "explain" | "challenge" | "debug" | "reflect" | "build";

/** The help kind each Companion action needs. */
export const COMPANION_ACTION_HELP: Readonly<Record<CompanionActionName, HelpKind>> = {
  challenge: "question",
  reflect: "question",
  explain: "concept",
  debug: "pointer",
  build: "proposal",
};

/**
 * The most the agent may show under the learner's ceiling (ADR 0008). Level 0 shows nothing.
 * Level 5 adds no new kind: a complete explanation needs an explicit request after repeated
 * failure, and a proposal never reaches it.
 */
export function highestHelpKind(agreements: AgentAgreements): HelpKind | undefined {
  const ceiling = agreements.assistanceCeiling;
  return ceiling <= 0 ? undefined : KINDS_BY_LEVEL[Math.min(ceiling, 4) - 1];
}

export function canShowHelp(agreements: AgentAgreements, kind: HelpKind): boolean {
  return agreements.assistanceCeiling >= HELP_KIND_LEVEL[kind];
}

export function canUseCompanionAction(
  agreements: AgentAgreements,
  action: CompanionActionName,
): boolean {
  return canShowHelp(agreements, COMPANION_ACTION_HELP[action]);
}
