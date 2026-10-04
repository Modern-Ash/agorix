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
    text: "$(sparkle)",
    tooltip: "Learning Companion is quiet.",
  },
  available: {
    text: "$(lightbulb) Companion",
    tooltip: "Learning Companion has a suggestion.",
    command: "agorixStudio.ambientOffer",
  },
  working: {
    text: "$(sync~spin) Companion",
    tooltip: "Learning Companion is working.",
  },
  off: {
    text: "$(circle-slash) Companion",
    tooltip: "Learning Companion is off or unavailable.",
  },
  "budget-capped": {
    text: "$(warning) Companion",
    tooltip: "Learning Companion paused at the budget cap.",
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
