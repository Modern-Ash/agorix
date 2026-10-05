import { msg } from "../messages.js";
import type { ProactiveDecision } from "@agorix/learning-decision-plane";

export type AmbientIndicatorState = "quiet" | "available" | "working" | "off" | "budget-capped";

export interface AmbientIndicatorView {
  readonly text: string;
  readonly tooltip: string;
  readonly command?: string;
}

export interface AmbientIndicatorInput {
  readonly state: AmbientIndicatorState;
  readonly offer?: {
    readonly reason: ProactiveDecision["reason"];
    readonly source: ProactiveDecision["source"];
  };
}

const VIEWS: Record<AmbientIndicatorState, AmbientIndicatorView> = {
  quiet: {
    text: msg("$(sparkle)"),
    tooltip: msg("Learning Companion is quiet."),
  },
  available: {
    text: msg("$(lightbulb) Companion"),
    tooltip: msg("Learning Companion has a suggestion."),
    command: "agorixStudio.ambientOffer",
  },
  working: {
    text: msg("$(sync~spin) Companion"),
    tooltip: msg("Learning Companion is working."),
  },
  off: {
    text: msg("$(circle-slash) Companion"),
    tooltip: msg("Learning Companion is off or unavailable."),
  },
  "budget-capped": {
    text: msg("$(warning) Companion"),
    tooltip: msg("Learning Companion paused at the budget cap."),
  },
};

export function ambientIndicatorView(input: AmbientIndicatorInput): AmbientIndicatorView {
  const base = VIEWS[input.state];
  if (input.state !== "available" || input.offer === undefined) return base;
  return {
    ...base,
    tooltip: `Learning Companion can help now (${input.offer.reason}; ${input.offer.source}).`,
  };
}
