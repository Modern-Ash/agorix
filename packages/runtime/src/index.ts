/** Executes program-model deterministically and produces serializable runtime results. */
export const PACKAGE_NAME = "@agorix/runtime";

export {
  DEFAULT_EXECUTION_BUDGET,
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
export { RuntimeExecutionError } from "./errors.js";
export {
  assertAllowedRuntimeOperation,
  assertProgramOperationsAllowed,
  isAllowedRuntimeOperation,
  listRuntimeOperations,
  RUNTIME_EXPRESSION_OPERATIONS,
  RUNTIME_OPERATIONS,
  RUNTIME_STATEMENT_OPERATIONS,
  RUNTIME_TRIGGER_OPERATIONS,
  type RuntimeOperation,
  type RuntimeOperationAllowlistIsExhaustive,
  type RuntimeOperationKind,
} from "./operations.js";
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
