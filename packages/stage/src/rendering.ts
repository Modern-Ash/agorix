import type { RuntimeObservation } from "@agorix/runtime";
import { cloneStageState, createStageState, touchingStageGoal, type StageState } from "./model.js";

export interface StageRenderFrame {
  readonly state: StageState;
  readonly highlightedNodeId?: string;
  readonly running: boolean;
  readonly reachedGoal: boolean;
}

export interface StageRenderer {
  readonly render: (frame: StageRenderFrame) => void;
  readonly resize?: (width: number, height: number) => void;
  readonly destroy?: () => void;
}

export interface StageRenderAdapter {
  readonly renderState: (state: StageState, options?: StageRenderOptions) => StageRenderFrame;
  readonly destroy: () => void;
}

export interface StageRenderOptions {
  readonly highlightedNodeId?: string;
  readonly running?: boolean;
}

export interface ObservationFrame extends StageRenderFrame {
  readonly step: number;
  readonly kind: RuntimeObservation["kind"];
}

export type ExecutionStepTiming =
  | "before-statement"
  | "after-statement"
  | "enter-repeat"
  | "complete-repeat"
  | "evaluate-condition"
  | "complete-condition"
  | "complete";

export interface ExecutionStep {
  readonly index: number;
  readonly runtimeStep: number;
  readonly nodeId?: string;
  readonly statementType?: RuntimeObservation["statementType"];
  readonly timing: ExecutionStepTiming;
  readonly frame: ObservationFrame;
  readonly observation: RuntimeObservation;
}

function freezeStageState(state: StageState): StageState {
  const cloned = cloneStageState(state);
  Object.freeze(cloned.sprite);
  Object.freeze(cloned.goal);
  Object.freeze(cloned.viewport);
  return Object.freeze(cloned);
}

export function createStageRenderFrame(
  state: StageState,
  options: StageRenderOptions = {},
): StageRenderFrame {
  const frozenState = freezeStageState(state);
  return Object.freeze({
    state: frozenState,
    ...(options.highlightedNodeId === undefined
      ? {}
      : { highlightedNodeId: options.highlightedNodeId }),
    running: options.running ?? false,
    reachedGoal: touchingStageGoal(frozenState),
  });
}

export function createStageRenderAdapter(renderer: StageRenderer): StageRenderAdapter {
  return {
    renderState(state, options = {}) {
      const frame = createStageRenderFrame(state, options);
      renderer.render(frame);
      return frame;
    },
    destroy() {
      renderer.destroy?.();
    },
  };
}

export function framesFromRuntimeObservations(
  observations: readonly RuntimeObservation[],
): readonly ObservationFrame[] {
  return observations.map((observation) => ({
    ...createStageRenderFrame(
      createStageState({
        sprite: {
          x: observation.world.sprite.x,
          y: observation.world.sprite.y,
          heading: observation.world.sprite.heading,
        },
        goal: observation.world.goal,
      }),
      {
        ...(observation.nodeId === "$" ? {} : { highlightedNodeId: observation.nodeId }),
        running: observation.kind !== "run-complete",
      },
    ),
    step: observation.step,
    kind: observation.kind,
  }));
}

function timingForObservation(observation: RuntimeObservation): ExecutionStepTiming {
  if (observation.kind === "run-complete") {
    return "complete";
  }
  if (observation.statementType === "repeat") {
    return observation.kind === "statement-start" ? "enter-repeat" : "complete-repeat";
  }
  if (observation.statementType === "if") {
    return observation.kind === "statement-start" ? "evaluate-condition" : "complete-condition";
  }
  return observation.kind === "statement-start" ? "before-statement" : "after-statement";
}

export function executionStepsFromRuntimeObservations(
  observations: readonly RuntimeObservation[],
): readonly ExecutionStep[] {
  const frames = framesFromRuntimeObservations(observations);
  return observations.map((observation, index) => {
    const nodeId = observation.nodeId === "$" ? undefined : observation.nodeId;
    return Object.freeze({
      index,
      runtimeStep: observation.step,
      ...(nodeId === undefined ? {} : { nodeId }),
      ...(observation.statementType === undefined
        ? {}
        : { statementType: observation.statementType }),
      timing: timingForObservation(observation),
      frame: frames[index]!,
      observation,
    });
  });
}
