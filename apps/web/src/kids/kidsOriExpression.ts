import { useCallback, useEffect, useRef, useState } from "react";
import type { OriMotionState } from "./kidsOriMotion.js";

/**
 * Ori's face (issue #600). An expression is derived from something that really happened — a
 * request in flight, a proposal waiting, a run's outcome, a decision — never from a timer alone,
 * so Ori never looks busy or pleased without a reason. The failure face is encouraging, not sad.
 */
export const ORI_EXPRESSIONS = [
  "neutral",
  "curious",
  "thinking",
  "happy",
  "celebrate",
  "encourage",
] as const;
export type OriExpression = (typeof ORI_EXPRESSIONS)[number];

/** How the last run ended, as far as the face is concerned. */
export type OriOutcome = "good" | "retry" | "win";

export function expressionForMotion(
  motion: OriMotionState,
  outcome: OriOutcome | undefined,
): OriExpression {
  switch (motion) {
    case "thinking":
      return "thinking";
    case "proposal":
    case "listening":
      return "curious";
    case "observing":
      return outcome === "win"
        ? "celebrate"
        : outcome === "good"
          ? "happy"
          : outcome === "retry"
            ? "encourage"
            : "neutral";
    default:
      return "neutral";
  }
}

/** A finished program run: it either ran to the end or it needs another try. */
export function outcomeOfRun(outcome: string | undefined): OriOutcome | undefined {
  if (outcome === undefined) return undefined;
  return outcome === "completed" ? "good" : "retry";
}

/** The mission editor's Ori offer says whether the goal was reached or the sprite hit a wall. */
export function outcomeOfOffer(kind: string | undefined): OriOutcome | undefined {
  if (kind === "done") return "win";
  if (kind === "passed") return "good";
  if (kind === "wall") return "retry";
  return undefined;
}

/**
 * A short reaction to a decision (for example a child accepting an idea). It clears itself, and
 * nothing is shown after the component is gone.
 */
export function useOriReaction(
  milliseconds = 2600,
): readonly [OriExpression | null, (expression: OriExpression) => void] {
  const [reaction, setReaction] = useState<OriExpression | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const react = useCallback(
    (expression: OriExpression) => {
      if (timer.current !== null) clearTimeout(timer.current);
      setReaction(expression);
      timer.current = setTimeout(() => {
        timer.current = null;
        setReaction(null);
      }, milliseconds);
    },
    [milliseconds],
  );
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return [reaction, react];
}
