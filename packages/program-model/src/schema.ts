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

/** True when a visible actor is within the runtime's contact radius. */
export interface TouchingActorExpression {
  readonly type: "touchingActor";
  readonly actorId: string;
}

/**
 * True while the character is over a stretch of the stage that is this colour, from a closed list.
 * Which stretches are which colour is a property of the backdrop (its colour zones), not of pixels.
 */
export interface TouchingColorExpression {
  readonly type: "touchingColor";
  readonly color: PenColor;
}

/** Rectangle is explicit so an exported program keeps its stage-edge meaning. */
export interface TouchingStageEdgeExpression {
  readonly type: "touchingStageEdge";
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Center distance; -1 means the target actor is absent. Visibility does not affect position. */
export interface DistanceToActorExpression {
  readonly type: "distanceToActor";
  readonly actorId: string;
}

/** Reads a declared property from another actor's runtime state, as Scratch's "of" reporter. */
export const ACTOR_PROPERTIES = [
  "xPosition",
  "yPosition",
  "direction",
  "size",
  "costumeNumber",
  "costumeName",
  "volume",
  "variable",
] as const;
export type ActorProperty = (typeof ACTOR_PROPERTIES)[number];
export interface ActorPropertyExpression {
  readonly type: "actorProperty";
  readonly actorId: string;
  readonly property: ActorProperty;
  /** Required for a variable property; refers to a declared number or word variable. */
  readonly variableId?: string;
}

/** Heading in degrees, as set by turn and point in direction. */
export interface DirectionExpression {
  readonly type: "direction";
}

export interface XPositionExpression {
  readonly type: "xPosition";
}

/** The character's size in percent, 100 when it was never changed. */
export interface SizePercentExpression {
  readonly type: "sizePercent";
}

/** Virtual seconds this script has waited so far in the current run; never a wall clock. */
export interface TimerExpression {
  readonly type: "timer";
}

/** True while the key is held: the key that started this script, or a key given to the run. */
export interface KeyDownExpression {
  readonly type: "keyDown";
  readonly key: string;
}

/**
 * How loud it is, 0 to 100, as a whole number the caller measured. Only this number reaches the
 * program, never the sound; 0 when nothing measured it.
 */
export interface LoudnessExpression {
  readonly type: "loudness";
}

/**
 * Which costume the character wears, as a whole number counted from 1 in the order the project
 * lists the character's costumes; 0 when the project lists none for it.
 */
export interface CostumeNumberExpression {
  readonly type: "costumeNumber";
}

/** The parts of the clock a program can read, as whole numbers (Scratch: current year, month, ...). */
export const CLOCK_PARTS = [
  "year",
  "month",
  "date",
  "dayOfWeek",
  "hour",
  "minute",
  "second",
] as const;
export type ClockPart = (typeof CLOCK_PARTS)[number];

/**
 * One part of the device clock, read by the caller and handed to the run (never read from a global),
 * so a replay gives the same value. 0 when the caller gave no clock.
 */
export interface CurrentTimeExpression {
  readonly type: "currentTime";
  readonly part: ClockPart;
}

/** Which backdrop the stage shows, counted from 1 in the project's backdrop order; 0 when unlisted. */
export interface BackdropNumberExpression {
  readonly type: "backdropNumber";
}

/** Coordinates and pressed state captured from the stage for this run. */
/** True while the character is within the contact radius of the pointer (Scratch: touching mouse-pointer). */
export interface TouchingMouseExpression {
  readonly type: "touchingMouse";
}

/** Centre distance to the pointer on the stage (Scratch: distance to mouse-pointer). */
export interface DistanceToMouseExpression {
  readonly type: "distanceToMouse";
}

export interface MouseXExpression {
  readonly type: "mouseX";
}
export interface MouseYExpression {
  readonly type: "mouseY";
}
export interface MouseDownExpression {
  readonly type: "mouseDown";
}

export interface YPositionExpression {
  readonly type: "yPosition";
}

export interface BooleanLiteralExpression {
  readonly type: "booleanLiteral";
  readonly value: boolean;
}

export interface NumericLiteralExpression {
  readonly type: "numericLiteral";
  readonly value: number;
}

/** A word or phrase written in the program (at most TEXT_VALUE_MAX_LENGTH characters). */
export interface TextLiteralExpression {
  readonly type: "textLiteral";
  readonly value: string;
}

export interface TextVariableExpression {
  readonly type: "textVariable";
  readonly variableId: string;
}

/** Scratch's "join": the two values written one after the other (numbers as digits). */
export interface JoinExpression {
  readonly type: "join";
  readonly left: Expression;
  readonly right: Expression;
}

/** How many letters the text has. */
export interface TextLengthExpression {
  readonly type: "textLength";
  readonly value: Expression;
}

/** The letter at a 1-based place; empty when the place is outside the text. */
export interface LetterOfExpression {
  readonly type: "letterOf";
  readonly index: Expression;
  readonly value: Expression;
}

/** True when `part` appears inside `text`, ignoring upper and lower case. */
export interface TextContainsExpression {
  readonly type: "textContains";
  readonly text: Expression;
  readonly part: Expression;
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

/** Floored remainder: the result takes the sign of the right operand. */
export interface ModuloExpression {
  readonly type: "modulo";
  readonly left: Expression;
  readonly right: Expression;
}

export type MathFunction =
  | "abs"
  | "round"
  | "floor"
  | "ceiling"
  | "sqrt"
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "ln"
  | "log"
  | "exp"
  | "pow10";

/** Round half up (toward positive infinity), as Scratch does. */
export interface MathFunctionExpression {
  readonly type: "mathFunction";
  readonly function: MathFunction;
  readonly value: Expression;
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
/** The number a custom block received for `paramId`; valid only inside that block's body. */
export interface ParamExpression {
  readonly type: "param";
  readonly paramId: ProcedureParamId;
}

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

export interface ListContainsExpression {
  readonly type: "listContains";
  readonly listId: string;
  readonly value: Expression;
}

export interface ListIndexOfExpression {
  readonly type: "listIndexOf";
  readonly listId: string;
  readonly value: Expression;
}

export type Expression =
  | TouchingGoalExpression
  | TouchingActorExpression
  | TouchingStageEdgeExpression
  | TouchingColorExpression
  | DistanceToActorExpression
  | ActorPropertyExpression
  | TouchingMouseExpression
  | DistanceToMouseExpression
  | XPositionExpression
  | DirectionExpression
  | SizePercentExpression
  | TimerExpression
  | KeyDownExpression
  | LoudnessExpression
  | CostumeNumberExpression
  | BackdropNumberExpression
  | CurrentTimeExpression
  | MouseXExpression
  | MouseYExpression
  | MouseDownExpression
  | YPositionExpression
  | BooleanLiteralExpression
  | NumericLiteralExpression
  | VariableExpression
  | TextLiteralExpression
  | TextVariableExpression
  | JoinExpression
  | TextLengthExpression
  | LetterOfExpression
  | TextContainsExpression
  | AddExpression
  | SubtractExpression
  | MultiplyExpression
  | DivideExpression
  | ModuloExpression
  | MathFunctionExpression
  | LessThanExpression
  | GreaterThanExpression
  | LessOrEqualExpression
  | GreaterOrEqualExpression
  | RandomIntegerExpression
  | ParamExpression
  | ListItemExpression
  | ListLengthExpression
  | ListContainsExpression
  | ListIndexOfExpression
  | EqualsExpression
  | AndExpression
  | OrExpression
  | NotExpression
  | RandomExpression;

// --- Statements -----------------------------------------------------------

/** The numbers a custom block can take; positional, so a call's `args[i]` fills `params[i]`. */
export type ProcedureParamId = "p1" | "p2" | "p3" | "p4" | "p5";

export interface MoveStatement {
  readonly type: "move";
  readonly steps: number;
  /**
   * Inside a custom block: take the steps from that block's number instead. `steps` stays as the
   * fixed value for anything that reads only the fixed program (and must itself be valid).
   */
  readonly stepsFrom?: ProcedureParamId;
}

/** Places the sprite at a bounded stage coordinate without changing its heading. */
export interface GoToStatement {
  readonly type: "goTo";
  readonly x: number;
  readonly y: number;
}

export type GoToTarget = "random" | "mouse" | "actor";

/** How the copies of a character arrange themselves: in a row, falling from the top, or trailing it. */
export type CopyRule = "spread" | "fall" | "follow";

/**
 * Copies of the character that exist only while the program runs: a crowd, falling stars, a tail.
 * They are drawn like the character, run no program of their own and cannot be sensed, so
 * nothing else has to name them. A run keeps at most 20 live copies; past that, none are added.
 */
export interface CreateCopiesStatement {
  readonly type: "createCopies";
  readonly count: number;
  readonly rule: CopyRule;
  /**
   * Each copy also runs the character's "when I start as a clone" script, as a character of its
   * own for the run (Scratch: create clone of myself). The rule only decides where it starts.
   */
  readonly withScript?: boolean;
}

/** How the character's picture follows its heading: Scratch's three rotation styles. */
export type RotationStyle = "all" | "leftRight" | "none";

/** Scratch's "set rotation style": turn all around, only face left or right, or never rotate. */
export interface SetRotationStyleStatement {
  readonly type: "setRotationStyle";
  readonly style: RotationStyle;
}

/**
 * Scratch's "go to random position" and "go to mouse-pointer": the sprite jumps inside the stage
 * to a seeded random spot, or to the pointer captured for the run.
 */
export interface GoToTargetStatement {
  readonly type: "goToTarget";
  readonly target: GoToTarget;
  /** The character to go to; present exactly when the target is "actor". */
  readonly actorId?: string;
  /** Scratch's "glide": the trip takes this many seconds (absent: the character jumps there). */
  readonly seconds?: number;
}

/** Sets only the x coordinate; y and heading stay as they are. */
export interface SetXStatement {
  readonly type: "setX";
  readonly x: number;
}

/** Sets only the y coordinate; x and heading stay as they are. */
export interface SetYStatement {
  readonly type: "setY";
  readonly y: number;
}

/** Moves the sprite sideways by dx without turning it. */
export interface ChangeXStatement {
  readonly type: "changeX";
  readonly dx: number;
}

/** Moves the sprite up or down by dy without turning it. */
export interface ChangeYStatement {
  readonly type: "changeY";
  readonly dy: number;
}

/** Ends at the target like goTo and spends the given virtual seconds; no in-between positions. */
export interface GlideToStatement {
  readonly type: "glideTo";
  readonly x: number;
  readonly y: number;
  readonly seconds: number;
}

export interface TurnStatement {
  readonly type: "turn";
  readonly degrees: number;
  readonly degreesFrom?: ProcedureParamId;
}

export interface PointInDirectionStatement {
  readonly type: "pointInDirection";
  readonly degrees: number;
}

export interface PointTowardsStatement {
  readonly type: "pointTowards";
  readonly actorId: string;
}

export interface BounceOnEdgeStatement {
  readonly type: "bounceOnEdge";
}

/**
 * Reorders the stage only; it never changes which character runs first. "forward" and "backward"
 * move the character that many places (Scratch: go forward/backward N layers) and carry `steps`.
 */
export interface GoToLayerStatement {
  readonly type: "goToLayer";
  readonly layer: "front" | "back" | "forward" | "backward";
  readonly steps?: number;
}

export type GraphicEffect = "color" | "ghost" | "brightness";

/** Sets one graphic effect of the running character. */
export interface SetEffectStatement {
  readonly type: "setEffect";
  readonly effect: GraphicEffect;
  readonly value: number;
}

export interface ChangeEffectStatement {
  readonly type: "changeEffect";
  readonly effect: GraphicEffect;
  readonly delta: number;
}

/** The pen extension (ADR 0011): a closed palette, so a drawing never carries a free colour. */
/** How see-through the pen draws, in percent: a closed list, so a trail stays easy to read. */
export const PEN_TRANSPARENCIES = [0, 25, 50, 75] as const;
export type PenTransparency = (typeof PEN_TRANSPARENCIES)[number];

/** How light or deep the pen colour draws, a closed list: normal is the colour as chosen. */
export const PEN_SHADES = ["lighter", "normal", "darker"] as const;
export type PenShade = (typeof PEN_SHADES)[number];

export const PEN_COLORS = ["dark", "red", "orange", "green", "blue", "purple"] as const;
export type PenColor = (typeof PEN_COLORS)[number];

export interface PenDownStatement {
  readonly type: "penDown";
}

export interface PenUpStatement {
  readonly type: "penUp";
}

export interface SetPenColorStatement {
  readonly type: "setPenColor";
  readonly color: PenColor;
}

export interface SetPenTransparencyStatement {
  readonly type: "setPenTransparency";
  readonly percent: PenTransparency;
}

export interface SetPenShadeStatement {
  readonly type: "setPenShade";
  readonly shade: PenShade;
}

export interface SetPenSizeStatement {
  readonly type: "setPenSize";
  readonly size: number;
}

/** Leaves a copy of the character on the stage, drawn where it is now (pen pack). */
export interface StampStatement {
  readonly type: "stamp";
}

export interface ClearPenStatement {
  readonly type: "clearPen";
}

/** The music extension (ADR 0011): closed lists and small whole numbers, so a tune stays tiny. */
export const MUSIC_INSTRUMENTS = ["piano", "flute", "guitar", "bell"] as const;
export type MusicInstrument = (typeof MUSIC_INSTRUMENTS)[number];
export const MUSIC_DRUMS = ["kick", "snare", "hat", "clap"] as const;
export type MusicDrum = (typeof MUSIC_DRUMS)[number];
export const MUSIC_BEATS = [0.25, 0.5, 1, 2] as const;
export type MusicBeats = (typeof MUSIC_BEATS)[number];

export interface PlayNoteStatement {
  readonly type: "playNote";
  /** MIDI note number, C3 (48) to C6 (84). */
  readonly note: number;
  readonly beats: MusicBeats;
}

export interface PlayDrumStatement {
  readonly type: "playDrum";
  readonly drum: MusicDrum;
  readonly beats: MusicBeats;
}

export interface SetInstrumentStatement {
  readonly type: "setInstrument";
  readonly instrument: MusicInstrument;
}

export interface SetTempoStatement {
  readonly type: "setTempo";
  readonly bpm: number;
}

export interface SetPitchStatement {
  readonly type: "setPitch";
  readonly semitones: number;
}

export interface SetPanStatement {
  readonly type: "setPan";
  readonly pan: number;
}

/** First-party extension packs a project may use; each needs its own ADR 0011 review. */
export const EXTENSION_IDS = ["pen", "music"] as const;
export type ExtensionId = (typeof EXTENSION_IDS)[number];

/** Starts this script's timer again from zero (Scratch: reset timer). */
export interface ResetTimerStatement {
  readonly type: "resetTimer";
}

/**
 * Ends this copy of the character (Scratch: delete this clone). Meaningful only in the script a
 * copy starts with ("when I start as a clone"); anywhere else it does nothing.
 */
export interface DeleteThisCloneStatement {
  readonly type: "deleteThisClone";
}

export interface ClearEffectsStatement {
  readonly type: "clearEffects";
}

export interface SayStatement {
  readonly type: "say";
  readonly text: string;
  /** Scratch's "say for N seconds": the bubble stays this many virtual seconds, then goes away. */
  readonly seconds?: number;
  /** Scratch's "join": a number (a variable, a position...) written right after the text. */
  readonly append?: Expression;
}

export interface ThinkStatement {
  readonly type: "think";
  readonly text: string;
  readonly seconds?: number;
  readonly append?: Expression;
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
export interface ChangeSizeStatement {
  readonly type: "changeSize";
  readonly delta: number;
}

export interface WaitStatement {
  readonly type: "wait";
  readonly seconds: number;
  readonly secondsFrom?: ProcedureParamId;
}

/** Waits for a canonical condition, with a fixed ten-second virtual timeout. */
export interface WaitUntilStatement {
  readonly type: "waitUntil";
  readonly condition: Expression;
}

export interface SwitchCostumeStatement {
  readonly type: "switchCostume";
  readonly costumeId: string;
}

/**
 * Scratch's "next costume": moves to the costume after the current one in this list, and wraps
 * around. The list is fixed when the block is made (the character's own costume first); a current
 * costume that is not in it goes to the first one.
 */
export interface NextCostumeStatement {
  readonly type: "nextCostume";
  readonly costumeIds: readonly string[];
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

/** Stops this activation, this actor's activations, or the entire scene run. */
export interface StopStatement {
  readonly type: "stop";
  readonly scope: "script" | "actor" | "scene";
}

/** Pauses for one bundled choice; the selected 1-based option index becomes a variable. */
export interface AskChoiceStatement {
  readonly type: "askChoice";
  readonly promptId: import("./choiceCatalog.js").ChoicePromptId;
  readonly variableId: string;
}

/** Pauses for a word the child types; it is kept in a text variable and never leaves the device. */
export interface AskTextStatement {
  readonly type: "askText";
  readonly promptId: import("./askTextCatalog.js").AskTextPromptId;
  readonly variableId: string;
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
  /**
   * Scratch's "broadcast and wait": in live play the sender waits until every script this message
   * started has finished. An instant (batch) run treats it as a plain broadcast.
   */
  readonly wait?: boolean;
}

export interface SetVariableStatement {
  readonly type: "setVariable";
  readonly variableId: string;
  readonly value: Expression;
}

/** Keeps a word in a text variable. Numbers stay in the number variables. */
export interface SetTextStatement {
  readonly type: "setText";
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

export interface ShowListStatement {
  readonly type: "showList";
  readonly listId: string;
}

export interface HideListStatement {
  readonly type: "hideList";
  readonly listId: string;
}

export interface ListAddStatement {
  readonly type: "listAdd";
  readonly listId: string;
  readonly value: Expression;
}

export interface ListClearStatement {
  readonly type: "listClear";
  readonly listId: string;
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
  readonly countFrom?: ProcedureParamId;
  readonly body: readonly Statement[];
}

/** Repeats until the deterministic execution budget ends the run. */
export interface ForeverStatement {
  readonly type: "forever";
  readonly body: readonly Statement[];
}

/** Checks the condition before every pass; the runtime stops after a fixed number of passes. */
export interface RepeatUntilStatement {
  readonly type: "repeatUntil";
  readonly condition: Expression;
  readonly body: readonly Statement[];
}

/** Runs the script's own custom block with that id; recursion is bounded at run time. */
export interface CallProcedureStatement {
  readonly type: "callProcedure";
  readonly procedureId: string;
  /**
   * The numbers for this use, one per number the block declares (absent when it declares none).
   * A fixed number, or (inside a custom block) one of that block's own numbers, so a block can
   * hand its number on to another block.
   */
  readonly args?: readonly (NumericLiteralExpression | ParamExpression)[];
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
  | GoToTargetStatement
  | CreateCopiesStatement
  | SetRotationStyleStatement
  | SetXStatement
  | SetYStatement
  | ChangeXStatement
  | ChangeYStatement
  | GlideToStatement
  | TurnStatement
  | PointInDirectionStatement
  | PointTowardsStatement
  | BounceOnEdgeStatement
  | GoToLayerStatement
  | SetEffectStatement
  | ChangeEffectStatement
  | ClearEffectsStatement
  | ResetTimerStatement
  | DeleteThisCloneStatement
  | PenDownStatement
  | PenUpStatement
  | SetPenColorStatement
  | SetPenSizeStatement
  | ClearPenStatement
  | PlayNoteStatement
  | PlayDrumStatement
  | SetInstrumentStatement
  | SetTempoStatement
  | SetPitchStatement
  | SetPanStatement
  | SayStatement
  | ThinkStatement
  | ShowStatement
  | HideStatement
  | SetSizeStatement
  | ChangeSizeStatement
  | WaitStatement
  | WaitUntilStatement
  | SwitchCostumeStatement
  | NextCostumeStatement
  | SwitchBackdropStatement
  | PlaySoundStatement
  | StopSoundsStatement
  | StopStatement
  | AskChoiceStatement
  | AskTextStatement
  | SetVolumeStatement
  | ChangeVolumeStatement
  | BroadcastStatement
  | StampStatement
  | SetPenTransparencyStatement
  | SetPenShadeStatement
  | SetVariableStatement
  | SetTextStatement
  | ChangeVariableStatement
  | ShowVariableStatement
  | HideVariableStatement
  | ShowListStatement
  | HideListStatement
  | ListAddStatement
  | ListClearStatement
  | ListRemoveAtStatement
  | ListInsertAtStatement
  | ListReplaceAtStatement
  | RepeatStatement
  | ForeverStatement
  | RepeatUntilStatement
  | CallProcedureStatement
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

/** Starts the script each time the backdrop is switched to this one (Scratch: when backdrop switches to). */
export interface OnBackdropSwitchTrigger {
  readonly type: "onBackdropSwitch";
  readonly backdropId: string;
}

/** Starts the script once, this many seconds after the run began (Scratch: when timer > N). */
export interface OnTimerOverTrigger {
  readonly type: "onTimerOver";
  readonly seconds: number;
}

/** Starts the script when the loudness (0 to 100) goes above this level (Scratch: when loudness > N). */
export interface OnLoudnessOverTrigger {
  readonly type: "onLoudnessOver";
  readonly level: number;
}

/** Starts the script of each copy of the character, the moment the copy exists (Scratch: when I start as a clone). */
export interface OnCloneStartTrigger {
  readonly type: "onCloneStart";
}

export type Trigger =
  | OnStartTrigger
  | GreenFlagTrigger
  | OnKeyPressedTrigger
  | OnActorClickedTrigger
  | OnMessageTrigger
  | OnBackdropSwitchTrigger
  | OnTimerOverTrigger
  | OnLoudnessOverTrigger
  | OnCloneStartTrigger;

export type ProgramEvent =
  | "greenFlag"
  | "actorClicked"
  | `key:${string}`
  | `message:${string}`
  | `backdrop:${string}`
  | `timer:${number}`
  | `loud:${number}`
  | "clone";

// --- Script / ProjectProgram ------------------------------------------------

export interface ProgramVariable {
  readonly id: string;
  readonly name: string;
  readonly initialValue: number;
  readonly visible: boolean;
}

/** A named place that holds a word or phrase; numbers use ProgramVariable. */
export interface ProgramTextVariable {
  readonly id: string;
  readonly name: string;
  readonly initialValue: string;
  readonly visible: boolean;
}

/**
 * A list with a visible watcher flag, declared like a variable. An item is a number or a word, as
 * in Scratch; the runtime has one rule for using one as the other (see `coerceNumber` and
 * `coerceText`). A word is at most TEXT_VALUE_MAX_LENGTH characters.
 */
export interface ProgramList {
  readonly id: string;
  readonly name: string;
  readonly initialItems: readonly (number | string)[];
  readonly visible: boolean;
}

/** A named group of blocks a character can reuse; it belongs to one script. */
export interface Procedure {
  readonly id: string;
  readonly name: string;
  /** Up to five numbers; titles are child text and never leave the program. */
  readonly params?: readonly ProcedureParam[];
  readonly body: readonly Statement[];
}

export interface ProcedureParam {
  readonly id: ProcedureParamId;
  readonly name: string;
}

export interface Script {
  /** Stable across editor round-trips when structure is unchanged (caller-supplied). */
  readonly id: string;
  readonly trigger: Trigger;
  readonly statements: readonly Statement[];
  /** Absent in every program written before custom blocks existed. */
  readonly procedures?: readonly Procedure[];
}

export interface ProjectProgram {
  readonly schema: SchemaVersion;
  readonly variables?: readonly ProgramVariable[];
  /** Optional: absent in every program written before lists existed. */
  readonly lists?: readonly ProgramList[];
  /** Optional: absent in every program written before text values existed. */
  readonly textVariables?: readonly ProgramTextVariable[];
  /** Extension packs the project uses (ADR 0011); absent when it uses none. */
  readonly extensions?: readonly ExtensionId[];
  /**
   * Custom blocks defined once for the whole program: any script may call them, and each call runs
   * on the character that makes it. A script's own block of the same purpose is separate. Absent
   * in every program written before shared blocks existed.
   */
  readonly sharedProcedures?: readonly Procedure[];
  readonly scripts: readonly Script[];
}
