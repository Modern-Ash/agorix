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
