/** Canonical, serializable AST-like representation of learner programs. */
export const PACKAGE_NAME = "@agorix/program-model";

export type {
  BooleanLiteralExpression,
  Expression,
  IfStatement,
  MoveStatement,
  NumericLiteralExpression,
  OnStartTrigger,
  ProjectProgram,
  RepeatStatement,
  Script,
  SchemaVersion,
  Statement,
  TouchingGoalExpression,
  Trigger,
  TurnStatement,
} from "./schema.js";
export { SCHEMA_VERSION } from "./schema.js";
export type { ProgramValidationErrorCode } from "./validate.js";
export { ProgramValidationError, validateProgram } from "./validate.js";
export {
  MAX_NESTING_DEPTH,
  MAX_PROGRAM_NODES,
  MOVE_STEPS_MAX,
  MOVE_STEPS_MIN,
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
} from "./limits.js";
