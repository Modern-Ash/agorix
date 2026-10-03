import type { StagePosition } from "./model.js";
import type { ObservationFrame } from "./rendering.js";

/** Run status as the host reports it; the World only presents it. */
export type StageRunStatus =
  "idle" | "running" | "stopped" | "complete" | "retry" | "error" | "freeplay";

export type StagePhase =
  "idle" | "running" | "stepping" | "stopped" | "success" | "retry" | "error";

export interface StageFeedbackInput {
  readonly frames: readonly ObservationFrame[];
  readonly index: number;
  readonly status: StageRunStatus;
  readonly stepping: boolean;
}

/** Everything here derives from runtime observations; no model claims enter. */
export interface StageFeedback {
  readonly phase: StagePhase;
  readonly activeNodeId?: string;
  readonly reachedGoal: boolean;
  /** Sprite positions observed up to and including the active frame. */
  readonly trail: readonly StagePosition[];
  /** 1-based position of the active observation, absent before any run. */
  readonly position?: number;
  readonly total: number;
}

function phaseFor(status: StageRunStatus, stepping: boolean, hasFrames: boolean): StagePhase {
  switch (status) {
    case "running":
      return "running";
    case "complete":
    case "freeplay":
      return "success";
    case "retry":
      return "retry";
    case "error":
      return "error";
    case "stopped":
      return stepping && hasFrames ? "stepping" : "stopped";
    case "idle":
      return "idle";
  }
}

export function deriveStageFeedback(input: StageFeedbackInput): StageFeedback {
  const { frames } = input;
  const hasFrames = frames.length > 0;
  const index = hasFrames ? Math.min(Math.max(input.index, 0), frames.length - 1) : 0;
  const active = frames[index];
  const trail: StagePosition[] = [];
  for (const frame of frames.slice(0, index + 1)) {
    const last = trail[trail.length - 1];
    if (last === undefined || last.x !== frame.state.sprite.x || last.y !== frame.state.sprite.y) {
      trail.push({ x: frame.state.sprite.x, y: frame.state.sprite.y });
    }
  }
  const phase = phaseFor(input.status, input.stepping, hasFrames);
  const settled = phase === "success" || phase === "retry";
  return Object.freeze({
    phase,
    ...(active?.highlightedNodeId === undefined || settled
      ? {}
      : { activeNodeId: active.highlightedNodeId }),
    reachedGoal: active?.reachedGoal ?? false,
    trail: Object.freeze(trail),
    ...(hasFrames ? { position: index + 1 } : {}),
    total: frames.length,
  });
}

export interface StageMotionPolicy {
  /** Sprite glide duration between runtime frames; 0 means jump. */
  readonly glideMs: number;
  readonly pulseGoal: boolean;
  readonly ambient: boolean;
}

/** WORLDS.md reduced motion: no pulses/ambient, near-instant position updates. */
export function resolveStageMotion(prefersReducedMotion: boolean): StageMotionPolicy {
  return prefersReducedMotion
    ? { glideMs: 0, pulseGoal: false, ambient: false }
    : { glideMs: 400, pulseGoal: true, ambient: true };
}
