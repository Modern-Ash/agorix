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

export interface VariableExpression {
  readonly type: "variable";
  readonly variableId: string;
}

export interface AddExpression {
  readonly type: "add";
  readonly left: Expression;
  readonly right: Expression;
}

export interface SubtractExpression {
  readonly type: "subtract";
  readonly left: Expression;
  readonly right: Expression;
}

export interface MultiplyExpression {
  readonly type: "multiply";
  readonly left: Expression;
  readonly right: Expression;
}

export interface DivideExpression {
  readonly type: "divide";
  readonly left: Expression;
  readonly right: Expression;
}

export interface LessThanExpression {
  readonly type: "lessThan";
  readonly left: Expression;
  readonly right: Expression;
}

export interface GreaterThanExpression {
  readonly type: "greaterThan";
  readonly left: Expression;
  readonly right: Expression;
}

export interface LessOrEqualExpression {
  readonly type: "lessOrEqual";
  readonly left: Expression;
  readonly right: Expression;
}

export interface GreaterOrEqualExpression {
  readonly type: "greaterOrEqual";
  readonly left: Expression;
  readonly right: Expression;
}

export interface EqualsExpression {
  readonly type: "equals";
  readonly left: Expression;
  readonly right: Expression;
}

export interface AndExpression {
  readonly type: "and";
  readonly left: Expression;
  readonly right: Expression;
}

export interface OrExpression {
  readonly type: "or";
  readonly left: Expression;
  readonly right: Expression;
}

export interface NotExpression {
  readonly type: "not";
  readonly value: Expression;
}

export interface RandomExpression {
  readonly type: "random";
  readonly min: Expression;
  readonly max: Expression;
}

/** Whole number in [min, max], both ends possible. Same seeded stream as `random`. */
export interface RandomIntegerExpression {
  readonly type: "randomInteger";
  readonly min: Expression;
  readonly max: Expression;
}

/** 1-based like Scratch. Out of range reads 0 and the runtime records a note; it never throws. */
export interface ListItemExpression {
  readonly type: "listItem";
  readonly listId: string;
  readonly index: Expression;
}

export interface ListLengthExpression {
  readonly type: "listLength";
  readonly listId: string;
}

export type Expression =
  | TouchingGoalExpression
  | BooleanLiteralExpression
  | NumericLiteralExpression
  | VariableExpression
  | AddExpression
  | SubtractExpression
  | MultiplyExpression
  | DivideExpression
  | LessThanExpression
  | GreaterThanExpression
  | LessOrEqualExpression
  | GreaterOrEqualExpression
  | RandomIntegerExpression
  | ListItemExpression
  | ListLengthExpression
  | EqualsExpression
  | AndExpression
  | OrExpression
  | NotExpression
  | RandomExpression;

// --- Statements -----------------------------------------------------------

export interface MoveStatement {
  readonly type: "move";
  readonly steps: number;
}

/** Places the sprite at a bounded stage coordinate without changing its heading. */
export interface GoToStatement {
  readonly type: "goTo";
  readonly x: number;
  readonly y: number;
}

export interface TurnStatement {
  readonly type: "turn";
  readonly degrees: number;
}

export interface SayStatement {
  readonly type: "say";
  readonly text: string;
}

export interface ThinkStatement {
  readonly type: "think";
  readonly text: string;
}

export interface ShowStatement {
  readonly type: "show";
}

export interface HideStatement {
  readonly type: "hide";
}

export interface SetSizeStatement {
  readonly type: "setSize";
  readonly size: number;
}

/** Pauses in virtual time only: ordering in the trace, never a real timer. */
export interface WaitStatement {
  readonly type: "wait";
  readonly seconds: number;
}

export interface SwitchCostumeStatement {
  readonly type: "switchCostume";
  readonly costumeId: string;
}

export interface SwitchBackdropStatement {
  readonly type: "switchBackdrop";
  readonly backdropId: string;
}

export interface PlaySoundStatement {
  readonly type: "playSound";
  readonly soundId: string;
}

export interface StopSoundsStatement {
  readonly type: "stopSounds";
}

export interface SetVolumeStatement {
  readonly type: "setVolume";
  readonly volume: number;
}

export interface ChangeVolumeStatement {
  readonly type: "changeVolume";
  readonly delta: number;
}

export interface BroadcastStatement {
  readonly type: "broadcast";
  readonly message: string;
}

export interface SetVariableStatement {
  readonly type: "setVariable";
  readonly variableId: string;
  readonly value: Expression;
}

export interface ChangeVariableStatement {
  readonly type: "changeVariable";
  readonly variableId: string;
  readonly delta: Expression;
}

export interface ShowVariableStatement {
  readonly type: "showVariable";
  readonly variableId: string;
}

export interface HideVariableStatement {
  readonly type: "hideVariable";
  readonly variableId: string;
}

export interface ListAddStatement {
  readonly type: "listAdd";
  readonly listId: string;
  readonly value: Expression;
}

export interface ListRemoveAtStatement {
  readonly type: "listRemoveAt";
  readonly listId: string;
  readonly index: Expression;
}

export interface ListInsertAtStatement {
  readonly type: "listInsertAt";
  readonly listId: string;
  readonly index: Expression;
  readonly value: Expression;
}

export interface ListReplaceAtStatement {
  readonly type: "listReplaceAt";
  readonly listId: string;
  readonly index: Expression;
  readonly value: Expression;
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
  /** Optional: absent in every program written before if/else existed. */
  readonly else?: readonly Statement[];
}

export type Statement =
  | MoveStatement
  | GoToStatement
  | TurnStatement
  | SayStatement
  | ThinkStatement
  | ShowStatement
  | HideStatement
  | SetSizeStatement
  | WaitStatement
  | SwitchCostumeStatement
  | SwitchBackdropStatement
  | PlaySoundStatement
  | StopSoundsStatement
  | SetVolumeStatement
  | ChangeVolumeStatement
  | BroadcastStatement
  | SetVariableStatement
  | ChangeVariableStatement
  | ShowVariableStatement
  | HideVariableStatement
  | ListAddStatement
  | ListRemoveAtStatement
  | ListInsertAtStatement
  | ListReplaceAtStatement
  | RepeatStatement
  | IfStatement;

// --- Triggers ---------------------------------------------------------------

export interface OnStartTrigger {
  readonly type: "onStart";
}

export interface GreenFlagTrigger {
  readonly type: "greenFlag";
}

export interface OnKeyPressedTrigger {
  readonly type: "onKeyPressed";
  readonly key: string;
}

export interface OnActorClickedTrigger {
  readonly type: "onActorClicked";
}

export interface OnMessageTrigger {
  readonly type: "onMessage";
  readonly message: string;
}

export type Trigger =
  | OnStartTrigger
  | GreenFlagTrigger
  | OnKeyPressedTrigger
  | OnActorClickedTrigger
  | OnMessageTrigger;

export type ProgramEvent = "greenFlag" | "actorClicked" | `key:${string}` | `message:${string}`;

// --- Script / ProjectProgram ------------------------------------------------

export interface ProgramVariable {
  readonly id: string;
  readonly name: string;
  readonly initialValue: number;
  readonly visible: boolean;
}

/** A list of numbers with a visible watcher flag, declared like a variable. */
export interface ProgramList {
  readonly id: string;
  readonly name: string;
  readonly initialItems: readonly number[];
  readonly visible: boolean;
}

export interface Script {
  /** Stable across editor round-trips when structure is unchanged (caller-supplied). */
  readonly id: string;
  readonly trigger: Trigger;
  readonly statements: readonly Statement[];
}

export interface ProjectProgram {
  readonly schema: SchemaVersion;
  readonly variables?: readonly ProgramVariable[];
  /** Optional: absent in every program written before lists existed. */
  readonly lists?: readonly ProgramList[];
  readonly scripts: readonly Script[];
}
