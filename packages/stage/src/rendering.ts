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

export type LearnerTraceProfile = "beginner" | "studio";

export interface LearnerTraceState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

export interface LearnerTraceItem {
  readonly index: number;
  readonly runtimeStep: number;
  readonly nodeId?: string;
  readonly profile: LearnerTraceProfile;
  readonly title: string;
  readonly summary: string;
  readonly before: LearnerTraceState;
  readonly after: LearnerTraceState;
  readonly delta: LearnerTraceState;
  readonly conditionResult?: boolean;
  readonly iterationLabel?: string;
  readonly outcome?: RuntimeObservation["outcome"];
}

function freezeStageState(state: StageState): StageState {
  const cloned = cloneStageState(state);
  Object.freeze(cloned.sprite);
  Object.freeze(cloned.goal);
  Object.freeze(cloned.viewport);
  cloned.variables?.forEach((variable) => Object.freeze(variable));
  if (cloned.variables !== undefined) {
    Object.freeze(cloned.variables);
  }
  if (cloned.sounds !== undefined) {
    Object.freeze(cloned.sounds.activeSoundIds);
    Object.freeze(cloned.sounds);
  }
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
          ...(observation.world.sprite.visible === undefined
            ? {}
            : { visible: observation.world.sprite.visible }),
          ...(observation.world.sprite.size === undefined
            ? {}
            : { size: observation.world.sprite.size }),
          ...(observation.world.sprite.costumeId === undefined
            ? {}
            : { costumeId: observation.world.sprite.costumeId }),
          ...(observation.world.sprite.bubble === undefined
            ? {}
            : { bubble: observation.world.sprite.bubble }),
        },
        goal: observation.world.goal,
        ...(observation.world.backdropId === undefined
          ? {}
          : { backdropId: observation.world.backdropId }),
        ...(observation.world.variables === undefined
          ? {}
          : {
              variables: Object.entries(observation.world.variables).map(([id, variable]) => ({
                id,
                label: id,
                value: variable.value,
                visible: variable.visible,
              })),
            }),
        ...(observation.world.sounds === undefined
          ? {}
          : { sounds: { activeSoundIds: observation.world.sounds.activeSoundIds } }),
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

function traceStateFromObservation(observation: RuntimeObservation): LearnerTraceState {
  return {
    x: observation.world.sprite.x,
    y: observation.world.sprite.y,
    heading: observation.world.sprite.heading,
  };
}

function subtractState(after: LearnerTraceState, before: LearnerTraceState): LearnerTraceState {
  return {
    x: after.x - before.x,
    y: after.y - before.y,
    heading: after.heading - before.heading,
  };
}

function directionFor(delta: LearnerTraceState): string {
  if (delta.x > 0) return "right";
  if (delta.x < 0) return "left";
  if (delta.y > 0) return "up";
  if (delta.y < 0) return "down";
  if (delta.heading !== 0) return delta.heading > 0 ? "turned left" : "turned right";
  return "checked";
}

function makeSummary(
  profile: LearnerTraceProfile,
  step: ExecutionStep,
  before: LearnerTraceState,
  after: LearnerTraceState,
  delta: LearnerTraceState,
): string {
  if (step.timing === "complete") {
    return `Run ${step.observation.outcome ?? "completed"}`;
  }
  if (
    step.timing === "before-statement" ||
    step.timing === "enter-repeat" ||
    step.timing === "evaluate-condition"
  ) {
    if (step.statementType === "if") return "Checking the question";
    if (step.statementType === "repeat") return "Starting repeat";
    return "Ready to run this instruction";
  }
  if (step.statementType === "if") {
    const changed = delta.x !== 0 || delta.y !== 0 || delta.heading !== 0;
    return changed ? "Question was true" : "Question did not change the world";
  }
  if (step.statementType === "repeat") return "Repeat finished";
  if (step.statementType === "say") {
    return `Speech bubble: ${step.observation.world.sprite.bubble?.text ?? ""}`;
  }
  if (step.statementType === "think") {
    return `Thought bubble: ${step.observation.world.sprite.bubble?.text ?? ""}`;
  }
  if (step.statementType === "show") return "Sprite shown";
  if (step.statementType === "hide") return "Sprite hidden";
  if (step.statementType === "setSize") {
    return `Sprite size: ${step.observation.world.sprite.size}`;
  }
  if (step.statementType === "switchCostume") {
    return `Costume: ${step.observation.world.sprite.costumeId ?? "default"}`;
  }
  if (step.statementType === "switchBackdrop") {
    return `Backdrop: ${step.observation.world.backdropId ?? "default"}`;
  }
  if (step.statementType === "playSound") {
    const sounds = step.observation.world.sounds?.activeSoundIds ?? [];
    return sounds.length === 0 ? "Sound cue recorded" : `Sound playing: ${sounds.join(", ")}`;
  }
  if (step.statementType === "stopSounds") return "Sounds stopped";
  if (profile === "studio") {
    return `before: x=${before.x} y=${before.y} heading=${before.heading}; after: x=${after.x} y=${after.y} heading=${after.heading}`;
  }
  const direction = directionFor(delta);
  if (direction === "checked") return `No visible movement; x: ${before.x} -> ${after.x}`;
  return direction.startsWith("turned")
    ? `Nova ${direction}; heading: ${before.heading} -> ${after.heading}`
    : `Nova moved ${direction}; x: ${before.x} -> ${after.x}`;
}

function titleForStep(step: ExecutionStep, profile: LearnerTraceProfile): string {
  if (step.timing === "complete") return profile === "studio" ? "Run outcome" : "Done";
  if (profile === "studio") return `${step.nodeId ?? "$"} · ${step.statementType ?? "runtime"}`;
  switch (step.statementType) {
    case "move":
      return "Move";
    case "turn":
      return "Turn";
    case "repeat":
      return step.timing === "enter-repeat" ? "Repeat starts" : "Repeat ends";
    case "if":
      return "Question";
    case "say":
      return "Say";
    case "think":
      return "Think";
    case "show":
      return "Show";
    case "hide":
      return "Hide";
    case "setSize":
      return "Set size";
    case "switchCostume":
      return "Switch costume";
    case "switchBackdrop":
      return "Switch backdrop";
    case "playSound":
      return "Play sound";
    case "stopSounds":
      return "Stop sounds";
    default:
      return "Instruction";
  }
}

export function learnerTraceFromExecutionSteps(
  steps: readonly ExecutionStep[],
  profile: LearnerTraceProfile = "beginner",
): readonly LearnerTraceItem[] {
  return steps.map((step, index) => {
    const beforeObservation =
      step.timing === "after-statement" ||
      step.timing === "complete-repeat" ||
      step.timing === "complete-condition"
        ? (steps[index - 1]?.observation ?? step.observation)
        : step.observation;
    const before = traceStateFromObservation(beforeObservation);
    const after = traceStateFromObservation(step.observation);
    const delta = subtractState(after, before);
    const conditionResult =
      step.statementType === "if" && step.timing === "complete-condition"
        ? delta.x !== 0 || delta.y !== 0 || delta.heading !== 0
        : undefined;
    const iterationLabel = step.nodeId?.includes("/body[")
      ? `runtime step ${step.runtimeStep}`
      : undefined;
    return Object.freeze({
      index,
      runtimeStep: step.runtimeStep,
      ...(step.nodeId === undefined ? {} : { nodeId: step.nodeId }),
      profile,
      title: titleForStep(step, profile),
      summary: makeSummary(profile, step, before, after, delta),
      before,
      after,
      delta,
      ...(conditionResult === undefined ? {} : { conditionResult }),
      ...(iterationLabel === undefined ? {} : { iterationLabel }),
      ...(step.observation.outcome === undefined ? {} : { outcome: step.observation.outcome }),
    });
  });
}
