import { getOriAdvancedInstructions, ORI_ADVANCED_VERSION } from "./advanced.js";
import { getOriChatInstructions, ORI_CHAT_VERSION } from "./chat.js";
import { getOriGoalInstructions, ORI_GOAL_VERSION } from "./goals.js";
import { getOriAgentInstructions, ORI_AGENT_VERSION, type OriLocale } from "./index.js";
import { getOriStudioInstructions, ORI_STUDIO_VERSION } from "./studio.js";

/**
 * Ori's agents by role (issue #614). A role is a job with a closed output schema; the capability
 * is the switch an administrator already has (provider, model, limits, extra instruction). The
 * fixed contract and the safety rules below are part of the code, not of the configuration.
 */
export const ORI_AGENT_ROLES = ["classifier", "coach", "proposer", "composer"] as const;
export type OriAgentRole = (typeof ORI_AGENT_ROLES)[number];
export const ORI_AGENT_CAPABILITIES = ["chat", "mission", "studio", "advanced", "goals"] as const;
export type OriAgentCapability = (typeof ORI_AGENT_CAPABILITIES)[number];

export interface OriAgentDefinition {
  readonly capability: OriAgentCapability;
  readonly role: OriAgentRole;
  /** Version id of the output contract the host validates. */
  readonly contract: string;
  /** What the agent may return: closed kinds and ids only, never free text. */
  readonly outputs: readonly string[];
  /** What the agent receives besides ids: nothing from the child unless stated. */
  readonly input: "ids-only" | "untrusted-child-choice";
}

/**
 * A function, not a constant: the contract ids live in modules that import this package's index,
 * so reading them at load time would see them before they exist.
 */
export function getOriAgentDefinitions(): readonly OriAgentDefinition[] {
  return Object.freeze([
    {
      capability: "chat",
      role: "classifier",
      contract: ORI_CHAT_VERSION,
      outputs: [
        "replyId: blocks | move | turn | run | goal | app | stuck | help | hello | thanks | bored | sad | again | refusal",
      ],
      input: "untrusted-child-choice",
    },
    {
      capability: "mission",
      role: "coach",
      contract: ORI_AGENT_VERSION,
      outputs: [
        "program-suggestion: 1 to 3 blocks (move, turn, repeat) with a reason id",
        "refusal",
      ],
      input: "ids-only",
    },
    {
      capability: "studio",
      role: "proposer",
      contract: ORI_STUDIO_VERSION,
      outputs: ["program-suggestion: one move, turn or call of a block the child made", "refusal"],
      input: "ids-only",
    },
    {
      capability: "advanced",
      role: "proposer",
      contract: ORI_ADVANCED_VERSION,
      outputs: ["program-suggestion: one costume or sound id for the chosen character", "refusal"],
      input: "ids-only",
    },
    {
      capability: "goals",
      role: "composer",
      contract: ORI_GOAL_VERSION,
      outputs: ["goal: a cell of the grid and a check (reach or turn)"],
      input: "ids-only",
    },
  ]);
}

/** Rules every agent keeps whatever an administrator writes. Ids, not prose, so they can be tested. */
export const ORI_AGENT_LOCKED_RULES = Object.freeze([
  "closed-output-schema",
  "no-free-text-links-tools-or-personal-data",
  "host-validates-before-anything-changes",
  "child-reviews-and-decides",
  "deterministic-fallback",
  "runtime-proves",
] as const);

export function fixedOriInstructions(capability: OriAgentCapability, locale: OriLocale): string {
  switch (capability) {
    case "chat":
      return getOriChatInstructions(locale);
    case "mission":
      return getOriAgentInstructions(locale);
    case "studio":
      return getOriStudioInstructions(locale);
    case "advanced":
      return getOriAdvancedInstructions(locale);
    case "goals":
      return getOriGoalInstructions();
  }
}

/**
 * The only way an administrator's text reaches a model: after the fixed contract, labelled, and
 * never instead of it.
 */
export function composeOriInstructions(fixed: string, additional: string): string {
  return additional ? `${fixed}\n\nADMIN_ADDITIONAL_INSTRUCTIONS:\n${additional}` : fixed;
}
