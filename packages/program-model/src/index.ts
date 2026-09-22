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
export { ProgramValidationError, validateProgram } from "./validate.js";
