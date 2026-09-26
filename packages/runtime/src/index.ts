/** Executes program-model deterministically and produces serializable runtime results. */
export const PACKAGE_NAME = "@agorix/runtime";

export {
  DEFAULT_EXECUTION_BUDGET,
  RuntimeExecutionError,
  runProgram,
  type ExecutionBoundary,
  toSanitizedTutorContext,
  type ExecutionOptions,
  type ExecutionTraceEntry,
  type RunOutcome,
  type RunResult,
  type RuntimeObservation,
  type RuntimeObservationKind,
  type SanitizedTutorContext,
} from "./execute.js";
export {
  cloneWorldState,
  createWorldState,
  moveWorld,
  normalizeCoordinate,
  normalizeHeading,
  resetWorldState,
  touchingGoal,
  turnWorld,
  type Position,
  type SpriteState,
  type WorldState,
  type WorldStateInput,
} from "./world.js";
