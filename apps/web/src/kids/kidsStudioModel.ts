import {
  inStudioRange,
  STUDIO_BUBBLE_MAX_LENGTH,
  STUDIO_SHIFT_AMOUNTS,
  STUDIO_VOLUME_DELTA_RANGE,
  STUDIO_VOLUME_RANGE,
  STUDIO_X_RANGE,
  STUDIO_Y_RANGE,
  STUDIO_EFFECT_DELTAS,
  isStudioKey,
  STUDIO_POINT_DIRECTIONS,
  STUDIO_REPEAT_COUNTS,
  STUDIO_SIZE_DELTAS,
  STUDIO_SIZES,
  STUDIO_TURN_AMOUNTS,
  STUDIO_WAIT_SECONDS,
  studioEffectValues,
} from "./kidsStudioChoices.js";
import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  MUSIC_BEATS,
  MUSIC_DRUMS,
  MUSIC_INSTRUMENTS,
  PEN_COLORS,
  PEN_SHADES,
  PEN_TRANSPARENCIES,
  PROCEDURE_NUMBER_CHOICES,
  PROCEDURE_NUMBER_DEFAULTS,
  procedureNumberUnits,
  SCHEMA_VERSION,
  STAGE_ACTOR_ID,
  validateProgram,
  validateProjectCreativeState,
  type ProcedureNumberUnit,
  type ProjectCreativeState,
  type ProjectAsset,
  type ProjectProgram,
  type Procedure,
  type ProcedureParam,
  type ProcedureParamId,
  type Expression,
  type Script,
  type Statement,
  type Trigger,
  MAX_EMBEDDED_SOUNDS,
  validEmbeddedSoundSource,
} from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import {
  KIDS_GALLERY_BACKDROPS,
  KIDS_GALLERY_CHARACTERS,
  galleryCharacterName,
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "./kidsGallery.js";
import { BACKDROP_COLOR_ZONES } from "./kidsBackdropZones.js";
import { KIDS_SOUNDS, isKidsSoundId } from "./kidsSoundLibrary.js";
import { validKidsImageDataUrl } from "./kidsImages.js";

const SCRIPT = /^studio-actor-([1-9][0-9]?)-([a-z]+)$/;
/** The second script of a character: the one each of its copies starts with (issue #1311). */
const CLONE_SCRIPT = /^studio-actor-([1-9][0-9]?)-([a-z]+)-clone$/;
/**
 * A character's extra scripts (issue #1363): up to two after its own, each started by a different
 * event, so it can answer more than one thing (a key for each arrow, the flag and a key).
 */
const EXTRA_SCRIPT = /^studio-actor-([1-9][0-9]?)-([a-z]+)-s([23])$/;
export const MAX_STUDIO_EXTRA_SCRIPTS = 2;
export const MAX_STUDIO_ACTORS = 12;

export type StudioStatement = Extract<
  Statement,
  {
    type:
      | "move"
      | "goTo"
      | "goToTarget"
      | "createCopies"
      | "setRotationStyle"
      | "setX"
      | "setY"
      | "changeX"
      | "changeY"
      | "glideTo"
      | "turn"
      | "pointInDirection"
      | "pointTowards"
      | "bounceOnEdge"
      | "goToLayer"
      | "setEffect"
      | "changeEffect"
      | "clearEffects"
      | "resetTimer"
      | "deleteThisClone"
      | "switchCostume"
      | "nextCostume"
      | "switchBackdrop"
      | "playSound"
      | "stopSounds"
      | "stop"
      | "askChoice"
      | "askText"
      | "setVolume"
      | "changeVolume"
      | "say"
      | "think"
      | "show"
      | "hide"
      | "setSize"
      | "changeSize"
      | "wait"
      | "broadcast"
      | "setVariable"
      | "setText"
      | "changeVariable"
      | "showVariable"
      | "hideVariable"
      | "showList"
      | "hideList"
      | "listAdd"
      | "listRemoveAt"
      | "listClear"
      | "listInsertAt"
      | "listReplaceAt"
      | "repeat"
      | "repeatUntil"
      | "forever"
      | "waitUntil"
      | "callProcedure"
      | "penDown"
      | "penUp"
      | "setPenColor"
      | "setPenSize"
      | "setPenTransparency"
      | "setPenShade"
      | "clearPen"
      | "stamp"
      | "playNote"
      | "playDrum"
      | "setInstrument"
      | "setTempo"
      | "setPitch"
      | "setPan"
      | "if";
  }
>;

const STUDIO_MESSAGES = ["hola", "vamos", "listo"] as const;
export const STUDIO_EDGE_CONDITION = {
  type: "touchingStageEdge",
  minX: 0,
  maxX: 320,
  minY: -100,
  maxY: 120,
} as const;
const DATA_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;
export const MAX_STUDIO_BLOCKS = 60;
/** White keys from C3 to C6: the notes the Studio offers (the model accepts every semitone). */
export const STUDIO_NOTES = Array.from({ length: 37 }, (_value, index) => 48 + index).filter(
  (note) => [0, 2, 4, 5, 7, 9, 11].includes(note % 12),
);
export const STUDIO_TEMPOS = [60, 90, 120, 150, 180] as const;
export const STUDIO_PITCHES = [-12, -5, 0, 5, 12] as const;
export const STUDIO_PANS = [-100, -50, 0, 50, 100] as const;

/** Pen widths a child can pick; the model accepts 1 to 24, the Studio offers four. */
export const STUDIO_PEN_SIZES: readonly number[] = [4, 8, 12, 20];
const MAX_STUDIO_CONTROL_DEPTH = 2;
const MAX_STUDIO_BODY = 3;
const STUDIO_ART_ID = /^(costume|backdrop):studio-art-([1-9][0-9]?)$/;

export interface StudioArt {
  readonly assets?: readonly ProjectAsset[] | undefined;
  readonly actorCostumes?: Readonly<Record<string, string>>;
  readonly stageBackdropId?: string | undefined;
}

/** A recording the child kept in this project: `sound:recorded-1` to `sound:recorded-9`. */
export const STUDIO_RECORDED_SOUND_ID = /^sound:recorded-[1-9]$/;

export function isStudioRecordedSoundId(id: string): boolean {
  return STUDIO_RECORDED_SOUND_ID.test(id);
}

/**
 * The child's own assets: pictures (at most 12) and recordings (at most 8). A recording is a
 * bounded WAV and nothing else; a picture is a bounded PNG or WebP.
 */
export function studioArtAssets(assets: readonly ProjectAsset[] = []): readonly ProjectAsset[] {
  const sounds = assets.filter((asset) => asset.kind === "sound");
  const pictures = assets.length - sounds.length;
  if (
    pictures > 12 ||
    sounds.length > MAX_EMBEDDED_SOUNDS ||
    assets.some((asset) => {
      if (asset.kind === "sound")
        return !isStudioRecordedSoundId(asset.id) || !validEmbeddedSoundSource(asset.source);
      const match = STUDIO_ART_ID.exec(asset.id);
      return !match || match[1] !== asset.kind || !validKidsImageDataUrl(asset.source);
    }) ||
    new Set(assets.map((asset) => asset.id)).size !== assets.length
  )
    throw new RangeError("invalid studio art");
  return assets;
}

function finiteSmallNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -100 && value <= 100;
}

function checkedStudioIndex(value: Expression, program: ProjectProgram): boolean {
  if (value.type === "listLength")
    return program.lists?.some((item) => item.id === value.listId) === true;
  if (value.type === "listIndexOf")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      ["numericLiteral", "textLiteral", "variable", "textVariable"].includes(value.value.type) &&
      checkedListItem(value.value, program, 0)
    );
  if (value.type === "variable")
    return program.variables?.some((item) => item.id === value.variableId) === true;
  return (
    value.type === "numericLiteral" &&
    Number.isInteger(value.value) &&
    value.value >= 1 &&
    value.value <= 10
  );
}

function checkedTrigger(trigger: Trigger): boolean {
  return (
    trigger.type === "greenFlag" ||
    trigger.type === "onActorClicked" ||
    (trigger.type === "onKeyPressed" && isStudioKey(trigger.key)) ||
    (trigger.type === "onMessage" &&
      STUDIO_MESSAGES.includes(trigger.message as (typeof STUDIO_MESSAGES)[number])) ||
    (trigger.type === "onTimerOver" && [1, 2, 3, 5, 10].includes(trigger.seconds)) ||
    (trigger.type === "onLoudnessOver" && [10, 30, 50, 70].includes(trigger.level)) ||
    (trigger.type === "onBackdropSwitch" &&
      trigger.backdropId.startsWith("backdrop:") &&
      isGalleryBackdropId(trigger.backdropId.slice(9)))
  );
}

const PARAM_IDS: readonly ProcedureParamId[] = ["p1", "p2", "p3", "p4", "p5"];

/** A bound field or `param` expression may only name one of the enclosing custom block's numbers. */
function paramInScope(id: ProcedureParamId | undefined, arity: number): boolean {
  return id === undefined || PARAM_IDS.indexOf(id) < arity;
}

/** A child-typed decimal: tenths only and small, so every control can show and edit it. */
function checkedDecimal(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(Math.round(value * 10)) &&
    Math.abs(value) <= 100 &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
  );
}

/** A word in the scene: short, so a bubble or a watcher can show it. */
export const STUDIO_WORD_MAX_LENGTH = 20;

function checkedText(value: Expression, program: ProjectProgram, depth = 0): boolean {
  if (depth > 2) return false;
  if (value.type === "actorProperty")
    return (
      (value.actorId === STAGE_ACTOR_ID &&
        (value.property === "backdropName" ||
          (value.property === "variable" &&
            program.textVariables?.some(
              (item) => item.id === value.variableId && item.scope === "stage",
            ) === true))) ||
      ((value.property === "costumeName" ||
        (value.property === "variable" &&
          program.textVariables?.some(
            (item) => item.id === value.variableId && item.scope !== "stage",
          ) === true)) &&
        program.scripts.some((script) => {
          const actor = actorOfScript(script.id);
          return actor !== null && studioActorId(actor.index, actor.characterId) === value.actorId;
        }))
    );
  if (value.type === "textLiteral")
    return value.value.length <= STUDIO_WORD_MAX_LENGTH && !/\p{Cc}/u.test(value.value);
  if (value.type === "textVariable")
    return program.textVariables?.some((item) => item.id === value.variableId) === true;
  if (value.type === "join")
    return (
      (checkedText(value.left, program, depth + 1) ||
        checkedNumber(value.left, program, depth + 1)) &&
      (checkedText(value.right, program, depth + 1) ||
        checkedNumber(value.right, program, depth + 1))
    );
  // An item of a list may be a word (a list holds numbers or words): read as a word it is one.
  if (value.type === "listItem")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      checkedStudioIndex(value.index, program)
    );
  if (value.type === "letterOf")
    return (
      value.index.type === "numericLiteral" &&
      Number.isInteger(value.index.value) &&
      value.index.value >= 1 &&
      value.index.value <= STUDIO_WORD_MAX_LENGTH &&
      (checkedText(value.value, program, depth + 1) ||
        checkedNumber(value.value, program, depth + 1))
    );
  return false;
}

/** What a list may take: a number, or a word (a short one typed in, a word variable, an item). */
function checkedListItem(value: Expression, program: ProjectProgram, arity: number): boolean {
  return checkedNumber(value, program, 0, arity) || checkedText(value, program);
}

function checkedNumber(value: Expression, program: ProjectProgram, depth = 0, arity = 0): boolean {
  if (depth > 2) return false;
  if (value.type === "actorProperty")
    return (
      (value.actorId === STAGE_ACTOR_ID &&
        (value.property === "backdropNumber" ||
          value.property === "volume" ||
          (value.property === "variable" &&
            program.variables?.some(
              (item) => item.id === value.variableId && item.scope === "stage",
            ) === true))) ||
      ((["xPosition", "yPosition", "direction", "size", "costumeNumber", "volume"].includes(
        value.property,
      ) ||
        (value.property === "variable" &&
          program.variables?.some(
            (item) => item.id === value.variableId && item.scope !== "stage",
          ) === true)) &&
        program.scripts.some((script) => {
          const actor = actorOfScript(script.id);
          return actor !== null && studioActorId(actor.index, actor.characterId) === value.actorId;
        }))
    );
  if (value.type === "param") return arity > 0 && paramInScope(value.paramId, arity);
  if (value.type === "numericLiteral") return finiteSmallNumber(value.value);
  if (
    value.type === "xPosition" ||
    value.type === "yPosition" ||
    value.type === "direction" ||
    value.type === "sizePercent" ||
    value.type === "loudness" ||
    value.type === "costumeNumber" ||
    value.type === "backdropNumber" ||
    value.type === "currentTime" ||
    value.type === "timer" ||
    value.type === "distanceToMouse" ||
    value.type === "mouseX" ||
    value.type === "mouseY"
  )
    return true;
  if (value.type === "distanceToActor")
    return program.scripts.some((script) => {
      const target = actorOfScript(script.id);
      return target !== null && studioActorId(target.index, target.characterId) === value.actorId;
    });
  if (value.type === "textLength")
    return (
      checkedText(value.value, program, depth + 1) || checkedNumber(value.value, program, depth + 1)
    );
  if (value.type === "variable")
    return program.variables?.some((item) => item.id === value.variableId) === true;
  if (value.type === "listLength")
    return program.lists?.some((item) => item.id === value.listId) === true;
  if (value.type === "listIndexOf")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      checkedListItem(value.value, program, arity)
    );
  if (value.type === "listItem")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      checkedStudioIndex(value.index, program)
    );
  if (value.type === "randomInteger")
    return (
      value.min.type === "numericLiteral" &&
      value.max.type === "numericLiteral" &&
      finiteSmallNumber(value.min.value) &&
      finiteSmallNumber(value.max.value) &&
      value.min.value <= value.max.value
    );
  if (value.type === "random")
    return (
      value.min.type === "numericLiteral" &&
      value.max.type === "numericLiteral" &&
      checkedDecimal(value.min.value) &&
      checkedDecimal(value.max.value) &&
      value.min.value <= value.max.value
    );
  if (value.type === "mathFunction") return checkedNumber(value.value, program, depth + 1, arity);
  if (["add", "subtract", "multiply", "divide", "modulo"].includes(value.type)) {
    const binary = value as Extract<
      Expression,
      { type: "add" | "subtract" | "multiply" | "divide" | "modulo" }
    >;
    return (
      checkedNumber(binary.left, program, depth + 1, arity) &&
      checkedNumber(binary.right, program, depth + 1, arity) &&
      (!(binary.type === "divide" || binary.type === "modulo") ||
        (binary.right.type === "numericLiteral" && binary.right.value !== 0))
    );
  }
  return false;
}

const MAX_STUDIO_CONDITION_DEPTH = 2;

function checkedCondition(
  value: Expression,
  program: ProjectProgram,
  arity = 0,
  depth = 0,
): boolean {
  if (value.type === "keyDown") return isStudioKey(value.key);
  if (value.type === "mouseDown" || value.type === "touchingMouse") return true;
  if (value.type === "touchingColor")
    return (PEN_COLORS as readonly string[]).includes(value.color);
  if (value.type === "listContains")
    return (
      program.lists?.some((item) => item.id === value.listId) === true &&
      checkedListItem(value.value, program, arity)
    );
  if (value.type === "textContains")
    return (
      (checkedText(value.text, program) || checkedNumber(value.text, program)) &&
      (checkedText(value.part, program) || checkedNumber(value.part, program))
    );
  if (value.type === "touchingStageEdge")
    return (
      value.minX === STUDIO_EDGE_CONDITION.minX &&
      value.maxX === STUDIO_EDGE_CONDITION.maxX &&
      value.minY === STUDIO_EDGE_CONDITION.minY &&
      value.maxY === STUDIO_EDGE_CONDITION.maxY
    );
  if (value.type === "touchingActor")
    return program.scripts.some((script) => {
      const target = actorOfScript(script.id);
      return target !== null && studioActorId(target.index, target.characterId) === value.actorId;
    });
  // "and", "or" and "not" join the conditions above; the depth keeps a child's sentence short.
  if (value.type === "and" || value.type === "or")
    return (
      depth < MAX_STUDIO_CONDITION_DEPTH &&
      checkedCondition(value.left, program, arity, depth + 1) &&
      checkedCondition(value.right, program, arity, depth + 1)
    );
  if (value.type === "not")
    return (
      depth < MAX_STUDIO_CONDITION_DEPTH && checkedCondition(value.value, program, arity, depth + 1)
    );
  if (
    value.type !== "greaterThan" &&
    value.type !== "lessThan" &&
    value.type !== "equals" &&
    value.type !== "lessOrEqual" &&
    value.type !== "greaterOrEqual"
  )
    return false;
  if (value.type === "equals" || value.type === "lessThan" || value.type === "greaterThan")
    return (
      (checkedText(value.left, program) || checkedNumber(value.left, program, 0, arity)) &&
      (checkedText(value.right, program) || checkedNumber(value.right, program, 0, arity))
    );
  return (
    checkedNumber(value.left, program, 0, arity) && checkedNumber(value.right, program, 0, arity)
  );
}

const MAX_STUDIO_PROCEDURES = 20;

function checkedParams(params: readonly ProcedureParam[] | undefined): boolean {
  return (
    params === undefined ||
    (params.length >= 1 &&
      params.length <= PARAM_IDS.length &&
      params.every((item, index) => item.id === PARAM_IDS[index] && DATA_NAME.test(item.name)))
  );
}

/** A call's fixed numbers: small, finite, and in half steps, so every unit picker can offer them. */
function checkedArgs(args: readonly Expression[] | undefined, arity: number): boolean {
  return (
    args === undefined ||
    (args.length <= PARAM_IDS.length &&
      args.every((item) =>
        item.type === "param"
          ? arity > 0 && paramInScope(item.paramId, arity)
          : item.type === "numericLiteral" &&
            Number.isInteger(item.value * 2) &&
            Math.abs(item.value) <= 200,
      ))
  );
}

function checkedProcedures(
  procedures: readonly Procedure[] | undefined,
  actorIndex: number,
  program: ProjectProgram,
): boolean {
  if (procedures === undefined) return true;
  return (
    procedures.length >= 1 &&
    procedures.length <= MAX_STUDIO_PROCEDURES &&
    procedures.every(
      (item) =>
        item.id.startsWith(`proc-${actorIndex}-`) &&
        /^proc-[1-9][0-9]?-[1-9][0-9]?$/.test(item.id) &&
        DATA_NAME.test(item.name) &&
        checkedParams(item.params) &&
        item.body.length >= 1 &&
        item.body.every((statement) => checked(statement, program, 0, item.params?.length ?? 0)),
    )
  );
}

/** A block made for every character: `shared-1` to `shared-9`, at most five at once. */
const STUDIO_SHARED_ID = /^shared-[1-9]$/;
export const MAX_STUDIO_SHARED = 5;

function checkedShared(shared: readonly Procedure[] | undefined, program: ProjectProgram): boolean {
  if (shared === undefined) return true;
  return (
    shared.length >= 1 &&
    shared.length <= MAX_STUDIO_SHARED &&
    new Set(shared.map((item) => item.id)).size === shared.length &&
    shared.every(
      (item) =>
        STUDIO_SHARED_ID.test(item.id) &&
        DATA_NAME.test(item.name) &&
        checkedParams(item.params) &&
        item.body.length >= 1 &&
        statementCount(item.body) <= MAX_STUDIO_BLOCKS &&
        item.body.every((statement) => checked(statement, program, 0, item.params?.length ?? 0)),
    )
  );
}

function statementCount(statements: readonly Statement[]): number {
  return statements.reduce(
    (sum, statement) =>
      sum +
      1 +
      (statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
        ? statementCount(statement.body)
        : statement.type === "if"
          ? statementCount(statement.then) + statementCount(statement.else ?? [])
          : 0),
    0,
  );
}

/** How many blocks a character's script and custom blocks hold, against the most the Studio allows. */
export function studioBlocksUsed(program: ProjectProgram, actorId: string): number {
  const script = program.scripts.find((item) => {
    const actor = actorOfScript(item.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  const extras = program.scripts
    .filter((item) => {
      const extra = extraActorOfScript(item.id);
      return extra !== null && studioActorId(extra.index, extra.characterId) === actorId;
    })
    .reduce((sum, item) => sum + statementCount(item.statements), 0);
  return script === undefined
    ? 0
    : statementCount(script.statements) +
        (script.procedures ?? []).reduce((sum, item) => sum + statementCount(item.body), 0) +
        extras;
}

export function studioActorId(index: number, characterId: KidsGalleryCharacterId): string {
  return `actor:studio-${index}-${characterId}`;
}

function scriptId(index: number, characterId: KidsGalleryCharacterId): string {
  return `studio-actor-${index}-${characterId}`;
}

export function cloneScriptId(index: number, characterId: KidsGalleryCharacterId): string {
  return `studio-actor-${index}-${characterId}-clone`;
}

export function extraScriptId(
  index: number,
  characterId: KidsGalleryCharacterId,
  slot: 2 | 3,
): string {
  return `studio-actor-${index}-${characterId}-s${slot}`;
}

/** The character and slot (2 or 3) an extra script belongs to; null for any other script id. */
export function extraActorOfScript(
  id: string,
): { index: number; characterId: KidsGalleryCharacterId; slot: 2 | 3 } | null {
  const match = EXTRA_SCRIPT.exec(id);
  if (!match || !isGalleryCharacterId(match[2])) return null;
  const index = Number(match[1]);
  if (index > 99) return null;
  return { index, characterId: match[2], slot: Number(match[3]) as 2 | 3 };
}

/** The character a copy script belongs to; null for any other script id. */
export function cloneActorOfScript(
  id: string,
): { index: number; characterId: KidsGalleryCharacterId } | null {
  const match = CLONE_SCRIPT.exec(id);
  if (!match || !isGalleryCharacterId(match[2])) return null;
  const index = Number(match[1]);
  if (index > 99) return null;
  return { index, characterId: match[2] };
}

export function actorOfScript(
  id: string,
): { index: number; characterId: KidsGalleryCharacterId } | null {
  const match = SCRIPT.exec(id);
  if (!match || !isGalleryCharacterId(match[2])) return null;
  const index = Number(match[1]);
  if (index > 99) return null;
  return { index, characterId: match[2] };
}

function checked(
  statement: Statement,
  program: ProjectProgram,
  depth = 0,
  arity = 0,
  inClone = false,
): boolean {
  if (statement.type === "deleteThisClone") return inClone;
  if (statement.type === "move")
    return (
      paramInScope(statement.stepsFrom, arity) &&
      Number.isInteger(statement.steps / 20) &&
      statement.steps !== 0 &&
      Math.abs(statement.steps) <= 200
    );
  if (statement.type === "glideTo")
    return (
      (STUDIO_WAIT_SECONDS as readonly number[]).includes(statement.seconds) &&
      checked({ type: "goTo", x: statement.x, y: statement.y }, program)
    );
  if (statement.type === "goTo")
    return inStudioRange(statement.x, STUDIO_X_RANGE) && inStudioRange(statement.y, STUDIO_Y_RANGE);
  if (statement.type === "setRotationStyle")
    return (
      statement.style === "all" || statement.style === "leftRight" || statement.style === "none"
    );
  if (statement.type === "createCopies")
    return (
      // Copies with a script of their own need a character that has a copy script (#1311).
      (statement.withScript !== true ||
        program.scripts.some((script) => cloneActorOfScript(script.id) !== null)) &&
      [2, 3, 5].includes(statement.count) &&
      (statement.rule === "spread" || statement.rule === "fall" || statement.rule === "follow")
    );
  if (statement.type === "goToTarget") {
    if (
      statement.seconds !== undefined &&
      !(STUDIO_WAIT_SECONDS as readonly number[]).includes(statement.seconds)
    )
      return false;
    if (statement.target === "actor")
      return program.scripts.some((script) => {
        const actor = actorOfScript(script.id);
        return (
          actor !== null && studioActorId(actor.index, actor.characterId) === statement.actorId
        );
      });
    return statement.actorId === undefined;
  }
  if (statement.type === "setX") return inStudioRange(statement.x, STUDIO_X_RANGE);
  if (statement.type === "setY") return inStudioRange(statement.y, STUDIO_Y_RANGE);
  if (statement.type === "changeX")
    return (STUDIO_SHIFT_AMOUNTS as readonly number[]).includes(statement.dx);
  if (statement.type === "changeY")
    return (STUDIO_SHIFT_AMOUNTS as readonly number[]).includes(statement.dy);
  if (statement.type === "turn")
    return (
      paramInScope(statement.degreesFrom, arity) &&
      STUDIO_TURN_AMOUNTS.flatMap((amount) => [amount, -amount]).includes(statement.degrees)
    );
  if (statement.type === "pointInDirection")
    return (STUDIO_POINT_DIRECTIONS as readonly number[]).includes(statement.degrees);
  if (statement.type === "pointTowards")
    return program.scripts.some((script) => {
      const actor = actorOfScript(script.id);
      return actor !== null && studioActorId(actor.index, actor.characterId) === statement.actorId;
    });
  if (statement.type === "bounceOnEdge") return true;
  if (statement.type === "setEffect")
    return (
      statement.effect === "color" ||
      statement.effect === "ghost" ||
      statement.effect === "brightness"
        ? studioEffectValues(statement.effect)
        : []
    ).includes(statement.value);
  if (statement.type === "changeEffect")
    return (
      ["color", "ghost", "brightness"].includes(statement.effect) &&
      (STUDIO_EFFECT_DELTAS as readonly number[]).includes(statement.delta)
    );
  if (statement.type === "clearEffects" || statement.type === "resetTimer") return true;
  if (
    statement.type === "penDown" ||
    statement.type === "penUp" ||
    statement.type === "clearPen" ||
    statement.type === "stamp"
  )
    return true;
  if (statement.type === "setPenColor")
    return (PEN_COLORS as readonly string[]).includes(statement.color);
  if (statement.type === "setPenSize") return STUDIO_PEN_SIZES.includes(statement.size);
  if (statement.type === "setPenShade")
    return (PEN_SHADES as readonly string[]).includes(statement.shade);
  if (statement.type === "setPenTransparency")
    return (PEN_TRANSPARENCIES as readonly number[]).includes(statement.percent);
  if (statement.type === "playNote")
    return STUDIO_NOTES.includes(statement.note) && MUSIC_BEATS.includes(statement.beats);
  if (statement.type === "playDrum")
    return MUSIC_DRUMS.includes(statement.drum) && MUSIC_BEATS.includes(statement.beats);
  if (statement.type === "setInstrument") return MUSIC_INSTRUMENTS.includes(statement.instrument);
  if (statement.type === "setTempo")
    return (STUDIO_TEMPOS as readonly number[]).includes(statement.bpm);
  if (statement.type === "setPitch")
    return (STUDIO_PITCHES as readonly number[]).includes(statement.semitones);
  if (statement.type === "setPan")
    return (STUDIO_PANS as readonly number[]).includes(statement.pan);
  if (statement.type === "goToLayer")
    return statement.layer === "front" || statement.layer === "back"
      ? statement.steps === undefined
      : Number.isInteger(statement.steps) && statement.steps! >= 1 && statement.steps! <= 3;
  if (statement.type === "nextCostume")
    return (
      statement.costumeIds.length >= 2 &&
      new Set(statement.costumeIds).size === statement.costumeIds.length &&
      statement.costumeIds.every(
        (id) =>
          (id.startsWith("costume:") && isGalleryCharacterId(id.slice(8))) ||
          (id.startsWith("costume:") && STUDIO_ART_ID.test(id)),
      )
    );
  if (statement.type === "switchCostume")
    return (
      isGalleryCharacterId(statement.costumeId.slice(8)) &&
      statement.costumeId.startsWith("costume:")
    );
  if (statement.type === "switchBackdrop")
    return (
      isGalleryBackdropId(statement.backdropId.slice(9)) &&
      statement.backdropId.startsWith("backdrop:")
    );
  if (statement.type === "playSound")
    return (
      (isKidsSoundId(statement.soundId) && statement.soundId !== "kids:custom") ||
      isStudioRecordedSoundId(statement.soundId)
    );
  if (statement.type === "stopSounds") return true;
  if (statement.type === "stop") return ["script", "actor", "scene"].includes(statement.scope);
  if (statement.type === "askText")
    return program.textVariables?.some((item) => item.id === statement.variableId) === true;
  if (statement.type === "askChoice")
    return program.variables?.some((item) => item.id === statement.variableId) === true;
  if (statement.type === "setVolume") return inStudioRange(statement.volume, STUDIO_VOLUME_RANGE);
  if (statement.type === "changeVolume")
    return inStudioRange(statement.delta, STUDIO_VOLUME_DELTA_RANGE);
  if (statement.type === "say" || statement.type === "think")
    return (
      (statement.text.trim().length > 0 || statement.append !== undefined) &&
      statement.text.length <= STUDIO_BUBBLE_MAX_LENGTH &&
      (statement.seconds === undefined ||
        (STUDIO_WAIT_SECONDS as readonly number[]).includes(statement.seconds)) &&
      (statement.append === undefined ||
        checkedNumber(statement.append, program) ||
        checkedText(statement.append, program))
    );
  if (statement.type === "show" || statement.type === "hide") return true;
  if (statement.type === "changeSize")
    return (STUDIO_SIZE_DELTAS as readonly number[]).includes(statement.delta);
  if (statement.type === "setSize")
    return (STUDIO_SIZES as readonly number[]).includes(statement.size);
  if (statement.type === "wait")
    return (
      paramInScope(statement.secondsFrom, arity) &&
      (STUDIO_WAIT_SECONDS as readonly number[]).includes(statement.seconds)
    );
  if (statement.type === "broadcast")
    return STUDIO_MESSAGES.includes(statement.message as (typeof STUDIO_MESSAGES)[number]);
  if (statement.type === "setVariable" || statement.type === "changeVariable")
    return (
      program.variables?.some((item) => item.id === statement.variableId) === true &&
      checkedNumber(
        statement.type === "setVariable" ? statement.value : statement.delta,
        program,
        0,
        arity,
      )
    );
  if (statement.type === "setText")
    return (
      program.textVariables?.some((item) => item.id === statement.variableId) === true &&
      checkedText(statement.value, program)
    );
  if (statement.type === "showVariable" || statement.type === "hideVariable")
    return program.variables?.some((item) => item.id === statement.variableId) === true;
  if (statement.type === "showList" || statement.type === "hideList")
    return program.lists?.some((item) => item.id === statement.listId) === true;
  if (statement.type === "listAdd")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedListItem(statement.value, program, arity)
    );
  if (statement.type === "listClear")
    return program.lists?.some((item) => item.id === statement.listId) === true;
  if (statement.type === "listRemoveAt")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedStudioIndex(statement.index, program)
    );
  if (statement.type === "listInsertAt" || statement.type === "listReplaceAt")
    return (
      program.lists?.some((item) => item.id === statement.listId) === true &&
      checkedStudioIndex(statement.index, program) &&
      checkedListItem(statement.value, program, arity)
    );
  if (statement.type === "repeat")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      paramInScope(statement.countFrom, arity) &&
      (STUDIO_REPEAT_COUNTS as readonly number[]).includes(statement.count) &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1, arity, inClone))
    );
  if (statement.type === "callProcedure")
    return (
      (/^proc-[1-9][0-9]?-[1-9][0-9]?$/.test(statement.procedureId) ||
        STUDIO_SHARED_ID.test(statement.procedureId)) &&
      checkedArgs(statement.args, arity)
    );
  if (statement.type === "repeatUntil")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      checkedCondition(statement.condition, program, arity) &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1, arity, inClone))
    );
  if (statement.type === "forever")
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      statement.body.length >= 1 &&
      statement.body.length <= MAX_STUDIO_BODY &&
      statement.body.every((item) => checked(item, program, depth + 1, arity, inClone))
    );
  if (statement.type === "waitUntil") return checkedCondition(statement.condition, program, arity);
  if (statement.type === "if") {
    return (
      depth < MAX_STUDIO_CONTROL_DEPTH &&
      checkedCondition(statement.condition, program, arity) &&
      statement.then.length >= 1 &&
      statement.then.length <= MAX_STUDIO_BODY &&
      statement.then.every((item) => checked(item, program, depth + 1, arity, inClone)) &&
      (statement.else === undefined ||
        (statement.else.length >= 1 &&
          statement.else.length <= MAX_STUDIO_BODY &&
          statement.else.every((item) => checked(item, program, depth + 1, arity, inClone))))
    );
  }
  return false;
}

export function validateStudioProgram(raw: ProjectProgram): ProjectProgram {
  const program = validateProgram(raw);
  if (
    !checkedShared(program.sharedProcedures, program) ||
    (program.extensions !== undefined &&
      !program.extensions.every((id) => id === "pen" || id === "music")) ||
    mainScripts(program).length < 1 ||
    mainScripts(program).length > MAX_STUDIO_ACTORS ||
    (program.variables?.length ?? 0) > 3 ||
    (program.lists?.length ?? 0) > 3 ||
    (program.textVariables?.length ?? 0) > 3 ||
    program.textVariables?.some(
      (item, index) =>
        item.id !== `studio-text-${index + 1}` ||
        !DATA_NAME.test(item.name) ||
        (item.scope === "stage"
          ? item.initialValue.length > STUDIO_WORD_MAX_LENGTH || /\p{Cc}/u.test(item.initialValue)
          : item.initialValue !== "") ||
        !item.visible,
    ) ||
    program.variables?.some(
      (item, index) =>
        item.id !== `studio-var-${index + 1}` ||
        !DATA_NAME.test(item.name) ||
        (item.scope === "stage"
          ? !finiteSmallNumber(item.initialValue)
          : item.initialValue !== 0) ||
        !item.visible,
    ) ||
    program.lists?.some(
      (item, index) =>
        item.id !== `studio-list-${index + 1}` ||
        !DATA_NAME.test(item.name) ||
        (item.scope === "stage"
          ? item.initialItems.length > 10 ||
            item.initialItems.some((value) =>
              typeof value === "number"
                ? !finiteSmallNumber(value)
                : value.length > STUDIO_WORD_MAX_LENGTH || /\p{Cc}/u.test(value),
            )
          : item.initialItems.length !== 0) ||
        !item.visible,
    ) ||
    mainScripts(program).some((script, position) => {
      const actor = actorOfScript(script.id);
      return (
        !actor ||
        actor.index !== position + 1 ||
        !checkedTrigger(script.trigger) ||
        !checkedProcedures(script.procedures, position + 1, program) ||
        statementCount(script.statements) +
          (script.procedures ?? []).reduce((sum, item) => sum + statementCount(item.body), 0) >
          MAX_STUDIO_BLOCKS ||
        script.statements.some((statement) => !checked(statement, program))
      );
    }) ||
    !validCloneScripts(program) ||
    !validExtraScripts(program)
  )
    throw new RangeError("program is outside Kids studio");
  return program;
}

/** The scripts of the characters themselves, without the scripts their copies start with. */
export function mainScripts(program: ProjectProgram): readonly Script[] {
  return program.scripts.filter(
    (script) => cloneActorOfScript(script.id) === null && extraActorOfScript(script.id) === null,
  );
}

/**
 * A character may have one more script, the one each copy starts with: after every character's
 * own script, one at most per character, started by "when I start as a clone", with no custom
 * blocks of its own, and the only place "delete this clone" means something.
 */
function validCloneScripts(program: ProjectProgram): boolean {
  const mains = mainScripts(program);
  const clones = program.scripts
    .slice(mains.length)
    .filter((script) => extraActorOfScript(script.id) === null);
  if (mains.some((script, index) => program.scripts[index] !== script)) return false;
  const seen = new Set<number>();
  return clones.every((script) => {
    const target = cloneActorOfScript(script.id);
    const main = target === null ? undefined : actorOfScript(mains[target.index - 1]?.id ?? "");
    if (
      target === null ||
      main === null ||
      main === undefined ||
      main.characterId !== target.characterId ||
      seen.has(target.index) ||
      script.trigger.type !== "onCloneStart" ||
      (script.procedures?.length ?? 0) > 0 ||
      statementCount(script.statements) > MAX_STUDIO_BLOCKS ||
      !script.statements.every((statement) => checked(statement, program, 0, 0, true))
    )
      return false;
    seen.add(target.index);
    return true;
  });
}

export function createStudioProgram(characterId: KidsGalleryCharacterId): ProjectProgram {
  return validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [{ id: scriptId(1, characterId), trigger: { type: "greenFlag" }, statements: [] }],
  });
}

function switchedGalleryBackdrops(program: ProjectProgram, initialId: string): string[] {
  const found = new Set<string>();
  const visit = (statements: readonly Statement[]) => {
    for (const statement of statements) {
      if (
        statement.type === "switchBackdrop" &&
        statement.backdropId !== initialId &&
        isGalleryBackdropId(statement.backdropId.slice("backdrop:".length))
      )
        found.add(statement.backdropId);
      if ("body" in statement && Array.isArray(statement.body)) visit(statement.body);
      if ("then" in statement && Array.isArray(statement.then)) visit(statement.then);
      if ("else" in statement && Array.isArray(statement.else)) visit(statement.else);
    }
  };
  program.scripts.forEach((script) => {
    visit(script.statements);
    script.procedures?.forEach((procedure) => visit(procedure.body));
  });
  program.sharedProcedures?.forEach((procedure) => visit(procedure.body));
  return [...found];
}

export function creativeForStudio(
  raw: ProjectProgram,
  backdropId: KidsGalleryBackdropId,
  locale: Locale,
  positions: Readonly<
    Record<
      string,
      {
        readonly x: number;
        readonly y: number;
        readonly direction?: number;
        readonly size?: number;
      }
    >
  > = {},
  actorOrder: readonly string[] = [],
  art: StudioArt = {},
): ProjectCreativeState {
  const program = validateStudioProgram(raw);
  if (!isGalleryBackdropId(backdropId)) throw new RangeError("unknown studio backdrop");
  const customAssets = studioArtAssets(art.assets);
  const assets = [
    ...KIDS_GALLERY_CHARACTERS.map((item) => ({
      id: `costume:${item.id}`,
      kind: "costume" as const,
      name: galleryCharacterName(item.id, locale),
      source: `builtin:kids-gallery-character:${item.id}`,
    })),
    ...KIDS_GALLERY_BACKDROPS.map((item) => ({
      id: `backdrop:${item.id}`,
      kind: "backdrop" as const,
      name: locale === "es" ? item.es : item.en,
      source: `builtin:kids-gallery-backdrop:${item.id}`,
    })),
    ...KIDS_SOUNDS.map((item) => ({
      id: item.id,
      kind: "sound" as const,
      name: locale === "es" ? item.es : item.en,
      source: `builtin:kids-sound:${item.id}`,
    })),
    ...customAssets,
  ];
  // "Costume number" counts from the character's own costume, then the child's pictures in order.
  const costumeOrders: Record<string, readonly string[]> = {};
  const ownCostumeIds = customAssets
    .filter((item) => item.kind === "costume")
    .map((item) => item.id);
  const actors = mainScripts(program).map((script, position) => {
    const actor = actorOfScript(script.id)!;
    const id = studioActorId(actor.index, actor.characterId);
    costumeOrders[id] = [`costume:${actor.characterId}`, ...ownCostumeIds];
    const saved = positions[id];
    return {
      id,
      name: galleryCharacterName(actor.characterId, locale),
      x:
        saved && Number.isInteger(saved.x) && saved.x >= 0 && saved.x <= 320
          ? saved.x
          : (position % 5) * 60,
      y:
        saved && Number.isInteger(saved.y) && saved.y >= -100 && saved.y <= 120
          ? saved.y
          : Math.floor(position / 5) * 60,
      direction:
        saved &&
        Number.isInteger(saved.direction) &&
        saved.direction! >= -180 &&
        saved.direction! <= 180
          ? saved.direction!
          : 0,
      size:
        saved && Number.isInteger(saved.size) && saved.size! >= 10 && saved.size! <= 400
          ? saved.size!
          : 100,
      visible: true,
      costumeId:
        customAssets.some(
          (asset) => asset.kind === "costume" && asset.id === art.actorCostumes?.[id],
        ) ||
        (art.actorCostumes?.[id]?.startsWith("costume:") &&
          isGalleryCharacterId(art.actorCostumes[id]!.slice(8)))
          ? art.actorCostumes![id]!
          : `costume:${actor.characterId}`,
      scripts: [
        script.id,
        ...program.scripts
          .filter((item) => {
            const extra = extraActorOfScript(item.id);
            return extra !== null && extra.index === actor.index;
          })
          .map((item) => item.id),
      ],
    };
  });
  const ids = actors.map((actor) => actor.id);
  const order =
    actorOrder.length === ids.length &&
    new Set(actorOrder).size === ids.length &&
    actorOrder.every((id) => ids.includes(id))
      ? actorOrder
      : ids;
  return validateProjectCreativeState(
    {
      assets,
      actors,
      colorZones: BACKDROP_COLOR_ZONES,
      costumeOrders,
      backdropOrder: [
        `backdrop:${backdropId}`,
        ...switchedGalleryBackdrops(program, `backdrop:${backdropId}`),
        ...customAssets.filter((item) => item.kind === "backdrop").map((item) => item.id),
      ],
      stage: {
        backdropId: customAssets.some(
          (asset) => asset.kind === "backdrop" && asset.id === art.stageBackdropId,
        )
          ? art.stageBackdropId
          : `backdrop:${backdropId}`,
        actorOrder: order,
        width: 400,
        height: 260,
      },
    },
    program,
  );
}

export function addStudioActor(
  history: EditorHistory,
  characterId: KidsGalleryCharacterId,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (!isGalleryCharacterId(characterId) || mainScripts(program).length >= MAX_STUDIO_ACTORS)
    throw new RangeError("studio actor limit or unknown character");
  const next = validateStudioProgram({
    ...program,
    scripts: [
      ...mainScripts(program),
      {
        id: scriptId(mainScripts(program).length + 1, characterId),
        trigger: { type: "greenFlag" },
        statements: [],
      },
      ...program.scripts.filter(
        (script) =>
          cloneActorOfScript(script.id) !== null || extraActorOfScript(script.id) !== null,
      ),
    ],
  });
  return recordCanonicalTransaction(history, { label: "add studio actor", after: next }).history;
}

export function appendStudioStatement(
  history: EditorHistory,
  actorId: string,
  statement: StudioStatement,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (!checked(statement, program, 0, 0, isCloneTarget(actorId)))
    throw new RangeError("unsupported studio block or asset");
  const index = scriptIndexOfActor(program, actorId);
  if (
    statement.type === "createCopies" &&
    statement.withScript === true &&
    !hasStudioCloneScript(program, actorId)
  )
    throw new RangeError("this character has no copy script");
  if (index < 0) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  const script = scripts[index]!;
  scripts[index] = { ...script, statements: [...script.statements, statement] };
  // A pen or music block makes the project declare its extension (ADR 0011).
  const pack = [
    "penDown",
    "penUp",
    "setPenColor",
    "setPenSize",
    "setPenTransparency",
    "setPenShade",
    "clearPen",
    "stamp",
  ].includes(statement.type)
    ? ("pen" as const)
    : ["playNote", "playDrum", "setInstrument", "setTempo", "setPitch", "setPan"].includes(
          statement.type,
        )
      ? ("music" as const)
      : undefined;
  const declared = program.extensions ?? [];
  const next = validateStudioProgram({
    ...program,
    ...(pack !== undefined && !declared.includes(pack) ? { extensions: [...declared, pack] } : {}),
    scripts,
  });
  return recordCanonicalTransaction(history, { label: `add ${statement.type}`, after: next })
    .history;
}

/** Turn the learner's last blocks into one visible, undoable control block. */
export function wrapStudioTail(
  history: EditorHistory,
  actorId: string,
  count: number,
  control:
    | { readonly type: "repeat"; readonly times: 2 | 3 | 5 }
    | { readonly type: "repeatUntil"; readonly condition: Expression }
    | { readonly type: "forever" }
    | { readonly type: "if"; readonly condition: Expression },
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script || !Number.isInteger(count) || count < 1 || count > MAX_STUDIO_BODY)
    throw new RangeError("invalid studio group");
  if (script.statements.length < count) throw new RangeError("not enough studio blocks");
  const body = script.statements.slice(-count);
  const statement: Statement =
    control.type === "repeat"
      ? { type: "repeat", count: control.times, body }
      : control.type === "repeatUntil"
        ? { type: "repeatUntil", condition: control.condition, body }
        : control.type === "forever"
          ? { type: "forever", body }
          : { type: "if", condition: control.condition, then: body };
  if (!checked(statement, program, 0, 0, isCloneTarget(actorId)))
    throw new RangeError("unsupported studio group");
  const scripts = [...program.scripts];
  scripts[index] = {
    ...script,
    statements: [...script.statements.slice(0, -count), statement],
  };
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: `group ${control.type}`, after: next })
    .history;
}

/** The editing target of a character's copy script: its actor id and this suffix (#1311). */
export const CLONE_TARGET_SUFFIX = ":clone";

/**
 * A character's extra scripts, after its own and after any copy script: one per slot with no gap,
 * each with its own event (never the copy hat, never one the character already answers), no custom
 * blocks, and together with the character's own script within the block limit.
 */
function validExtraScripts(program: ProjectProgram): boolean {
  const mains = mainScripts(program);
  const extras = program.scripts.filter((script) => extraActorOfScript(script.id) !== null);
  const slots = new Map<number, number[]>();
  const triggers = new Map<number, Set<string>>();
  for (const script of extras) {
    const target = extraActorOfScript(script.id)!;
    const main = mains[target.index - 1];
    const owner = main === undefined ? null : actorOfScript(main.id);
    if (
      main === undefined ||
      owner === null ||
      owner.characterId !== target.characterId ||
      script.trigger.type === "onCloneStart" ||
      !checkedTrigger(script.trigger) ||
      (script.procedures?.length ?? 0) > 0 ||
      !script.statements.every((statement) => checked(statement, program))
    )
      return false;
    const seen = triggers.get(target.index) ?? new Set([JSON.stringify(main.trigger)]);
    const key = JSON.stringify(script.trigger);
    if (seen.has(key)) return false;
    seen.add(key);
    triggers.set(target.index, seen);
    slots.set(target.index, [...(slots.get(target.index) ?? []), target.slot]);
  }
  for (const [index, found] of slots) {
    // Slot 2 first, then 3, so a character never has a gap or a repeat.
    if (found.some((slot, at) => slot !== at + 2)) return false;
    const main = mains[index - 1]!;
    const used =
      statementCount(main.statements) +
      (main.procedures ?? []).reduce((sum, item) => sum + statementCount(item.body), 0) +
      extras
        .filter((script) => extraActorOfScript(script.id)!.index === index)
        .reduce((sum, script) => sum + statementCount(script.statements), 0);
    if (used > MAX_STUDIO_BLOCKS) return false;
  }
  return true;
}

export const EXTRA_TARGET_PREFIX = ":script-";

/** The name an extra script is edited through, like `studioCloneTarget` for the copy script. */
export function studioExtraTarget(actorId: string, slot: 2 | 3): string {
  return `${actorId}${EXTRA_TARGET_PREFIX}${slot}`;
}

function splitExtraTarget(actorId: string): { actor: string; slot: 2 | 3 } | null {
  const at = actorId.lastIndexOf(EXTRA_TARGET_PREFIX);
  if (at < 0) return null;
  const slot = actorId.slice(at + EXTRA_TARGET_PREFIX.length);
  return slot === "2" || slot === "3"
    ? { actor: actorId.slice(0, at), slot: Number(slot) as 2 | 3 }
    : null;
}

export function studioCloneTarget(actorId: string): string {
  return `${actorId}${CLONE_TARGET_SUFFIX}`;
}

function isCloneTarget(actorId: string): boolean {
  return actorId.endsWith(CLONE_TARGET_SUFFIX);
}

/** The script a character, or its copy script (`studioCloneTarget`), is edited through. */
function scriptIndexOfActor(program: ProjectProgram, actorId: string): number {
  const extra = splitExtraTarget(actorId);
  if (extra !== null)
    return program.scripts.findIndex((script) => {
      const found = extraActorOfScript(script.id);
      return (
        found !== null &&
        found.slot === extra.slot &&
        studioActorId(found.index, found.characterId) === extra.actor
      );
    });
  const copies = isCloneTarget(actorId);
  const wanted = copies ? actorId.slice(0, -CLONE_TARGET_SUFFIX.length) : actorId;
  return program.scripts.findIndex((script) => {
    const actor = copies ? cloneActorOfScript(script.id) : actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === wanted;
  });
}

/** Whether the character has the script its copies start with. */
export function hasStudioCloneScript(program: ProjectProgram, actorId: string): boolean {
  return scriptIndexOfActor(program, studioCloneTarget(actorId)) >= 0;
}

/** The blocks of a character's copy script; none when it has no such script. */
export function studioCloneStatements(
  program: ProjectProgram,
  actorId: string,
): readonly Statement[] {
  return program.scripts[scriptIndexOfActor(program, studioCloneTarget(actorId))]?.statements ?? [];
}

/** Give a character the script its copies start with ("when I start as a clone"), empty. */
export function addStudioCloneScript(history: EditorHistory, actorId: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  const main = program.scripts[scriptIndexOfActor(program, actorId)];
  const owner = main === undefined ? null : actorOfScript(main.id);
  if (owner === null || hasStudioCloneScript(program, actorId))
    throw new RangeError("unknown studio actor or it already has a copy script");
  const next = validateStudioProgram({
    ...program,
    scripts: [
      ...program.scripts,
      {
        id: cloneScriptId(owner.index, owner.characterId),
        trigger: { type: "onCloneStart" },
        statements: [],
      },
    ],
  });
  return recordCanonicalTransaction(history, { label: "add copy script", after: next }).history;
}

/** The extra scripts a character has, in slot order, each named for editing like the copy script. */
export function studioExtraScripts(
  program: ProjectProgram,
  actorId: string,
): readonly { readonly slot: 2 | 3; readonly target: string; readonly script: Script }[] {
  return ([2, 3] as const).flatMap((slot) => {
    const script = program.scripts[scriptIndexOfActor(program, studioExtraTarget(actorId, slot))];
    return script === undefined ? [] : [{ slot, target: studioExtraTarget(actorId, slot), script }];
  });
}

/** Give a character one more script, started by an event it does not answer yet, empty. */
export function addStudioScript(
  history: EditorHistory,
  actorId: string,
  trigger: Trigger,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const main = program.scripts[scriptIndexOfActor(program, actorId)];
  const owner = main === undefined ? null : actorOfScript(main.id);
  const have = studioExtraScripts(program, actorId).length;
  if (owner === null || have >= MAX_STUDIO_EXTRA_SCRIPTS || !checkedTrigger(trigger))
    throw new RangeError("unknown studio actor, or it has the most scripts allowed");
  const next = validateStudioProgram({
    ...program,
    scripts: [
      ...program.scripts,
      {
        id: extraScriptId(owner.index, owner.characterId, (have + 2) as 2 | 3),
        trigger,
        statements: [],
      },
    ],
  });
  return recordCanonicalTransaction(history, { label: "add script", after: next }).history;
}

/** Take away the last extra script of a character; the blocks in it go with it. */
export function removeStudioScript(history: EditorHistory, actorId: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  const last = studioExtraScripts(program, actorId).at(-1);
  if (last === undefined) throw new RangeError("that character has no extra script");
  const next = validateStudioProgram({
    ...program,
    scripts: program.scripts.filter((script) => script !== last.script),
  });
  return recordCanonicalTransaction(history, { label: "remove script", after: next }).history;
}

function withoutCopyScripts(statements: readonly Statement[]): Statement[] {
  return statements.map((statement) => {
    if (statement.type === "createCopies" && statement.withScript === true) {
      return { type: "createCopies", count: statement.count, rule: statement.rule };
    }
    if (
      statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
    )
      return { ...statement, body: withoutCopyScripts(statement.body) };
    if (statement.type === "if")
      return {
        ...statement,
        then: withoutCopyScripts(statement.then),
        ...(statement.else === undefined ? {} : { else: withoutCopyScripts(statement.else) }),
      };
    return statement;
  });
}

/** Take a character's copy script away; its "copies with a script" go back to plain copies. */
export function removeStudioCloneScript(history: EditorHistory, actorId: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  const at = scriptIndexOfActor(program, studioCloneTarget(actorId));
  if (at < 0) throw new RangeError("that character has no copy script");
  const main = scriptIndexOfActor(program, actorId);
  const scripts = program.scripts
    .filter((_script, index) => index !== at)
    .map((script, index) =>
      index === main ? { ...script, statements: withoutCopyScripts(script.statements) } : script,
    );
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: "remove copy script", after: next }).history;
}

/** "If it touches the edge, delete this clone": the way most copies end, in one block. */
export function addStudioCloneEdgeDelete(history: EditorHistory, actorId: string): EditorHistory {
  return withScript(history, studioCloneTarget(actorId), "add delete at the edge", (script) => ({
    ...script,
    statements: [
      ...script.statements,
      { type: "if", condition: STUDIO_EDGE_CONDITION, then: [{ type: "deleteThisClone" }] },
    ],
  }));
}

function countCalls(statements: readonly Statement[], procedureId: string): number {
  return statements.reduce((sum, statement) => {
    if (statement.type === "callProcedure")
      return sum + (statement.procedureId === procedureId ? 1 : 0);
    if (
      statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
    )
      return sum + countCalls(statement.body, procedureId);
    if (statement.type === "if")
      return (
        sum +
        countCalls(statement.then, procedureId) +
        countCalls(statement.else ?? [], procedureId)
      );
    return sum;
  }, 0);
}

/** How many places in this character's script (blocks and other custom blocks) call a custom block. */
export function studioProcedureUses(
  program: ProjectProgram,
  actorId: string,
  procedureId: string,
): number {
  const script = program.scripts[scriptIndexOfActor(program, actorId)];
  return script ? scriptCalls(script, procedureId) : 0;
}

function scriptCalls(script: ProjectProgram["scripts"][number], procedureId: string): number {
  return (
    countCalls(script.statements, procedureId) +
    (script.procedures ?? []).reduce((sum, item) => sum + countCalls(item.body, procedureId), 0)
  );
}

const FROM_FIELDS = {
  stepsFrom: "steps",
  degreesFrom: "degrees",
  secondsFrom: "seconds",
  countFrom: "count",
} as const;

// Same limits as the runtime clamp, so inlining a call keeps the exact behaviour it had.
const FROM_LIMITS = {
  steps: { min: -1000, max: 1000, round: false },
  degrees: { min: -1000, max: 1000, round: false },
  seconds: { min: 0.1, max: 5, round: false },
  count: { min: 1, max: 1000, round: true },
} as const;

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rebuild a tree of statements, letting `visit` replace any object (return undefined to recurse). */
function deepMap(node: Json, visit: (item: Record<string, Json>) => Json | undefined): Json {
  if (Array.isArray(node)) return node.map((item) => deepMap(item, visit));
  if (!isRecord(node)) return node;
  const replaced = visit(node);
  if (replaced !== undefined) return replaced;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, deepMap(value, visit)]),
  );
}

/** Rewrite every `…From` field and `param` expression of a body; null unbinds a number. */
function remapParams(
  body: readonly Statement[],
  next: (id: ProcedureParamId) => ProcedureParamId | null,
): Statement[] {
  const visit = (item: Record<string, Json>): Json | undefined => {
    if (item.type === "param") {
      const id = next(item.paramId as ProcedureParamId);
      return id === null ? { type: "numericLiteral", value: 0 } : { ...item, paramId: id };
    }
    if (!Object.keys(item).some((key) => key in FROM_FIELDS)) return undefined;
    const copy: Record<string, Json> = {};
    for (const [key, value] of Object.entries(item)) {
      if (key in FROM_FIELDS) {
        const id = next(value as ProcedureParamId);
        if (id !== null) copy[key] = id;
      } else copy[key] = deepMap(value, visit);
    }
    return copy;
  };
  return deepMap(body, visit) as Statement[];
}

function clampField(field: keyof typeof FROM_LIMITS, value: number): number {
  const limits = FROM_LIMITS[field];
  const bounded = Math.min(limits.max, Math.max(limits.min, value));
  return limits.round ? Math.round(bounded) : bounded;
}

/** The body of a custom block as one call sees it: each number replaced by the call's own value. */
function bodyForCall(procedure: Procedure, call: { args?: readonly Expression[] }): Statement[] {
  // Each of the block's numbers becomes the call's value: a fixed number, or the caller's own number.
  const bound = call.args?.map((item) =>
    item.type === "param" ? item.paramId : (item as { value: number }).value,
  );
  if (!bound) return [...procedure.body];
  const boundTo = (id: ProcedureParamId) => bound[PARAM_IDS.indexOf(id)] ?? 0;
  const visit = (item: Record<string, Json>): Json | undefined => {
    if (item.type === "param") {
      const value = boundTo(item.paramId as ProcedureParamId);
      return typeof value === "string"
        ? { type: "param", paramId: value }
        : { type: "numericLiteral", value };
    }
    if (!Object.keys(item).some((key) => key in FROM_FIELDS)) return undefined;
    const copy: Record<string, Json> = {};
    for (const [key, value] of Object.entries(item))
      if (!(key in FROM_FIELDS)) copy[key] = deepMap(value, visit);
    for (const [key, value] of Object.entries(item)) {
      if (!(key in FROM_FIELDS)) continue;
      const field = FROM_FIELDS[key as keyof typeof FROM_FIELDS];
      const target = boundTo(value as ProcedureParamId);
      // A number handed on stays a follower (the fixed value is its default); a fixed one replaces it.
      if (typeof target === "string") copy[key] = target;
      else copy[field] = clampField(field, target);
    }
    return copy;
  };
  return deepMap(procedure.body, visit) as Statement[];
}

function replaceCalls(statements: readonly Statement[], procedure: Procedure): Statement[] {
  return statements.flatMap((statement): Statement[] => {
    if (statement.type === "callProcedure")
      return statement.procedureId === procedure.id
        ? bodyForCall(procedure, statement)
        : [statement];
    if (
      statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
    )
      return [{ ...statement, body: replaceCalls(statement.body, procedure) }];
    if (statement.type === "if")
      return [
        {
          ...statement,
          then: replaceCalls(statement.then, procedure),
          ...(statement.else === undefined
            ? {}
            : { else: replaceCalls(statement.else, procedure) }),
        },
      ];
    return [statement];
  });
}

/** Apply `change` to every call of a custom block, wherever the character's blocks keep it. */
function mapCalls(
  statements: readonly Statement[],
  procedureId: string,
  change: (call: Extract<Statement, { type: "callProcedure" }>) => Statement,
): Statement[] {
  return statements.map((statement): Statement => {
    if (statement.type === "callProcedure")
      return statement.procedureId === procedureId ? change(statement) : statement;
    if (
      statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
    )
      return { ...statement, body: mapCalls(statement.body, procedureId, change) };
    if (statement.type === "if")
      return {
        ...statement,
        then: mapCalls(statement.then, procedureId, change),
        ...(statement.else === undefined
          ? {}
          : { else: mapCalls(statement.else, procedureId, change) }),
      };
    return statement;
  });
}

function mapScriptCalls(
  script: ProjectProgram["scripts"][number],
  procedureId: string,
  change: (call: Extract<Statement, { type: "callProcedure" }>) => Statement,
): ProjectProgram["scripts"][number] {
  return {
    ...script,
    statements: mapCalls(script.statements, procedureId, change),
    ...(script.procedures === undefined
      ? {}
      : {
          procedures: script.procedures.map((item) => ({
            ...item,
            body: mapCalls(item.body, procedureId, change),
          })),
        }),
  };
}

/** What a call gives one number: a fixed value, or the id of the calling block's own number. */
export type StudioCallValue = number | ProcedureParamId;

function withArgs(
  call: Extract<Statement, { type: "callProcedure" }>,
  args: readonly StudioCallValue[],
): Statement {
  const rest = withoutKey(call, "args");
  return args.length === 0
    ? rest
    : {
        ...rest,
        args: args.map((value) =>
          typeof value === "string"
            ? ({ type: "param", paramId: value } as const)
            : ({ type: "numericLiteral", value } as const),
        ),
      };
}

function argValues(call: Extract<Statement, { type: "callProcedure" }>): StudioCallValue[] {
  return (call.args ?? []).map((item) => (item.type === "param" ? item.paramId : item.value));
}

function withScript(
  history: EditorHistory,
  actorId: string,
  label: string,
  change: (
    script: ProjectProgram["scripts"][number],
    actorIndex: number,
    shared: readonly Procedure[],
  ) => ProjectProgram["scripts"][number],
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  scripts[index] = change(script, index + 1, program.sharedProcedures ?? []);
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label, after: next }).history;
}

/** Turn the last blocks of a character into one named custom block and a call to it. */
export function createStudioProcedure(
  history: EditorHistory,
  actorId: string,
  count: number,
  name: string,
  numbers: readonly string[] = [],
): EditorHistory {
  return withScript(history, actorId, "create custom block", (script, actorIndex) => {
    const procedures = script.procedures ?? [];
    if (numbers.length > PARAM_IDS.length) throw new RangeError("custom block number limit");
    if (!Number.isInteger(count) || count < 1 || script.statements.length < count)
      throw new RangeError("invalid custom block group");
    if (procedures.length >= MAX_STUDIO_PROCEDURES) throw new RangeError("custom block limit");
    const taken = new Set(procedures.map((item) => item.id));
    let n = 1;
    while (taken.has(`proc-${actorIndex}-${n}`)) n += 1;
    const id = `proc-${actorIndex}-${n}`;
    return {
      ...script,
      procedures: [
        ...procedures,
        {
          id,
          name,
          ...(numbers.length === 0
            ? {}
            : { params: numbers.map((title, index) => ({ id: PARAM_IDS[index]!, name: title })) }),
          body: script.statements.slice(-count),
        },
      ],
      statements: [
        ...script.statements.slice(0, -count),
        withArgs(
          { type: "callProcedure", procedureId: id },
          numbers.map(() => 0),
        ),
      ],
    };
  });
}

/**
 * Turn the last blocks of a script into a block made for everyone (a shared one) and a call to it.
 * It is how a character's second or third script gets a custom block of its own making: those
 * scripts keep no blocks of their own, but any script can call a shared one. The new block's name
 * must differ from the shared ones that exist.
 */
export function createSharedStudioProcedure(
  history: EditorHistory,
  actorId: string,
  count: number,
  name: string,
  numbers: readonly string[] = [],
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script) throw new RangeError("unknown studio actor");
  if (numbers.length > PARAM_IDS.length) throw new RangeError("custom block number limit");
  if (!Number.isInteger(count) || count < 1 || script.statements.length < count)
    throw new RangeError("invalid custom block group");
  const existing = program.sharedProcedures ?? [];
  if (existing.length >= MAX_STUDIO_SHARED) throw new RangeError("shared block limit");
  if (existing.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    throw new RangeError("a shared block already has that name");
  const taken = new Set(existing.map((item) => item.id));
  let n = 1;
  while (taken.has(`shared-${n}`)) n += 1;
  const id = `shared-${n}`;
  const procedure: Procedure = {
    id,
    name,
    ...(numbers.length === 0
      ? {}
      : { params: numbers.map((title, at) => ({ id: PARAM_IDS[at]!, name: title })) }),
    body: script.statements.slice(-count),
  };
  const scripts = [...program.scripts];
  scripts[index] = {
    ...script,
    statements: [
      ...script.statements.slice(0, -count),
      withArgs(
        { type: "callProcedure", procedureId: id },
        numbers.map(() => 0),
      ),
    ],
  };
  return recordCanonicalTransaction(history, {
    label: "create shared custom block",
    after: validateStudioProgram({
      ...program,
      sharedProcedures: [...existing, procedure],
      scripts,
    }),
  }).history;
}

export function renameStudioProcedure(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  name: string,
): EditorHistory {
  return withScript(history, actorId, "rename custom block", (script) => {
    if (!script.procedures?.some((item) => item.id === procedureId))
      throw new RangeError("unknown custom block");
    return {
      ...script,
      procedures: script.procedures.map((item) =>
        item.id === procedureId ? { ...item, name } : item,
      ),
    };
  });
}

export type StudioNumberUnit = ProcedureNumberUnit;

/** Values a child can pick for a call's number, by the unit of the first block that uses it. */
export const STUDIO_NUMBER_CHOICES = PROCEDURE_NUMBER_CHOICES;

export const STUDIO_NUMBER_DEFAULTS = PROCEDURE_NUMBER_DEFAULTS;

/** The unit of each of a custom block's numbers, shared with Ori's host-side allow-list. */
export const studioProcedureNumberUnits = procedureNumberUnits;

/** Add one titled number to a custom block; every call of it starts with 0 for the new number. */
export function addStudioProcedureNumber(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  title: string,
): EditorHistory {
  return withScript(history, actorId, "add custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const params = procedure.params ?? [];
    if (params.length >= PARAM_IDS.length) throw new RangeError("custom block number limit");
    const changed = mapScriptCalls(script, procedureId, (call) =>
      withArgs(call, [...argValues(call), 0]),
    );
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) =>
        item.id === procedureId
          ? { ...item, params: [...params, { id: PARAM_IDS[params.length]!, name: title }] }
          : item,
      ),
    };
  });
}

/**
 * Remove one of a custom block's numbers. Blocks that used it keep their fixed value, later numbers
 * move up one place and every call drops that number.
 */
export function removeStudioProcedureNumber(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  paramId: ProcedureParamId,
): EditorHistory {
  return withScript(history, actorId, "remove custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    const at = PARAM_IDS.indexOf(paramId);
    if (!procedure || at < 0 || at >= (procedure.params?.length ?? 0))
      throw new RangeError("unknown custom block number");
    const changed = mapScriptCalls(script, procedureId, (call) =>
      withArgs(
        call,
        argValues(call).filter((_value, index) => index !== at),
      ),
    );
    const remaining = (procedure.params ?? [])
      .filter((_item, index) => index !== at)
      .map((item, index): ProcedureParam => ({ id: PARAM_IDS[index]!, name: item.name }));
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) => {
        if (item.id !== procedureId) return item;
        const rest = withoutKey(item, "params");
        return {
          ...rest,
          ...(remaining.length === 0 ? {} : { params: remaining }),
          body: remapParams(item.body, (id) => {
            const index = PARAM_IDS.indexOf(id);
            if (index === at) return null;
            return index > at ? PARAM_IDS[index - 1]! : id;
          }),
        };
      }),
    };
  });
}

export type StudioBlockPath = readonly (number | "else")[];

function updateAt(
  list: readonly Statement[],
  path: StudioBlockPath,
  change: (statement: Statement) => Statement,
): Statement[] {
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= list.length)
    throw new RangeError("unknown block");
  return list.map((item, index): Statement => {
    if (index !== head) return item;
    if (rest.length === 0) return change(item);
    if (item.type === "repeat" || item.type === "repeatUntil" || item.type === "forever")
      return { ...item, body: updateAt(item.body, rest, change) };
    if (item.type === "if") {
      if (rest[0] === "else" && item.else)
        return { ...item, else: updateAt(item.else, rest.slice(1), change) };
      return { ...item, then: updateAt(item.then, rest, change) };
    }
    throw new RangeError("unknown block");
  });
}

/**
 * One list of blocks in a character's script: the script itself (`container: null`), or one body of
 * a repeat, repeat-until or if. `branch` picks the "else" of an if; any other body is the default.
 */
export interface StudioListRef {
  readonly container: StudioBlockPath | null;
  readonly branch?: "else";
}

function removeAt(
  list: readonly Statement[],
  path: StudioBlockPath,
): { readonly list: Statement[]; readonly removed: Statement } {
  const [head, ...rest] = path;
  if (typeof head !== "number" || head < 0 || head >= list.length)
    throw new RangeError("unknown block");
  if (rest.length === 0)
    return { list: list.filter((_item, index) => index !== head), removed: list[head]! };
  const item = list[head]!;
  let removed: Statement | undefined;
  const next = (inner: readonly Statement[], innerPath: StudioBlockPath) => {
    const result = removeAt(inner, innerPath);
    removed = result.removed;
    return result.list;
  };
  let replaced: Statement;
  if (item.type === "repeat" || item.type === "repeatUntil" || item.type === "forever")
    replaced = { ...item, body: next(item.body, rest) };
  else if (item.type === "if" && rest[0] === "else" && item.else)
    replaced = { ...item, else: next(item.else, rest.slice(1)) };
  else if (item.type === "if") replaced = { ...item, then: next(item.then, rest) };
  else throw new RangeError("unknown block");
  return {
    list: list.map((entry, index) => (index === head ? replaced : entry)),
    removed: removed!,
  };
}

function insertInto(
  list: readonly Statement[],
  target: StudioListRef,
  index: number,
  statement: Statement,
): Statement[] {
  const put = (inner: readonly Statement[]) => {
    if (!Number.isInteger(index) || index < 0 || index > inner.length)
      throw new RangeError("unknown studio place");
    return [...inner.slice(0, index), statement, ...inner.slice(index)];
  };
  if (target.container === null) return put(list);
  return updateAt(list, target.container, (item) => {
    if (item.type === "repeat" || item.type === "repeatUntil" || item.type === "forever")
      return { ...item, body: put(item.body) };
    if (item.type === "if" && target.branch === "else")
      return item.else
        ? { ...item, else: put(item.else) }
        : (() => {
            throw new RangeError("unknown studio place");
          })();
    if (item.type === "if") return { ...item, then: put(item.then) };
    throw new RangeError("unknown studio place");
  });
}

function startsWith(path: StudioBlockPath, prefix: StudioBlockPath): boolean {
  return prefix.length <= path.length && prefix.every((step, at) => path[at] === step);
}

/**
 * Move a block to any list of the same character: into a repeat or if, out of one, or between
 * them (issue #593). `index` counts in the target list after the block has left its place. The
 * move is one undoable step, and a block cannot go into itself nor leave a body empty.
 */
export function moveStudioStatementTo(
  history: EditorHistory,
  actorId: string,
  from: StudioBlockPath,
  target: StudioListRef,
  index: number,
): EditorHistory {
  return withScript(history, actorId, "move studio block", (script) => {
    if (target.container !== null && startsWith(target.container, from))
      throw new RangeError("a block cannot go into itself");
    const { list, removed } = removeAt(script.statements, from);
    // Taking a block out of a list shifts its later siblings, and any path that runs through them.
    let container = target.container;
    if (container !== null) {
      const parent = from.slice(0, -1);
      const place = from[from.length - 1];
      const at = parent.length;
      if (startsWith(container, parent) && typeof place === "number") {
        const sibling = container[at];
        if (typeof sibling === "number" && sibling > place)
          container = [...container.slice(0, at), sibling - 1, ...container.slice(at + 1)];
      }
    }
    return {
      ...script,
      statements: insertInto(list, { ...target, container }, index, removed),
    };
  });
}

function containsCall(statement: Statement): boolean {
  if (statement.type === "callProcedure") return true;
  if (
    statement.type === "repeat" ||
    statement.type === "repeatUntil" ||
    statement.type === "forever"
  )
    return statement.body.some(containsCall);
  if (statement.type === "if")
    return statement.then.some(containsCall) || (statement.else ?? []).some(containsCall);
  return false;
}

/**
 * Hand one of a character's blocks to another character, which gets it at the end of its program
 * (issue #593). A block that uses a custom block stays: those belong to their character.
 */
export function moveStudioStatementToActor(
  history: EditorHistory,
  fromActorId: string,
  index: number,
  toActorId: string,
): EditorHistory {
  if (fromActorId === toActorId) throw new RangeError("choose another character");
  const program = validateStudioProgram(history.current);
  const fromAt = scriptIndexOfActor(program, fromActorId);
  const toAt = scriptIndexOfActor(program, toActorId);
  const from = program.scripts[fromAt];
  const to = program.scripts[toAt];
  if (!from || !to) throw new RangeError("unknown studio actor");
  const moving = from.statements[index];
  if (!moving) throw new RangeError("unknown studio block");
  if (containsCall(moving)) throw new RangeError("custom blocks stay with their character");
  const scripts = [...program.scripts];
  scripts[fromAt] = { ...from, statements: from.statements.filter((_item, at) => at !== index) };
  scripts[toAt] = { ...to, statements: [...to.statements, moving] };
  return recordCanonicalTransaction(history, {
    label: "give studio block to another character",
    after: validateStudioProgram({ ...program, scripts }),
  }).history;
}

function withoutKey<T extends object>(value: T, key: string): T {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as T;
}

/** The number a block inside a custom block currently follows, if any. */
export function studioBlockNumber(statement: Statement): ProcedureParamId | null {
  switch (statement.type) {
    case "move":
      return statement.stepsFrom ?? null;
    case "turn":
      return statement.degreesFrom ?? null;
    case "wait":
      return statement.secondsFrom ?? null;
    case "repeat":
      return statement.countFrom ?? null;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "param" ? statement.value.paramId : null;
    case "changeVariable":
      return statement.delta.type === "param" ? statement.delta.paramId : null;
    default:
      return null;
  }
}

/** Whether a block has a number slot that can follow one of the custom block's numbers. */
export function studioBlockHasNumberSlot(statement: Statement): boolean {
  switch (statement.type) {
    case "move":
    case "turn":
    case "wait":
    case "repeat":
      return true;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "numericLiteral" || statement.value.type === "param";
    case "changeVariable":
      return statement.delta.type === "numericLiteral" || statement.delta.type === "param";
    default:
      return false;
  }
}

function bindStatement(statement: Statement, paramId: ProcedureParamId | null): Statement {
  const expression = (): Expression =>
    paramId === null ? { type: "numericLiteral", value: 0 } : { type: "param", paramId };
  switch (statement.type) {
    case "move":
      return paramId === null
        ? withoutKey(statement, "stepsFrom")
        : { ...statement, stepsFrom: paramId };
    case "turn":
      return paramId === null
        ? withoutKey(statement, "degreesFrom")
        : { ...statement, degreesFrom: paramId };
    case "wait":
      return paramId === null
        ? withoutKey(statement, "secondsFrom")
        : { ...statement, secondsFrom: paramId };
    case "repeat":
      return paramId === null
        ? withoutKey(statement, "countFrom")
        : { ...statement, countFrom: paramId };
    case "setVariable":
    case "listAdd":
      return { ...statement, value: expression() };
    case "changeVariable":
      return { ...statement, delta: expression() };
    default:
      throw new RangeError("this block has no number slot");
  }
}

function fixedValue(statement: Statement): number {
  switch (statement.type) {
    case "move":
      return statement.steps;
    case "turn":
      return statement.degrees;
    case "wait":
      return statement.seconds;
    case "repeat":
      return statement.count;
    case "setVariable":
    case "listAdd":
      return statement.value.type === "numericLiteral" ? statement.value.value : 0;
    case "changeVariable":
      return statement.delta.type === "numericLiteral" ? statement.delta.value : 0;
    default:
      return 0;
  }
}

function usesNumber(body: readonly Statement[], paramId: ProcedureParamId): boolean {
  let used = false;
  remapParams(body, (id) => {
    if (id === paramId) used = true;
    return id;
  });
  return used;
}

/**
 * Make a block inside a custom block follow one of its numbers (or go back to its fixed value with
 * null). The first block to use a number gives every call that block's value, so nothing changes
 * until the child picks a different number in a call.
 */
export function bindStudioProcedureBlock(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  path: StudioBlockPath,
  paramId: ProcedureParamId | null,
): EditorHistory {
  return withScript(history, actorId, "set custom block number", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const at = paramId === null ? -1 : PARAM_IDS.indexOf(paramId);
    if (paramId !== null && at >= (procedure.params?.length ?? 0))
      throw new RangeError("unknown custom block number");
    let seed = 0;
    const body = updateAt(procedure.body, path, (statement) => {
      if (!studioBlockHasNumberSlot(statement))
        throw new RangeError("this block has no number slot");
      seed = fixedValue(statement);
      return bindStatement(statement, paramId);
    });
    const first = paramId !== null && !usesNumber(procedure.body, paramId);
    const changed = first
      ? mapScriptCalls(script, procedureId, (call) =>
          withArgs(
            call,
            argValues(call).map((value, index) =>
              index === at && typeof value === "number" ? seed : value,
            ),
          ),
        )
      : script;
    return {
      ...changed,
      procedures: (changed.procedures ?? []).map((item) =>
        item.id === procedureId ? { ...item, body } : item,
      ),
    };
  });
}

/** Choose the numbers for one use of a custom block in the character's blocks. */
export function setStudioCallNumbers(
  history: EditorHistory,
  actorId: string,
  index: number,
  values: readonly number[],
): EditorHistory {
  return withScript(history, actorId, "set custom block numbers", (script, _actor, shared) => {
    const call = script.statements[index];
    if (call?.type !== "callProcedure") throw new RangeError("not a custom block");
    const arity =
      [...(script.procedures ?? []), ...shared].find((item) => item.id === call.procedureId)?.params
        ?.length ?? 0;
    if (values.length !== arity) throw new RangeError("wrong number of values");
    return {
      ...script,
      statements: script.statements.map((item, position) =>
        position === index ? withArgs(call, values) : item,
      ),
    };
  });
}

function reaches(procedures: readonly Procedure[], from: string, target: string): boolean {
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const body = procedures.find((item) => item.id === id)?.body ?? [];
    if (countCalls(body, target) > 0) return true;
    return procedures.some(
      (item) => item.id !== id && countCalls(body, item.id) > 0 && visit(item.id),
    );
  };
  return visit(from);
}

/**
 * Delete a custom block. "refuse" fails while anything still calls it; "inline" first replaces each
 * call with the block's own blocks, so the character does exactly what it did before.
 */
export function deleteStudioProcedure(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  mode: "refuse" | "inline",
): EditorHistory {
  return withScript(history, actorId, "delete custom block", (script) => {
    const procedure = script.procedures?.find((item) => item.id === procedureId);
    if (!procedure) throw new RangeError("unknown custom block");
    const uses = scriptCalls(script, procedureId);
    if (uses > 0 && mode === "refuse") throw new RangeError("custom block is in use");
    if (uses > 0 && reaches(script.procedures ?? [], procedureId, procedureId))
      throw new RangeError("a block that calls itself cannot be inlined");
    const rest = (script.procedures ?? []).filter((item) => item.id !== procedureId);
    const inlined = rest.map((item) => ({
      ...item,
      body: replaceCalls(item.body, procedure),
    }));
    return {
      id: script.id,
      trigger: script.trigger,
      statements: replaceCalls(script.statements, procedure),
      ...(inlined.length === 0 ? {} : { procedures: inlined }),
    };
  });
}

/**
 * Change one value of a block already in a character's program (issue #1240). Only the fields a
 * block exposes can change (`kidsBlockProperties`), and the whole program is validated again, so
 * a value outside the closed lists throws and nothing is recorded. One undoable step.
 */
const EDITABLE_FIELDS: Partial<Record<Statement["type"], readonly string[]>> = {
  move: ["steps"],
  turn: ["degrees"],
  wait: ["seconds"],
  repeat: ["count"],
  setSize: ["size"],
  changeSize: ["delta"],
  playSound: ["soundId"],
  switchCostume: ["costumeId"],
  say: ["text"],
  think: ["text"],
};

export function setStudioStatementField(
  history: EditorHistory,
  actorId: string,
  index: number,
  field: string,
  value: number | string,
): EditorHistory {
  return withScript(history, actorId, `edit ${field}`, (script) => {
    const statement = script.statements[index];
    if (!statement) throw new RangeError("unknown block");
    if (!(EDITABLE_FIELDS[statement.type] ?? []).includes(field))
      throw new RangeError("that value of this block cannot be edited");
    return {
      ...script,
      statements: script.statements.map((item, position) =>
        position === index ? ({ ...item, [field]: value } as Statement) : item,
      ),
    };
  });
}

export function setStudioTrigger(
  history: EditorHistory,
  actorId: string,
  trigger: Trigger | "greenFlag" | "onActorClicked",
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const resolved = typeof trigger === "string" ? ({ type: trigger } as Trigger) : trigger;
  if (!checkedTrigger(resolved)) throw new RangeError("unsupported studio event");
  const index = scriptIndexOfActor(program, actorId);
  if (index < 0) throw new RangeError("unknown studio actor");
  const scripts = [...program.scripts];
  scripts[index] = { ...scripts[index]!, trigger: resolved };
  return recordCanonicalTransaction(history, {
    label: "set studio event",
    after: validateStudioProgram({ ...program, scripts }),
  }).history;
}

export function addStudioVariable(
  history: EditorHistory,
  name: string,
  scope?: "stage",
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (
    !DATA_NAME.test(name) ||
    (program.variables?.length ?? 0) >= 3 ||
    program.variables?.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  )
    throw new RangeError("invalid studio variable");
  const variables = [
    ...(program.variables ?? []),
    {
      id: `studio-var-${(program.variables?.length ?? 0) + 1}`,
      name,
      initialValue: 0,
      visible: true,
      ...(scope === "stage" ? { scope } : {}),
    },
  ];
  return recordCanonicalTransaction(history, {
    label: "add studio variable",
    after: validateStudioProgram({ ...program, variables }),
  }).history;
}

export function addStudioText(
  history: EditorHistory,
  name: string,
  scope?: "stage",
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (
    !DATA_NAME.test(name) ||
    (program.textVariables?.length ?? 0) >= 3 ||
    program.textVariables?.some(
      (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    throw new RangeError("invalid studio text variable");
  const textVariables = [
    ...(program.textVariables ?? []),
    {
      id: `studio-text-${(program.textVariables?.length ?? 0) + 1}`,
      name,
      initialValue: "",
      visible: true,
      ...(scope === "stage" ? { scope } : {}),
    },
  ];
  return recordCanonicalTransaction(history, {
    label: "add studio text variable",
    after: validateStudioProgram({ ...program, textVariables }),
  }).history;
}

export function addStudioList(
  history: EditorHistory,
  name: string,
  scope?: "stage",
): EditorHistory {
  const program = validateStudioProgram(history.current);
  if (
    !DATA_NAME.test(name) ||
    (program.lists?.length ?? 0) >= 3 ||
    program.lists?.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  )
    throw new RangeError("invalid studio list");
  const lists = [
    ...(program.lists ?? []),
    {
      id: `studio-list-${(program.lists?.length ?? 0) + 1}`,
      name,
      initialItems: [],
      visible: true,
      ...(scope === "stage" ? { scope } : {}),
    },
  ];
  return recordCanonicalTransaction(history, {
    label: "add studio list",
    after: validateStudioProgram({ ...program, lists }),
  }).history;
}

export function removeStudioStatement(
  history: EditorHistory,
  actorId: string,
  statementIndex: number,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script || statementIndex < 0 || statementIndex >= script.statements.length)
    throw new RangeError("unknown studio block");
  const scripts = [...program.scripts];
  scripts[index] = {
    ...script,
    statements: script.statements.filter((_, at) => at !== statementIndex),
  };
  const next = validateStudioProgram({ ...program, scripts });
  return recordCanonicalTransaction(history, { label: "remove studio block", after: next }).history;
}

/** Copy one of a character's top-level blocks right after itself, as one undoable step (#1110). */
export function duplicateStudioStatement(
  history: EditorHistory,
  actorId: string,
  statementIndex: number,
): EditorHistory {
  return withScript(history, actorId, "duplicate studio block", (script) => {
    const block = script.statements[statementIndex];
    if (block === undefined) throw new RangeError("unknown studio block");
    const statements = [...script.statements];
    statements.splice(statementIndex + 1, 0, structuredClone(block));
    return { ...script, statements };
  });
}

/**
 * Move one of a character's blocks to another place in its script (issue #593). The blocks keep
 * their content; only the order changes, as one undoable step. A block can be dragged or moved
 * with the keyboard, and both end here.
 */
export function moveStudioStatement(
  history: EditorHistory,
  actorId: string,
  from: number,
  to: number,
): EditorHistory {
  return withScript(history, actorId, "move studio block", (script) => {
    const count = script.statements.length;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= count)
      throw new RangeError("unknown studio block");
    if (to < 0 || to >= count) throw new RangeError("unknown studio place");
    if (from === to) return script;
    const statements = [...script.statements];
    const [moved] = statements.splice(from, 1);
    statements.splice(to, 0, moved!);
    return { ...script, statements };
  });
}

/**
 * Choose the numbers for a use of one custom block inside another. Each value is a fixed number or
 * the id of one of the enclosing block's own numbers, which hands that number on.
 */
export function setStudioProcedureCallNumbers(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
  path: StudioBlockPath,
  values: readonly StudioCallValue[],
): EditorHistory {
  return withScript(history, actorId, "set custom block numbers", (script, _actor, shared) => {
    const owner = script.procedures?.find((item) => item.id === procedureId);
    if (!owner) throw new RangeError("unknown custom block");
    const body = updateAt(owner.body, path, (statement) => {
      if (statement.type !== "callProcedure") throw new RangeError("not a custom block");
      const arity =
        [...(script.procedures ?? []), ...shared].find((item) => item.id === statement.procedureId)
          ?.params?.length ?? 0;
      if (values.length !== arity) throw new RangeError("wrong number of values");
      return withArgs(statement, values);
    });
    return {
      ...script,
      procedures: (script.procedures ?? []).map((item) =>
        item.id === procedureId ? { ...item, body } : item,
      ),
    };
  });
}

function called(statements: readonly Statement[]): string[] {
  return statements.flatMap((statement): string[] => {
    if (statement.type === "callProcedure") return [statement.procedureId];
    if (
      statement.type === "repeat" ||
      statement.type === "repeatUntil" ||
      statement.type === "forever"
    )
      return called(statement.body);
    if (statement.type === "if")
      return [...called(statement.then), ...called(statement.else ?? [])];
    return [];
  });
}

function withoutSharedProcedures(program: ProjectProgram): ProjectProgram {
  return Object.fromEntries(
    Object.entries(program).filter(([key]) => key !== "sharedProcedures"),
  ) as unknown as ProjectProgram;
}

/** The blocks made for every character, in the order they were made. */
export function studioSharedProcedures(program: ProjectProgram): readonly Procedure[] {
  return program.sharedProcedures ?? [];
}

/** How many times the characters' blocks call a shared block, counting every script. */
export function studioSharedUses(program: ProjectProgram, procedureId: string): number {
  return (
    program.scripts.reduce(
      (sum, script) =>
        sum +
        countCalls(script.statements, procedureId) +
        (script.procedures ?? []).reduce(
          (inner, item) => inner + countCalls(item.body, procedureId),
          0,
        ),
      0,
    ) +
    (program.sharedProcedures ?? []).reduce(
      (sum, item) => sum + countCalls(item.body, procedureId),
      0,
    )
  );
}

/**
 * Make one of a character's custom blocks (and every block of its own it uses) a block for every
 * character. It leaves this character's own list, and this character's calls now call the shared
 * block, so nothing it does changes. Other characters keep whatever they had; a copy someone else
 * made earlier stays their own. One undoable step.
 */
export function shareStudioProcedure(
  history: EditorHistory,
  actorId: string,
  procedureId: string,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const index = scriptIndexOfActor(program, actorId);
  const script = program.scripts[index];
  if (!script) throw new RangeError("unknown studio actor");
  const own = script.procedures ?? [];
  const wanted: string[] = [];
  const visit = (id: string) => {
    if (wanted.includes(id) || STUDIO_SHARED_ID.test(id)) return;
    const found = own.find((item) => item.id === id);
    if (!found) throw new RangeError("unknown custom block");
    wanted.push(id);
    called(found.body).forEach(visit);
  };
  visit(procedureId);
  const existing = program.sharedProcedures ?? [];
  if (existing.length + wanted.length > MAX_STUDIO_SHARED)
    throw new RangeError("shared block limit");
  const taken = new Set(existing.map((item) => item.id));
  const renamed = new Map<string, string>();
  let n = 1;
  for (const id of wanted) {
    while (taken.has(`shared-${n}`)) n += 1;
    renamed.set(id, `shared-${n}`);
    taken.add(`shared-${n}`);
  }
  const names = new Set(existing.map((item) => item.name.toLocaleLowerCase()));
  for (const id of wanted)
    if (names.has(own.find((item) => item.id === id)!.name.toLocaleLowerCase()))
      throw new RangeError("a shared block already has that name");
  const rewrite = (body: readonly Statement[]) =>
    deepMap(body, (node) =>
      node.type === "callProcedure" && renamed.has(node.procedureId as string)
        ? { ...node, procedureId: renamed.get(node.procedureId as string)! }
        : undefined,
    ) as Statement[];
  const moved = wanted.map((id): Procedure => {
    const item = own.find((entry) => entry.id === id)!;
    return { ...item, id: renamed.get(id)!, body: rewrite(item.body) };
  });
  const stay = own
    .filter((item) => !renamed.has(item.id))
    .map((item) => ({ ...item, body: rewrite(item.body) }));
  const scripts = [...program.scripts];
  scripts[index] = {
    id: script.id,
    trigger: script.trigger,
    statements: rewrite(script.statements),
    ...(stay.length === 0 ? {} : { procedures: stay }),
  };
  return recordCanonicalTransaction(history, {
    label: "share custom block",
    after: validateStudioProgram({
      ...program,
      sharedProcedures: [...existing, ...moved],
      scripts,
    }),
  }).history;
}

/**
 * Stop sharing a block: every call, in every character, is replaced by the block's own blocks, so
 * each character does exactly what it did before, and the shared block goes away. Refused for a
 * block that calls itself, or that another shared block calls. One undoable step.
 */
export function unshareStudioProcedure(history: EditorHistory, procedureId: string): EditorHistory {
  const program = validateStudioProgram(history.current);
  const shared = program.sharedProcedures ?? [];
  const procedure = shared.find((item) => item.id === procedureId);
  if (!procedure) throw new RangeError("unknown shared block");
  if (
    reaches(shared, procedureId, procedureId) ||
    shared.some((item) => item.id !== procedureId && countCalls(item.body, procedureId) > 0)
  )
    throw new RangeError("a block that others call cannot be unshared");
  const scripts = program.scripts.map((script) => ({
    ...script,
    statements: replaceCalls(script.statements, procedure),
    ...(script.procedures === undefined
      ? {}
      : {
          procedures: script.procedures.map((item) => ({
            ...item,
            body: replaceCalls(item.body, procedure),
          })),
        }),
  }));
  const rest = shared.filter((item) => item.id !== procedureId);
  const withoutShared = withoutSharedProcedures(program);
  return recordCanonicalTransaction(history, {
    label: "stop sharing custom block",
    after: validateStudioProgram({
      ...withoutShared,
      ...(rest.length === 0 ? {} : { sharedProcedures: rest }),
      scripts,
    }),
  }).history;
}

/** Delete a shared block nobody calls. Refused while any character still does. */
export function deleteStudioSharedProcedure(
  history: EditorHistory,
  procedureId: string,
): EditorHistory {
  const program = validateStudioProgram(history.current);
  const shared = program.sharedProcedures ?? [];
  if (!shared.some((item) => item.id === procedureId)) throw new RangeError("unknown shared block");
  if (studioSharedUses(program, procedureId) > 0) throw new RangeError("shared block is in use");
  const rest = shared.filter((item) => item.id !== procedureId);
  const withoutShared = withoutSharedProcedures(program);
  return recordCanonicalTransaction(history, {
    label: "delete shared custom block",
    after: validateStudioProgram({
      ...withoutShared,
      ...(rest.length === 0 ? {} : { sharedProcedures: rest }),
    }),
  }).history;
}

/**
 * Give another character its own copy of a custom block, together with every block it uses. The
 * copies are independent: changing one later never changes the other.
 */
export function copyStudioProcedure(
  history: EditorHistory,
  fromActorId: string,
  procedureId: string,
  toActorId: string,
): EditorHistory {
  if (fromActorId === toActorId) throw new RangeError("choose another character");
  const program = validateStudioProgram(history.current);
  const from = program.scripts[scriptIndexOfActor(program, fromActorId)];
  const toIndex = scriptIndexOfActor(program, toActorId);
  const to = program.scripts[toIndex];
  if (!from || !to) throw new RangeError("unknown studio actor");
  const source = from.procedures ?? [];
  const wanted: string[] = [];
  const visit = (id: string) => {
    // A shared block is already everyone's, so a copy keeps calling it.
    if (wanted.includes(id) || STUDIO_SHARED_ID.test(id)) return;
    const found = source.find((item) => item.id === id);
    if (!found) throw new RangeError("unknown custom block");
    wanted.push(id);
    called(found.body).forEach(visit);
  };
  visit(procedureId);
  const existing = to.procedures ?? [];
  if (existing.length + wanted.length > MAX_STUDIO_PROCEDURES)
    throw new RangeError("custom block limit");
  const actorIndex = toIndex + 1;
  const taken = new Set(existing.map((item) => item.id));
  const renamed = new Map<string, string>();
  let n = 1;
  for (const id of wanted) {
    while (taken.has(`proc-${actorIndex}-${n}`)) n += 1;
    renamed.set(id, `proc-${actorIndex}-${n}`);
    taken.add(`proc-${actorIndex}-${n}`);
  }
  const copies = wanted.map((id): Procedure => {
    const item = source.find((entry) => entry.id === id)!;
    const body = deepMap(item.body, (node) =>
      node.type === "callProcedure"
        ? {
            ...node,
            procedureId: renamed.get(node.procedureId as string) ?? node.procedureId,
          }
        : undefined,
    ) as Statement[];
    return { ...item, id: renamed.get(id)!, body };
  });
  const scripts = [...program.scripts];
  scripts[toIndex] = { ...to, procedures: [...existing, ...copies] };
  return recordCanonicalTransaction(history, {
    label: "copy custom block",
    after: validateStudioProgram({ ...program, scripts }),
  }).history;
}
