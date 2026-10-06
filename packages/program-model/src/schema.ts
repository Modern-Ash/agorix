/**
 * Canonical program schema (agorix/program/v1), per
 * docs/architecture/PROGRAMMING_MODEL.md. This is the versioned source of
 * truth for learner programs — the visual editor is a representation of this
 * model, never the authority.
 *
 * Every union below is discriminated by a `type` string-literal field,
 * matching PROGRAMMING_MODEL.md's own JSON example verbatim (clarified
 * decision, not a new convention).
 */

/** Schema-id namespace, not a semver number — a v2 shape would be a new literal. */
export const SCHEMA_VERSION = "agorix/program/v1";
export type SchemaVersion = typeof SCHEMA_VERSION;

// --- Expressions ---------------------------------------------------------

export interface TouchingGoalExpression {
  readonly type: "touchingGoal";
}

export interface BooleanLiteralExpression {
  readonly type: "booleanLiteral";
  readonly value: boolean;
}

export interface NumericLiteralExpression {
  readonly type: "numericLiteral";
  readonly value: number;
}

export type Expression =
  TouchingGoalExpression | BooleanLiteralExpression | NumericLiteralExpression;

// --- Statements -----------------------------------------------------------

export interface MoveStatement {
  readonly type: "move";
  readonly steps: number;
}

export interface TurnStatement {
  readonly type: "turn";
  readonly degrees: number;
}

export interface RepeatStatement {
  readonly type: "repeat";
  readonly count: number;
  readonly body: readonly Statement[];
}

export interface IfStatement {
  readonly type: "if";
  readonly condition: Expression;
  readonly then: readonly Statement[];
}

export type Statement = MoveStatement | TurnStatement | RepeatStatement | IfStatement;

// --- Triggers ---------------------------------------------------------------

export interface OnStartTrigger {
  readonly type: "onStart";
}

/** "When green flag clicked": the Scratch-familiar start event. */
export interface GreenFlagTrigger {
  readonly type: "greenFlag";
}

/**
 * What can start a script. `onStart` is the legacy "When you press Run" hat; it still loads and
 * runs, and means the same event as `greenFlag`. New programs use `greenFlag`.
 */
export type Trigger = OnStartTrigger | GreenFlagTrigger;

/** Events a run can dispatch. Key press, sprite click and messages will join this list. */
export type ProgramEvent = "greenFlag";

// --- Script / ProjectProgram ------------------------------------------------

export interface Script {
  /** Stable across editor round-trips when structure is unchanged (caller-supplied). */
  readonly id: string;
  readonly trigger: Trigger;
  readonly statements: readonly Statement[];
}

export interface ProjectProgram {
  readonly schema: SchemaVersion;
  readonly scripts: readonly Script[];
}
