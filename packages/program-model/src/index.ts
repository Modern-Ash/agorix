/** Canonical, serializable AST-like representation of learner programs. */
export const PACKAGE_NAME = "@agorix/program-model";

export type {
  BooleanLiteralExpression,
  BroadcastStatement,
  AddExpression,
  ChangeVariableStatement,
  DivideExpression,
  EqualsExpression,
  Expression,
  GreenFlagTrigger,
  HideVariableStatement,
  IfStatement,
  LessThanExpression,
  MoveStatement,
  MultiplyExpression,
  NumericLiteralExpression,
  OnActorClickedTrigger,
  OnKeyPressedTrigger,
  OnMessageTrigger,
  OnStartTrigger,
  PlaySoundStatement,
  ProgramEvent,
  ProgramVariable,
  ProjectProgram,
  RepeatStatement,
  Script,
  SchemaVersion,
  SetVariableStatement,
  ShowVariableStatement,
  StopSoundsStatement,
  Statement,
  SubtractExpression,
  TouchingGoalExpression,
  Trigger,
  TurnStatement,
  VariableExpression,
} from "./schema.js";
export { SCHEMA_VERSION } from "./schema.js";
export type {
  ProjectActor,
  ProjectAsset,
  ProjectAssetKind,
  ProjectCreativeState,
  ProjectStage,
} from "./creative.js";
export { validateProjectCreativeState } from "./creative.js";
export { eventForTrigger, migrateLegacyTriggers } from "./events.js";
export type { ProgramValidationErrorCode } from "./validate.js";
export { ProgramValidationError, validateProgram } from "./validate.js";
export {
  MAX_NESTING_DEPTH,
  MAX_PROGRAM_NODES,
  EVENT_KEY_MAX_LENGTH,
  EVENT_MESSAGE_MAX_LENGTH,
  LOOKS_TEXT_MAX_LENGTH,
  MOVE_STEPS_MAX,
  MOVE_STEPS_MIN,
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
  VARIABLE_NAME_MAX_LENGTH,
} from "./limits.js";
