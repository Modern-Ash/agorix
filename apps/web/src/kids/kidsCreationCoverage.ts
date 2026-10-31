import type {
  Expression,
  ExtensionId,
  GraphicEffect,
  Statement,
  Trigger,
} from "@agorix/program-model";
import type { StudioStatement } from "./kidsStudioModel.js";
import type { PaletteKind } from "./kidsStageAdaptation.js";

type EngineKind = Statement["type"];
type StudioKind = StudioStatement["type"];

/**
 * Engine statements the free scene deliberately does not offer, each with its reason (issue #1121).
 * Empty today: the scene offers every statement the engine defines.
 */
export const NOT_OFFERED_IN_SCENE = {} as const satisfies Partial<Record<EngineKind, string>>;

type Unlisted = Exclude<EngineKind, StudioKind | keyof typeof NOT_OFFERED_IN_SCENE>;

/**
 * Compile-time guard: a new engine statement fails `tsc` here until someone either adds it to the
 * scene (`StudioStatement`) or lists it in `NOT_OFFERED_IN_SCENE` with a reason.
 */
export const EVERY_ENGINE_STATEMENT_IS_DECIDED: [Unlisted] extends [never] ? true : Unlisted[] =
  true;

/** Mission blocks are a staged subset of the scene: each one must exist in the free scene. */
export const MISSION_PALETTE_STATEMENTS: Readonly<Record<PaletteKind, StudioKind>> = {
  move: "move",
  turnL: "turn",
  turnR: "turn",
  repeat: "repeat",
  sound: "playSound",
};

/** Why the free scene lacks something: a product gap to close, or a deliberate choice. */
export type CoverageNote = `gap: ${string}` | `by design: ${string}`;

type ExpressionKind = Expression["type"];
type TriggerKind = Trigger["type"];

/** Values a child can compute with: `checkedNumber` in `kidsStudioModel.ts` accepts these. */
export const SCENE_NUMBER_EXPRESSIONS = [
  "param",
  "numericLiteral",
  "xPosition",
  "yPosition",
  "timer",
  "distanceToActor",
  "variable",
  "listLength",
  "listItem",
  "randomInteger",
  "mathFunction",
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
] as const satisfies readonly ExpressionKind[];

/** Conditions of `if` and `repeatUntil`: `checkedCondition` in `kidsStudioModel.ts` accepts these. */
export const SCENE_CONDITION_EXPRESSIONS = [
  "keyDown",
  "touchingStageEdge",
  "touchingActor",
  "greaterThan",
  "lessThan",
  "equals",
] as const satisfies readonly ExpressionKind[];

export const EXPRESSIONS_NOT_IN_SCENE = {
  touchingGoal: "by design: it reads a mission goal cell, which a free scene does not have",
  booleanLiteral: "by design: a constant true or false teaches nothing a child can try",
  lessOrEqual: "gap: the scene offers < > = but not <= or >=",
  greaterOrEqual: "gap: the scene offers < > = but not <= or >=",
  and: "gap: no way to combine two conditions",
  or: "gap: no way to combine two conditions",
  not: "gap: no way to negate a condition",
  random: "gap: the scene offers whole-number random only (randomInteger)",
} as const satisfies Partial<Record<ExpressionKind, CoverageNote>>;

type UndecidedExpression = Exclude<
  ExpressionKind,
  | (typeof SCENE_NUMBER_EXPRESSIONS)[number]
  | (typeof SCENE_CONDITION_EXPRESSIONS)[number]
  | keyof typeof EXPRESSIONS_NOT_IN_SCENE
>;
export const EVERY_ENGINE_EXPRESSION_IS_DECIDED: [UndecidedExpression] extends [never]
  ? true
  : UndecidedExpression[] = true;

/** Events a scene character can start on: `checkedTrigger` in `kidsStudioModel.ts`. */
export const SCENE_TRIGGERS = [
  "greenFlag",
  "onActorClicked",
  "onKeyPressed",
  "onMessage",
] as const satisfies readonly TriggerKind[];

export const TRIGGERS_NOT_IN_SCENE = {
  onStart: "by design: it starts a mission run; a scene starts with the green flag",
} as const satisfies Partial<Record<TriggerKind, CoverageNote>>;

type UndecidedTrigger = Exclude<
  TriggerKind,
  (typeof SCENE_TRIGGERS)[number] | keyof typeof TRIGGERS_NOT_IN_SCENE
>;
export const EVERY_ENGINE_TRIGGER_IS_DECIDED: [UndecidedTrigger] extends [never]
  ? true
  : UndecidedTrigger[] = true;

/** Every graphic effect and every first-party extension pack is reachable in the scene. */
export const SCENE_EFFECTS = [
  "color",
  "ghost",
  "brightness",
] as const satisfies readonly GraphicEffect[];
type UndecidedEffect = Exclude<GraphicEffect, (typeof SCENE_EFFECTS)[number]>;
export const EVERY_ENGINE_EFFECT_IS_DECIDED: [UndecidedEffect] extends [never]
  ? true
  : UndecidedEffect[] = true;

/** `pen` and `music` show as palette categories while a grown-up keeps the pack on. */
export const SCENE_EXTENSIONS = ["pen", "music"] as const satisfies readonly ExtensionId[];
type UndecidedExtension = Exclude<ExtensionId, (typeof SCENE_EXTENSIONS)[number]>;
export const EVERY_ENGINE_EXTENSION_IS_DECIDED: [UndecidedExtension] extends [never]
  ? true
  : UndecidedExtension[] = true;
