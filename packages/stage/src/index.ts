/** Framework-neutral stage state and commands; Phaser is the first renderer/adapter, not the domain authority. */
export const PACKAGE_NAME = "@agorix/stage";

export type {
  StageCommand,
  StageGoal,
  StagePosition,
  StageSession,
  StageSprite,
  StageState,
  StageStateInput,
  StageViewport,
} from "./model.js";
export {
  applyStageCommand,
  cloneStageState,
  createStageSession,
  createStageState,
  moveStage,
  normalizeStageCoordinate,
  normalizeStageHeading,
  resetStageSession,
  touchingStageGoal,
  turnStage,
} from "./model.js";
export type {
  ExecutionStep,
  ExecutionStepTiming,
  LearnerTraceItem,
  LearnerTraceProfile,
  LearnerTraceState,
  ObservationFrame,
  StageRenderAdapter,
  StageRenderFrame,
  StageRenderOptions,
  StageRenderer,
} from "./rendering.js";
export {
  createStageRenderAdapter,
  createStageRenderFrame,
  executionStepsFromRuntimeObservations,
  framesFromRuntimeObservations,
  learnerTraceFromExecutionSteps,
} from "./rendering.js";
