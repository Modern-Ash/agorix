import {
  MUSIC_BEATS,
  PEN_TRANSPARENCIES,
  type ExtensionId,
  type MathFunction,
  type MusicDrum,
  type MusicInstrument,
  type ClockPart,
  type PenShade,
  SCHEMA_VERSION,
  STAGE_ACTOR_ID,
  type Expression,
  type ProjectProgram,
  type Script,
  type Statement,
  type Trigger,
} from "@agorix/program-model";
import { KIDS_GALLERY_CHARACTERS, type KidsGalleryBackdropId } from "./kidsGallery.js";
import { KIDS_SOUNDS } from "./kidsSoundLibrary.js";
import {
  STUDIO_BUBBLE_MAX_LENGTH,
  STUDIO_EFFECT_DELTAS,
  STUDIO_VOLUME_DELTA_RANGE,
  STUDIO_VOLUME_RANGE,
  studioEffectValues,
  STUDIO_REPEAT_COUNTS,
  STUDIO_SHIFT_AMOUNTS,
  STUDIO_SIZES,
  STUDIO_SIZE_DELTAS,
  STUDIO_TURN_AMOUNTS,
  STUDIO_WAIT_SECONDS,
} from "./kidsStudioChoices.js";
import { penColorOfHex } from "./kidsBackdropZones.js";
import {
  STUDIO_EDGE_CONDITION,
  STUDIO_NOTES,
  STUDIO_PEN_SIZES,
  STUDIO_TEMPOS,
  cloneScriptId,
  extraScriptId,
  MAX_STUDIO_EXTRA_SCRIPTS,
  STUDIO_WORD_MAX_LENGTH,
  studioActorId,
  validateStudioProgram,
} from "./kidsStudioModel.js";

/**
 * Brings a Scratch 3 project (`project.json` of an `.sb3`) into the Kids free scene. Scratch is
 * far wider than the scene, so this is an honest starter import, never a faithful copy: each
 * sprite keeps its first script, values snap to the scene's closed lists, and everything that
 * cannot come across is counted in a report the learner (or an adult) can read. The program that
 * comes out always passes `validateStudioProgram`; nothing is executed from the file.
 */
export interface ScratchImportReport {
  readonly sprites: number;
  readonly spritesSkipped: number;
  readonly blocksImported: number;
  /** Blocks that came across with a value snapped to what the scene allows. */
  readonly blocksAdjusted: number;
  /** What did not come across, by reason, most frequent first. */
  readonly dropped: readonly { readonly what: string; readonly count: number }[];
}

export interface ScratchImportResult {
  readonly program: ProjectProgram;
  readonly backdropId: KidsGalleryBackdropId;
  readonly positions: Readonly<
    Record<string, { x: number; y: number; direction: number; size: number }>
  >;
  readonly report: ScratchImportReport;
}

const CLOCK_PART_OF_SCRATCH: Readonly<Record<string, ClockPart>> = {
  YEAR: "year",
  MONTH: "month",
  DATE: "date",
  DAYOFWEEK: "dayOfWeek",
  HOUR: "hour",
  MINUTE: "minute",
  SECOND: "second",
};
/** Scratch's brightness (0 to 100, 50 is the colour itself) as the pen's three shades. */
function shadeOf(value: number): PenShade {
  return value < 40 ? "darker" : value > 60 ? "lighter" : "normal";
}

/** Scratch's drum numbers (1 snare, 2 bass, 5 and 6 hi-hats, 8 clap) to the scene's four drums. */
const DRUM_OF_SCRATCH: Readonly<Record<string, MusicDrum>> = {
  "1": "snare",
  "2": "kick",
  "5": "hat",
  "6": "hat",
  "8": "clap",
};

/** Scratch's instrument numbers to the scene's four, by family. */
const INSTRUMENT_OF_SCRATCH: Readonly<Record<string, MusicInstrument>> = {
  "1": "piano",
  "2": "piano",
  "3": "piano",
  "4": "guitar",
  "5": "guitar",
  "6": "guitar",
  "12": "flute",
  "13": "flute",
  "16": "bell",
  "17": "bell",
  "18": "bell",
  "19": "bell",
};

const MAX_SPRITES = 12;
const MESSAGES = ["hola", "vamos", "listo"] as const;
/** Scratch's `[abs] of ()` menu to ours; round is its own Scratch block. */
const SCRATCH_MATH_NAMES: Readonly<Record<string, MathFunction>> = {
  abs: "abs",
  floor: "floor",
  ceiling: "ceiling",
  sqrt: "sqrt",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  asin: "asin",
  acos: "acos",
  atan: "atan",
  ln: "ln",
  log: "log",
  "e ^": "exp",
  "10 ^": "pow10",
};

const KEYS: Readonly<Record<string, string>> = {
  space: "Space",
  "up arrow": "ArrowUp",
  "down arrow": "ArrowDown",
  "left arrow": "ArrowLeft",
  "right arrow": "ArrowRight",
  enter: "Enter",
  // Letters and digits are written the same in Scratch and here.
  ...Object.fromEntries(
    [..."abcdefghijklmnopqrstuvwxyz0123456789"].map((key) => [key, key] as const),
  ),
};
/** A text the scene keeps as a word: at most 20 letters and no control characters. */
export function wordOf(value: string): Expression | undefined {
  const trimmed = value.trim();
  return trimmed.length <= 20 && !/\p{Cc}/u.test(trimmed)
    ? { type: "textLiteral", value: trimmed }
    : undefined;
}

/** True when a Scratch value is a word, not a number. */
function isWord(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !Number.isFinite(Number(value));
}

const DATA_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,19}$/u;

type Json = Record<string, unknown>;
type Primitive = readonly [number, unknown, ...unknown[]];
interface ScratchBlock {
  readonly opcode: string;
  readonly next: string | null;
  readonly inputs: Record<string, readonly unknown[]>;
  readonly fields: Record<string, readonly unknown[]>;
  readonly topLevel: boolean;
}

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function nearest<T extends number>(value: number, list: readonly T[]): T {
  let best = list[0]!;
  for (const item of list) if (Math.abs(item - value) < Math.abs(best - value)) best = item;
  return best;
}

function parseBlock(raw: unknown): ScratchBlock | undefined {
  if (!isRecord(raw) || typeof raw["opcode"] !== "string") return undefined;
  const inputs = isRecord(raw["inputs"]) ? raw["inputs"] : {};
  const fields = isRecord(raw["fields"]) ? raw["fields"] : {};
  return {
    opcode: raw["opcode"],
    next: typeof raw["next"] === "string" ? raw["next"] : null,
    inputs: Object.fromEntries(
      Object.entries(inputs).filter((entry): entry is [string, unknown[]] =>
        Array.isArray(entry[1]),
      ),
    ),
    fields: Object.fromEntries(
      Object.entries(fields).filter((entry): entry is [string, unknown[]] =>
        Array.isArray(entry[1]),
      ),
    ),
    topLevel: raw["topLevel"] === true,
  };
}

class Converter {
  /** Canonical actor whose Scratch sprite stack is currently being converted. */
  currentActorId: string | undefined;
  /** The sprite being read has a "when I start as a clone" script, so its clones keep behaving. */
  spriteHasCloneHat = false;
  /** The stack being read is that script, where "delete this clone" means something. */
  inCloneScript = false;
  adjusted = 0;
  readonly dropped = new Map<string, number>();
  readonly variableIds = new Map<string, string>();
  /** Scratch variables that hold words, by name, with the scene's text variable they become. */
  readonly textIds = new Map<string, string>();
  /** Scratch lists by name, with the scene's list they become (up to three). */
  readonly listIds = new Map<string, string>();
  readonly messages = new Map<string, string>();
  readonly spriteActorIds = new Map<string, string>();
  usesPen = false;
  usesMusic = false;
  blocks = new Map<string, ScratchBlock>();

  drop(what: string): void {
    this.dropped.set(what, (this.dropped.get(what) ?? 0) + 1);
  }

  adjust<T>(value: T, original: unknown): T {
    if (value !== original) this.adjusted += 1;
    return value;
  }

  // --- inputs -------------------------------------------------------------

  /** A literal typed into a slot, as text. Reporters and unknown shapes give undefined. */
  literal(block: ScratchBlock, name: string): string | undefined {
    const input = block.inputs[name];
    const shadow = input?.[1];
    if (Array.isArray(shadow) && (shadow as unknown as Primitive).length >= 2) {
      const [type, value] = shadow as unknown as Primitive;
      if (type >= 4 && type <= 10 && (typeof value === "string" || typeof value === "number"))
        return String(value);
    }
    return undefined;
  }

  number(block: ScratchBlock, name: string): number | undefined {
    const text = this.literal(block, name);
    if (text === undefined || text.trim() === "") return undefined;
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }

  /** The value of a dropdown: a shadow menu block's only field, or a plain field. */
  menu(block: ScratchBlock, name: string): string | undefined {
    const field = block.fields[name]?.[0];
    if (typeof field === "string") return field;
    const reference = block.inputs[name]?.[1];
    if (typeof reference === "string") {
      const menu = this.blocks.get(reference);
      const value = menu === undefined ? undefined : Object.values(menu.fields)[0]?.[0];
      if (typeof value === "string") return value;
    }
    return undefined;
  }

  substack(block: ScratchBlock, name: string): string | undefined {
    const reference = block.inputs[name]?.[1];
    return typeof reference === "string" ? reference : undefined;
  }

  // --- expressions --------------------------------------------------------

  variable(name: string): Expression | undefined {
    const id = this.variableIds.get(name);
    return id === undefined ? undefined : { type: "variable", variableId: id };
  }

  /** A number the scene can compute with; undefined when it cannot be built. */
  numberExpression(block: ScratchBlock, name: string): Expression | undefined {
    const input = block.inputs[name];
    const shadow = input?.[1];
    if (Array.isArray(shadow)) {
      const [type, value] = shadow as unknown as Primitive;
      if (type === 12 && typeof value === "string") return this.variable(value);
      const literal = this.number(block, name);
      if (literal !== undefined) {
        const small = Math.max(-100, Math.min(100, Math.round(literal * 10) / 10));
        return { type: "numericLiteral", value: this.adjust(small, literal) };
      }
    }
    if (typeof shadow === "string") {
      const inner = this.blocks.get(shadow);
      if (inner !== undefined) return this.reporter(inner);
    }
    return undefined;
  }

  reporter(block: ScratchBlock): Expression | undefined {
    switch (block.opcode) {
      case "data_variable": {
        const name = block.fields["VARIABLE"]?.[0];
        return typeof name === "string" ? this.variable(name) : undefined;
      }
      case "data_itemoflist": {
        const listId = this.listOf(block);
        const index = this.listPosition(block, "INDEX");
        if (listId === undefined || index === undefined) {
          this.drop("data_itemoflist (a list the scene did not keep, or a position it cannot use)");
          return undefined;
        }
        return { type: "listItem", listId, index };
      }
      case "data_lengthoflist": {
        const listId = this.listOf(block);
        if (listId === undefined) {
          this.drop("data_lengthoflist (a list the scene did not keep)");
          return undefined;
        }
        return { type: "listLength", listId };
      }
      case "data_listcontainsitem":
      case "data_itemnumoflist": {
        const listId = this.listOf(block);
        const value = this.listValue(block, "ITEM");
        if (listId === undefined || value === undefined) {
          this.drop(`${block.opcode} (a list or item the scene cannot use)`);
          return undefined;
        }
        return block.opcode === "data_listcontainsitem"
          ? { type: "listContains", listId, value }
          : { type: "listIndexOf", listId, value };
      }
      case "operator_join": {
        const left = this.boundedJoinOperand(block, "STRING1");
        const right = this.boundedJoinOperand(block, "STRING2");
        if (left === undefined || right === undefined) {
          this.drop("operator_join (a word the scene cannot use)");
          return undefined;
        }
        return { type: "join", left, right };
      }
      case "operator_length": {
        const value = this.boundedStringOrJoinSource(block, "STRING");
        if (value === undefined) this.drop("operator_length (a word the scene cannot use)");
        return value === undefined ? undefined : { type: "textLength", value };
      }
      case "operator_letter_of": {
        const index = this.number(block, "LETTER");
        const value = this.boundedStringOrJoinSource(block, "STRING");
        if (
          index === undefined ||
          !Number.isInteger(index) ||
          index < 1 ||
          index > 20 ||
          value === undefined
        ) {
          this.drop("operator_letter_of (a position or word the scene cannot use)");
          return undefined;
        }
        return { type: "letterOf", index: { type: "numericLiteral", value: index }, value };
      }
      case "motion_xposition":
        return { type: "xPosition" };
      case "motion_yposition":
        return { type: "yPosition" };
      case "motion_direction":
        return { type: "direction" };
      case "looks_size":
        return { type: "sizePercent" };
      case "sensing_timer":
        return { type: "timer" };
      case "sensing_loudness":
        return { type: "loudness" };
      case "sensing_current": {
        const part = CLOCK_PART_OF_SCRATCH[String(block.fields["CURRENTMENU"]?.[0]).toUpperCase()];
        return part === undefined ? undefined : { type: "currentTime", part };
      }
      case "looks_costumenumbername":
        if (block.fields["NUMBER_NAME"]?.[0] === "number") return { type: "costumeNumber" };
        return block.fields["NUMBER_NAME"]?.[0] === "name" && this.currentActorId !== undefined
          ? { type: "actorProperty", actorId: this.currentActorId, property: "costumeName" }
          : undefined;
      case "looks_backdropnumbername":
        if (block.fields["NUMBER_NAME"]?.[0] === "number") return { type: "backdropNumber" };
        return block.fields["NUMBER_NAME"]?.[0] === "name"
          ? { type: "actorProperty", actorId: STAGE_ACTOR_ID, property: "backdropName" }
          : undefined;
      case "sensing_distanceto": {
        const target = this.menu(block, "DISTANCETOMENU");
        if (target === "_mouse_") return { type: "distanceToMouse" };
        const actorId = target === undefined ? undefined : this.spriteActorIds.get(target);
        return actorId === undefined ? undefined : { type: "distanceToActor", actorId };
      }
      case "sensing_of": {
        const target = this.menu(block, "OBJECT");
        const actorId =
          target === "_stage_"
            ? STAGE_ACTOR_ID
            : target === undefined
              ? undefined
              : this.spriteActorIds.get(target);
        const rawProperty = block.fields["PROPERTY"]?.[0];
        if (actorId === undefined || typeof rawProperty !== "string") return undefined;
        const property = (
          {
            "x position": "xPosition",
            "y position": "yPosition",
            direction: "direction",
            size: "size",
            "costume #": "costumeNumber",
            "costume name": "costumeName",
            volume: "volume",
            "backdrop #": "backdropNumber",
            "backdrop name": "backdropName",
          } as const
        )[
          rawProperty as
            | "x position"
            | "y position"
            | "direction"
            | "size"
            | "costume #"
            | "costume name"
            | "volume"
            | "backdrop #"
            | "backdrop name"
        ];
        if (property !== undefined) return { type: "actorProperty", actorId, property };
        const variableId = this.variableIds.get(rawProperty) ?? this.textIds.get(rawProperty);
        return variableId === undefined
          ? undefined
          : { type: "actorProperty", actorId, property: "variable", variableId };
      }
      case "sensing_mousex":
        return { type: "mouseX" };
      case "sensing_mousey":
        return { type: "mouseY" };
      case "operator_add":
      case "operator_subtract":
      case "operator_multiply":
      case "operator_divide":
      case "operator_mod": {
        const left = this.numberExpression(block, "NUM1");
        const right = this.numberExpression(block, "NUM2");
        if (left === undefined || right === undefined) return undefined;
        const type = {
          operator_add: "add",
          operator_subtract: "subtract",
          operator_multiply: "multiply",
          operator_divide: "divide",
          operator_mod: "modulo",
        }[block.opcode] as "add" | "subtract" | "multiply" | "divide" | "modulo";
        return { type, left, right };
      }
      case "operator_round": {
        const value = this.numberExpression(block, "NUM");
        return value === undefined ? undefined : { type: "mathFunction", function: "round", value };
      }
      case "operator_mathop": {
        const name = SCRATCH_MATH_NAMES[this.menu(block, "OPERATOR") ?? ""];
        const value = name === undefined ? undefined : this.numberExpression(block, "NUM");
        return name === undefined || value === undefined
          ? undefined
          : { type: "mathFunction", function: name, value };
      }
      case "operator_random": {
        const min = this.numberExpression(block, "FROM");
        const max = this.numberExpression(block, "TO");
        return min === undefined || max === undefined
          ? undefined
          : { type: "randomInteger", min, max };
      }
      default:
        return undefined;
    }
  }

  condition(input: readonly unknown[] | undefined): Expression | undefined {
    const reference = input?.[1];
    const block = typeof reference === "string" ? this.blocks.get(reference) : undefined;
    return block === undefined ? undefined : this.booleanBlock(block);
  }

  booleanBlock(block: ScratchBlock): Expression | undefined {
    switch (block.opcode) {
      case "operator_contains": {
        const text = this.boundedTextConditionSource(block, "STRING1");
        const part = this.boundedTextConditionSource(block, "STRING2");
        if (text === undefined || part === undefined) {
          this.drop("operator_contains (a word the scene cannot use)");
          return undefined;
        }
        return { type: "textContains", text, part };
      }
      case "data_listcontainsitem": {
        const listId = this.listOf(block);
        const value = this.listValue(block, "ITEM");
        return listId === undefined || value === undefined
          ? undefined
          : { type: "listContains", listId, value };
      }
      case "sensing_keypressed": {
        const key = this.menu(block, "KEY_OPTION")?.toLowerCase();
        const mapped = key === undefined ? undefined : KEYS[key];
        return mapped === undefined ? undefined : { type: "keyDown", key: mapped };
      }
      case "sensing_mousedown":
        return { type: "mouseDown" };
      case "sensing_touchingcolor": {
        // Scratch picks a colour with a swatch (a hex value); the scene knows the pen palette.
        const hex = this.literal(block, "COLOR");
        const color = hex === undefined ? undefined : penColorOfHex(hex);
        if (color === undefined) return undefined;
        this.adjusted += 1;
        return { type: "touchingColor", color };
      }
      case "sensing_touchingobject": {
        const target = this.menu(block, "TOUCHINGOBJECTMENU");
        if (target === "_edge_") return { ...STUDIO_EDGE_CONDITION };
        if (target === "_mouse_") return { type: "touchingMouse" };
        const actorId = target === undefined ? undefined : this.spriteActorIds.get(target);
        return actorId === undefined ? undefined : { type: "touchingActor", actorId };
      }
      case "operator_lt":
      case "operator_gt": {
        const left =
          this.numberExpression(block, "OPERAND1") ?? this.boundedStringSource(block, "OPERAND1");
        const right =
          this.numberExpression(block, "OPERAND2") ?? this.boundedStringSource(block, "OPERAND2");
        if (left === undefined || right === undefined) {
          this.drop(`${block.opcode} (values the scene cannot compare)`);
          return undefined;
        }
        const type = {
          operator_lt: "lessThan",
          operator_gt: "greaterThan",
        }[block.opcode] as "lessThan" | "greaterThan";
        return { type, left, right };
      }
      case "operator_equals": {
        const leftNumber = this.numberExpression(block, "OPERAND1");
        const rightNumber = this.numberExpression(block, "OPERAND2");
        if (leftNumber !== undefined && rightNumber !== undefined)
          return { type: "equals", left: leftNumber, right: rightNumber };
        const left = this.boundedTextConditionSource(block, "OPERAND1");
        const right = this.boundedTextConditionSource(block, "OPERAND2");
        if (left === undefined || right === undefined) {
          this.drop("operator_equals (values the scene cannot compare)");
          return undefined;
        }
        return { type: "equals", left, right };
      }
      case "operator_and":
      case "operator_or": {
        const left = this.condition(block.inputs["OPERAND1"]);
        const right = this.condition(block.inputs["OPERAND2"]);
        return left === undefined || right === undefined
          ? undefined
          : { type: block.opcode === "operator_and" ? "and" : "or", left, right };
      }
      case "operator_not": {
        const value = this.condition(block.inputs["OPERAND"]);
        return value === undefined ? undefined : { type: "not", value };
      }
      default:
        return undefined;
    }
  }

  // --- statements ---------------------------------------------------------

  stack(startId: string | undefined | null): Statement[] {
    const out: Statement[] = [];
    let id = startId ?? null;
    let guard = 0;
    while (id !== null && guard++ < 500) {
      const block = this.blocks.get(id);
      if (block === undefined) break;
      const statement = this.statement(block);
      if (statement !== undefined) out.push(statement);
      id = block.next;
    }
    return out;
  }

  /** x and y of Scratch's 480 by 360 stage, centred and y-up, on the scene's stage. */
  stageX(x: number): number {
    return Math.max(0, Math.min(320, Math.round(160 + (x * 2) / 3)));
  }
  stageY(y: number): number {
    return Math.max(-100, Math.min(120, Math.round(10 - (y * 110) / 180)));
  }

  statement(block: ScratchBlock): Statement | undefined {
    const num = (name: string) => this.number(block, name);
    const missing = () => {
      this.drop(`${block.opcode} (value comes from another block)`);
      return undefined;
    };
    switch (block.opcode) {
      case "motion_movesteps": {
        const steps = num("STEPS");
        if (steps === undefined) return missing();
        const cells = Math.max(1, Math.min(10, Math.round(Math.abs((steps * 2) / 3) / 20)));
        const value = Math.sign(steps || 1) * cells * 20;
        return { type: "move", steps: this.adjust(value, steps) };
      }
      case "motion_turnright":
      case "motion_turnleft": {
        const degrees = num("DEGREES");
        if (degrees === undefined) return missing();
        const amount = nearest(Math.abs(degrees), STUDIO_TURN_AMOUNTS);
        this.adjust(amount, Math.abs(degrees));
        return {
          type: "turn",
          degrees: block.opcode === "motion_turnright" ? amount : -amount,
        };
      }
      case "motion_pointindirection": {
        const direction = num("DIRECTION");
        if (direction === undefined) return missing();
        const heading = (((direction - 90) % 360) + 360) % 360;
        const signed = heading > 180 ? heading - 360 : heading;
        const choices = [0, 90, 180, -90] as const;
        const best = choices.reduce((a, b) =>
          Math.min(Math.abs(a - signed), 360 - Math.abs(a - signed)) <=
          Math.min(Math.abs(b - signed), 360 - Math.abs(b - signed))
            ? a
            : b,
        );
        return { type: "pointInDirection", degrees: this.adjust(best, signed) };
      }
      case "motion_gotoxy": {
        const x = num("X");
        const y = num("Y");
        if (x === undefined || y === undefined) return missing();
        this.adjusted += 1;
        return { type: "goTo", x: this.stageX(x), y: this.stageY(y) };
      }
      case "motion_glidesecstoxy": {
        const x = num("X");
        const y = num("Y");
        const seconds = num("SECS");
        if (x === undefined || y === undefined || seconds === undefined) return missing();
        this.adjusted += 1;
        return {
          type: "glideTo",
          x: this.stageX(x),
          y: this.stageY(y),
          seconds: nearest(seconds, STUDIO_WAIT_SECONDS),
        };
      }
      case "motion_setx": {
        const x = num("X");
        if (x === undefined) return missing();
        this.adjusted += 1;
        return { type: "setX", x: this.stageX(x) };
      }
      case "motion_sety": {
        const y = num("Y");
        if (y === undefined) return missing();
        this.adjusted += 1;
        return { type: "setY", y: this.stageY(y) };
      }
      case "motion_changexby": {
        const dx = num("DX");
        if (dx === undefined) return missing();
        const value = nearest((dx * 2) / 3, STUDIO_SHIFT_AMOUNTS);
        return { type: "changeX", dx: this.adjust(value, dx) };
      }
      case "motion_changeyby": {
        const dy = num("DY");
        if (dy === undefined) return missing();
        const value = nearest((-dy * 110) / 180, STUDIO_SHIFT_AMOUNTS);
        return { type: "changeY", dy: this.adjust(value, dy) };
      }
      case "motion_setrotationstyle": {
        const style = this.menu(block, "STYLE");
        return {
          type: "setRotationStyle",
          style: style === "left-right" ? "leftRight" : style === "don't rotate" ? "none" : "all",
        };
      }
      case "control_create_clone_of": {
        this.adjusted += 1;
        // A clone of itself, in a sprite that has the clone hat, keeps running that script.
        if (this.menu(block, "CLONE_OPTION") === "_myself_" && this.spriteHasCloneHat)
          return { type: "createCopies", count: 3, rule: "spread", withScript: true };
        this.drop(
          "control_create_clone_of (clones with scripts of their own: made as plain copies)",
        );
        return { type: "createCopies", count: 3, rule: "spread" };
      }
      case "control_delete_this_clone":
        if (this.inCloneScript) return { type: "deleteThisClone" };
        this.drop("control_delete_this_clone (outside a clone script)");
        return undefined;
      case "motion_ifonedgebounce":
        return { type: "bounceOnEdge" };
      case "motion_goto":
      case "motion_glideto": {
        const target = this.menu(block, "TO");
        const glide = block.opcode === "motion_glideto";
        const seconds = glide ? num("SECS") : undefined;
        if (glide && seconds === undefined) return missing();
        const trip = glide
          ? { seconds: this.adjust(nearest(seconds!, STUDIO_WAIT_SECONDS), seconds) }
          : {};
        if (target === "_random_") return { type: "goToTarget", target: "random", ...trip };
        if (target === "_mouse_") return { type: "goToTarget", target: "mouse", ...trip };
        const actorId = target === undefined ? undefined : this.spriteActorIds.get(target);
        if (actorId !== undefined) return { type: "goToTarget", target: "actor", actorId, ...trip };
        this.drop(`${block.opcode} (a sprite that is not in this project)`);
        return undefined;
      }
      case "motion_pointtowards": {
        const target = this.menu(block, "TOWARDS");
        const actorId = target === undefined ? undefined : this.spriteActorIds.get(target);
        if (actorId === undefined) {
          this.drop("motion_pointtowards (not a sprite of this project)");
          return undefined;
        }
        return { type: "pointTowards", actorId };
      }
      case "looks_say":
      case "looks_think":
      case "looks_sayforsecs":
      case "looks_thinkforsecs": {
        const joined = this.joinedMessage(block);
        const reference = block.inputs["MESSAGE"]?.[1];
        const isReporter =
          typeof reference === "string" ||
          (Array.isArray(reference) && (reference as unknown as Primitive)[0] === 12);
        const direct =
          isReporter && joined === undefined ? this.listValue(block, "MESSAGE") : undefined;
        const raw =
          joined?.text ?? this.literal(block, "MESSAGE") ?? (direct === undefined ? undefined : "");
        if (raw === undefined) return missing();
        if (raw.trim() === "" && direct === undefined && joined?.append === undefined) {
          this.drop(`${block.opcode} (an empty message the scene cannot show)`);
          return undefined;
        }
        const text = raw.slice(0, STUDIO_BUBBLE_MAX_LENGTH);
        this.adjust(text, raw);
        const kind = block.opcode.includes("say") ? "say" : "think";
        const append =
          direct !== undefined
            ? { append: direct }
            : joined?.append === undefined
              ? {}
              : { append: joined.append };
        if (!block.opcode.endsWith("forsecs")) return { type: kind, text, ...append };
        const seconds = num("SECS");
        return {
          type: kind,
          text,
          ...append,
          seconds: nearest(seconds ?? 2, STUDIO_WAIT_SECONDS),
        };
      }
      case "looks_show":
        return { type: "show" };
      case "looks_hide":
        return { type: "hide" };
      case "looks_setsizeto": {
        const size = num("SIZE");
        if (size === undefined) return missing();
        return { type: "setSize", size: this.adjust(nearest(size, STUDIO_SIZES), size) };
      }
      case "looks_changesizeby": {
        const change = num("CHANGE");
        if (change === undefined) return missing();
        return {
          type: "changeSize",
          delta: this.adjust(nearest(change, STUDIO_SIZE_DELTAS), change),
        };
      }
      case "looks_gotofrontback": {
        const layer = this.menu(block, "FRONT_BACK");
        return { type: "goToLayer", layer: layer === "back" ? "back" : "front" };
      }
      case "looks_goforwardbackwardlayers": {
        const direction = this.menu(block, "FORWARD_BACKWARD");
        const layers = num("NUM");
        if (layers === undefined || (direction !== "forward" && direction !== "backward"))
          return missing();
        const steps = Math.max(1, Math.min(3, Math.round(layers)));
        if (steps !== layers) this.adjusted += 1;
        return { type: "goToLayer", layer: direction, steps };
      }
      case "control_wait": {
        const seconds = num("DURATION");
        if (seconds === undefined) return missing();
        return {
          type: "wait",
          seconds: this.adjust(nearest(seconds, STUDIO_WAIT_SECONDS), seconds),
        };
      }
      case "control_repeat": {
        const times = num("TIMES");
        const body = this.stack(this.substack(block, "SUBSTACK"));
        if (times === undefined) return missing();
        if (body.length === 0) return undefined;
        const count = nearest(times, STUDIO_REPEAT_COUNTS);
        return { type: "repeat", count: this.adjust(count, times), body: body.slice(0, 3) };
      }
      case "control_forever": {
        const body = this.stack(this.substack(block, "SUBSTACK"));
        return body.length === 0 ? undefined : { type: "forever", body };
      }
      case "control_if":
      case "control_if_else": {
        const test = this.condition(block.inputs["CONDITION"]);
        const then = this.stack(this.substack(block, "SUBSTACK"));
        const otherwise =
          block.opcode === "control_if_else" ? this.stack(this.substack(block, "SUBSTACK2")) : [];
        if (test === undefined) {
          this.drop(`${block.opcode} (a condition the scene has no block for)`);
          return undefined;
        }
        if (then.length === 0) return undefined;
        return {
          type: "if",
          condition: test,
          then: then.slice(0, 3),
          ...(otherwise.length > 0 ? { else: otherwise.slice(0, 3) } : {}),
        };
      }
      case "control_wait_until": {
        const test = this.condition(block.inputs["CONDITION"]);
        if (test === undefined) {
          this.drop("control_wait_until (a condition the scene has no block for)");
          return undefined;
        }
        return { type: "waitUntil", condition: test };
      }
      case "control_repeat_until": {
        const test = this.condition(block.inputs["CONDITION"]);
        const body = this.stack(this.substack(block, "SUBSTACK"));
        if (test === undefined) {
          this.drop("control_repeat_until (a condition the scene has no block for)");
          return undefined;
        }
        return body.length === 0 ? undefined : { type: "repeatUntil", condition: test, body };
      }
      case "control_stop": {
        const option = this.menu(block, "STOP_OPTION");
        if (option === "all") return { type: "stop", scope: "scene" };
        if (option === "this script") return { type: "stop", scope: "script" };
        this.drop("control_stop (other scripts in the sprite)");
        return undefined;
      }
      case "event_broadcast":
      case "event_broadcastandwait": {
        const name = this.broadcastName(block);
        const message = name === undefined ? undefined : this.messageFor(name);
        if (message === undefined) {
          this.drop("event_broadcast (more than three different messages)");
          return undefined;
        }
        return {
          type: "broadcast",
          message,
          ...(block.opcode === "event_broadcastandwait" ? { wait: true as const } : {}),
        };
      }
      case "sound_play":
      case "sound_playuntildone": {
        const name = this.menu(block, "SOUND_MENU") ?? "";
        const key = name.trim().toLowerCase();
        const found = KIDS_SOUNDS.find(
          (item) => item.es.toLowerCase() === key || item.en.toLowerCase() === key,
        );
        if (found === undefined) this.adjusted += 1;
        return { type: "playSound", soundId: found?.id ?? "kids:pop" };
      }
      case "sound_stopallsounds":
        return { type: "stopSounds" };
      case "pen_penDown":
        this.usesPen = true;
        return { type: "penDown" };
      case "pen_penUp":
        this.usesPen = true;
        return { type: "penUp" };
      case "pen_setPenSizeTo": {
        const size = num("SIZE");
        if (size === undefined) return missing();
        this.usesPen = true;
        return {
          type: "setPenSize",
          size: this.adjust(nearest(size * 4, STUDIO_PEN_SIZES), size * 4),
        };
      }
      case "pen_setPenColorToColor": {
        // A swatch (a hex value) becomes the nearest colour of the pen palette.
        const hex = this.literal(block, "COLOR");
        const color = hex === undefined ? undefined : penColorOfHex(hex);
        if (color === undefined) return missing();
        this.usesPen = true;
        this.adjusted += 1;
        return { type: "setPenColor", color };
      }
      case "pen_setPenColorParamTo": {
        const value = num("VALUE");
        const param = this.menu(block, "COLOR_PARAM");
        if (value === undefined) return missing();
        if (param === "transparency") {
          this.usesPen = true;
          this.adjusted += 1;
          return { type: "setPenTransparency", percent: nearest(value, PEN_TRANSPARENCIES) };
        }
        if (param === "brightness") {
          this.usesPen = true;
          this.adjusted += 1;
          return { type: "setPenShade", shade: shadeOf(value) };
        }
        this.drop(`pen_setPenColorParamTo (${param ?? "unknown"})`);
        return undefined;
      }
      case "pen_setPenShadeToNumber": {
        const value = num("SHADE");
        if (value === undefined) return missing();
        this.usesPen = true;
        this.adjusted += 1;
        return { type: "setPenShade", shade: shadeOf(value) };
      }
      case "looks_seteffectto":
      case "looks_changeeffectby": {
        const effect = (this.menu(block, "EFFECT") ?? "").toLowerCase();
        if (effect !== "color" && effect !== "ghost" && effect !== "brightness") {
          this.drop(`${block.opcode} (${effect === "" ? "unknown" : effect} effect)`);
          return undefined;
        }
        if (block.opcode === "looks_seteffectto") {
          const value = num("VALUE");
          if (value === undefined) return missing();
          const snapped = nearest(value, studioEffectValues(effect));
          return { type: "setEffect", effect, value: this.adjust(snapped, value) };
        }
        const change = num("CHANGE");
        if (change === undefined) return missing();
        return {
          type: "changeEffect",
          effect,
          delta: this.adjust(nearest(change, STUDIO_EFFECT_DELTAS), change),
        };
      }
      case "looks_cleargraphiceffects":
        return { type: "clearEffects" };
      case "sound_setvolumeto": {
        const volume = num("VOLUME");
        if (volume === undefined) return missing();
        const clamped = Math.max(
          STUDIO_VOLUME_RANGE.min,
          Math.min(STUDIO_VOLUME_RANGE.max, volume),
        );
        return { type: "setVolume", volume: this.adjust(Math.round(clamped), volume) };
      }
      case "sound_changevolumeby": {
        const delta = num("VOLUME");
        if (delta === undefined) return missing();
        const clamped = Math.max(
          STUDIO_VOLUME_DELTA_RANGE.min,
          Math.min(STUDIO_VOLUME_DELTA_RANGE.max, delta),
        );
        return { type: "changeVolume", delta: this.adjust(Math.round(clamped), delta) };
      }
      case "music_playNoteForBeats": {
        const note = num("NOTE");
        const beats = num("BEATS");
        if (note === undefined || beats === undefined) return missing();
        this.usesMusic = true;
        return {
          type: "playNote",
          note: this.adjust(nearest(note, STUDIO_NOTES), note),
          beats: this.adjust(nearest(beats, MUSIC_BEATS), beats),
        };
      }
      case "music_playDrumForBeats": {
        const beats = num("BEATS");
        if (beats === undefined) return missing();
        const drum = DRUM_OF_SCRATCH[this.menu(block, "DRUM") ?? ""];
        this.usesMusic = true;
        if (drum === undefined) this.adjusted += 1;
        return {
          type: "playDrum",
          drum: drum ?? "snare",
          beats: this.adjust(nearest(beats, MUSIC_BEATS), beats),
        };
      }
      case "music_setTempo": {
        const tempo = num("TEMPO");
        if (tempo === undefined) return missing();
        this.usesMusic = true;
        return { type: "setTempo", bpm: this.adjust(nearest(tempo, STUDIO_TEMPOS), tempo) };
      }
      case "music_setInstrument": {
        const instrument = INSTRUMENT_OF_SCRATCH[this.menu(block, "INSTRUMENT") ?? ""];
        this.usesMusic = true;
        this.adjusted += 1;
        return { type: "setInstrument", instrument: instrument ?? "piano" };
      }
      case "sensing_resettimer":
        return { type: "resetTimer" };
      case "pen_clear":
        this.usesPen = true;
        return { type: "clearPen" };
      case "pen_stamp":
        this.usesPen = true;
        return { type: "stamp" };
      case "data_addtolist":
      case "data_showlist":
      case "data_hidelist":
      case "data_insertatlist":
      case "data_replaceitemoflist":
      case "data_deleteoflist": {
        const listId = this.listOf(block);
        if (listId === undefined) {
          this.drop(`${block.opcode} (a list the scene did not keep)`);
          return undefined;
        }
        if (block.opcode === "data_showlist" || block.opcode === "data_hidelist")
          return { type: block.opcode === "data_showlist" ? "showList" : "hideList", listId };
        if (
          block.opcode === "data_deleteoflist" &&
          this.literal(block, "INDEX")?.toLowerCase() === "all"
        )
          return { type: "listClear", listId };
        if (block.opcode === "data_addtolist") {
          const value = this.listValue(block, "ITEM");
          if (value === undefined) {
            this.drop("data_addtolist (an item the scene cannot hold)");
            return undefined;
          }
          return { type: "listAdd", listId, value };
        }
        const index = this.listPosition(block, "INDEX");
        if (index === undefined) {
          this.drop(`${block.opcode} (a position the scene cannot use)`);
          return undefined;
        }
        if (block.opcode === "data_deleteoflist") return { type: "listRemoveAt", listId, index };
        const value = this.listValue(block, "ITEM");
        if (value === undefined) {
          this.drop(`${block.opcode} (an item the scene cannot hold)`);
          return undefined;
        }
        return block.opcode === "data_insertatlist"
          ? { type: "listInsertAt", listId, index, value }
          : { type: "listReplaceAt", listId, index, value };
      }
      case "data_setvariableto":
      case "data_changevariableby": {
        const name = block.fields["VARIABLE"]?.[0];
        const textId = typeof name === "string" ? this.textIds.get(name) : undefined;
        if (textId !== undefined) {
          const word =
            block.opcode === "data_setvariableto" ? this.wordExpression(block, "VALUE") : undefined;
          if (word === undefined) {
            this.drop(`${block.opcode} (a word variable set to anything but a short word)`);
            return undefined;
          }
          return { type: "setText", variableId: textId, value: word };
        }
        const id = typeof name === "string" ? this.variableIds.get(name) : undefined;
        if (id === undefined) {
          this.drop(`${block.opcode} (more than three variables, or an unsupported name)`);
          return undefined;
        }
        const value = this.numberExpression(block, "VALUE");
        if (value === undefined) {
          this.drop(`${block.opcode} (a value the scene cannot compute)`);
          return undefined;
        }
        return block.opcode === "data_setvariableto"
          ? { type: "setVariable", variableId: id, value }
          : { type: "changeVariable", variableId: id, delta: value };
      }
      default:
        this.drop(block.opcode);
        return undefined;
    }
  }

  /** The scene's list a Scratch list field names; undefined when it was not kept. */
  listOf(block: ScratchBlock): string | undefined {
    const name = block.fields["LIST"]?.[0];
    return typeof name === "string" ? this.listIds.get(name) : undefined;
  }

  /** A position the scene's list blocks take: a whole number from 1 to 10. */
  listPosition(block: ScratchBlock, name: string): Expression | undefined {
    const value = this.number(block, name);
    return value !== undefined && Number.isInteger(value) && value >= 1 && value <= 10
      ? { type: "numericLiteral", value }
      : undefined;
  }

  /**
   * What goes into a list, as Scratch lists are mixed: a number or a short word typed in, a number
   * or word variable, or an item of a list. Anything else is left behind.
   */
  listValue(block: ScratchBlock, name: string): Expression | undefined {
    const shadow = block.inputs[name]?.[1];
    if (this.hasLossyTextLiteral(block, name)) {
      const literal = this.literal(block, name)!;
      return literal.length <= STUDIO_WORD_MAX_LENGTH && !/\p{Cc}/u.test(literal)
        ? { type: "textLiteral", value: literal }
        : undefined;
    }
    if (Array.isArray(shadow) && (shadow as unknown as Primitive)[0] === 12) {
      const variable = (shadow as unknown as Primitive)[1];
      if (typeof variable !== "string") return undefined;
      const text = this.textIds.get(variable);
      return text === undefined
        ? this.variable(variable)
        : { type: "textVariable", variableId: text };
    }
    if (typeof shadow === "string") {
      const inner = this.blocks.get(shadow);
      if (inner?.opcode === "data_variable") {
        const variable = inner.fields["VARIABLE"]?.[0];
        if (typeof variable !== "string") return undefined;
        const text = this.textIds.get(variable);
        return text === undefined
          ? this.variable(variable)
          : { type: "textVariable", variableId: text };
      }
      return inner === undefined ? undefined : this.reporter(inner);
    }
    const typed = this.literal(block, name);
    if (typed === undefined) return undefined;
    const asNumber = Number(typed);
    if (typed.trim() !== "" && Number.isFinite(asNumber))
      return {
        type: "numericLiteral",
        value: this.adjust(Math.max(-100, Math.min(100, Math.round(asNumber * 10) / 10)), asNumber),
      };
    return wordOf(typed);
  }

  /** A short word the scene can keep: a text of at most 20 letters, or another word variable. */
  wordExpression(block: ScratchBlock, name: string): Expression | undefined {
    const reference = block.inputs[name]?.[1];
    if (Array.isArray(reference) && (reference as unknown as Primitive)[0] === 12) {
      const variable = (reference as unknown as Primitive)[1];
      const id = typeof variable === "string" ? this.textIds.get(variable) : undefined;
      return id === undefined ? undefined : { type: "textVariable", variableId: id };
    }
    if (typeof reference === "string") {
      const inner = this.blocks.get(reference);
      if (inner?.opcode === "data_variable") {
        const variable = inner.fields["VARIABLE"]?.[0];
        const id = typeof variable === "string" ? this.textIds.get(variable) : undefined;
        return id === undefined ? undefined : { type: "textVariable", variableId: id };
      }
      if (
        inner?.opcode === "data_itemoflist" ||
        inner?.opcode === "sensing_of" ||
        inner?.opcode === "operator_letter_of" ||
        inner?.opcode === "operator_join" ||
        (inner?.opcode === "looks_costumenumbername" &&
          inner.fields["NUMBER_NAME"]?.[0] === "name") ||
        (inner?.opcode === "looks_backdropnumbername" &&
          inner.fields["NUMBER_NAME"]?.[0] === "name")
      )
        return this.reporter(inner);
      return undefined;
    }
    const value = this.literal(block, name);
    return value === undefined ? undefined : wordOf(value);
  }

  /** A single bounded Scratch word source for letter/length, without nested text operators. */
  boundedTextSource(block: ScratchBlock, name: string): Expression | undefined {
    const value = this.wordExpression(block, name);
    if (
      value?.type === "textLiteral" ||
      value?.type === "textVariable" ||
      value?.type === "listItem"
    )
      return value;
    if (value?.type === "actorProperty") {
      if (value.property === "costumeName" || value.property === "backdropName") return value;
      if (
        value.property === "variable" &&
        [...this.textIds.values()].includes(value.variableId ?? "")
      )
        return value;
    }
    return undefined;
  }

  /** Keep type-10 text when number conversion would change its visible characters. */
  hasLossyTextLiteral(block: ScratchBlock, name: string): boolean {
    const reference = block.inputs[name]?.[1];
    const literal = this.literal(block, name);
    if (
      !Array.isArray(reference) ||
      (reference as unknown as Primitive)[0] !== 10 ||
      literal === undefined
    )
      return false;
    if (literal !== literal.trim()) return true;
    const number = Number(literal);
    const bounded = Math.max(-100, Math.min(100, Math.round(number * 10) / 10));
    return literal !== "" && Number.isFinite(number) && String(bounded) !== literal;
  }

  /** One short word or a bounded number; no nested reporters in Scratch's string slots. */
  boundedStringSource(block: ScratchBlock, name: string): Expression | undefined {
    const reference = block.inputs[name]?.[1];
    if (this.hasLossyTextLiteral(block, name)) {
      const literal = this.literal(block, name)!;
      return literal.length <= STUDIO_WORD_MAX_LENGTH && !/\p{Cc}/u.test(literal)
        ? { type: "textLiteral", value: literal }
        : undefined;
    }
    if (
      typeof reference !== "string" ||
      this.blocks.get(reference)?.opcode === "data_variable" ||
      this.blocks.get(reference)?.opcode === "data_lengthoflist" ||
      this.blocks.get(reference)?.opcode === "data_itemnumoflist" ||
      this.blocks.get(reference)?.opcode === "sensing_of" ||
      this.blocks.get(reference)?.opcode === "looks_costumenumbername" ||
      this.blocks.get(reference)?.opcode === "looks_backdropnumbername"
    ) {
      const number = this.numberExpression(block, name);
      if (
        number?.type === "numericLiteral" ||
        number?.type === "variable" ||
        number?.type === "listLength" ||
        number?.type === "listIndexOf" ||
        number?.type === "costumeNumber" ||
        number?.type === "backdropNumber"
      )
        return number;
      if (
        number?.type === "actorProperty" &&
        ([
          "xPosition",
          "yPosition",
          "direction",
          "size",
          "costumeNumber",
          "backdropNumber",
          "volume",
        ].includes(number.property) ||
          (number.property === "variable" &&
            [...this.variableIds.values()].includes(number.variableId ?? "")))
      )
        return number;
    }
    return this.boundedTextSource(block, name);
  }

  /** A letter or length of a simple source fits inside one join; nested joins exceed depth. */
  boundedJoinOperand(block: ScratchBlock, name: string): Expression | undefined {
    const reference = block.inputs[name]?.[1];
    const inner = typeof reference === "string" ? this.blocks.get(reference) : undefined;
    if (inner?.opcode !== "operator_letter_of" && inner?.opcode !== "operator_length")
      return this.boundedStringSource(block, name);
    const value = this.reporter(inner);
    return (value?.type === "letterOf" || value?.type === "textLength") &&
      value.value.type !== "join"
      ? value
      : undefined;
  }

  /** One bounded join may feed a text reporter; its own operands must stay unnested. */
  boundedStringOrJoinSource(block: ScratchBlock, name: string): Expression | undefined {
    const reference = block.inputs[name]?.[1];
    const inner = typeof reference === "string" ? this.blocks.get(reference) : undefined;
    return inner?.opcode === "operator_join"
      ? this.reporter(inner)
      : this.boundedStringSource(block, name);
  }

  /** Bounded text reporters may feed either side of contains or word equality. */
  boundedTextConditionSource(block: ScratchBlock, name: string): Expression | undefined {
    const reference = block.inputs[name]?.[1];
    const inner = typeof reference === "string" ? this.blocks.get(reference) : undefined;
    return inner?.opcode === "operator_letter_of" || inner?.opcode === "operator_length"
      ? this.reporter(inner)
      : this.boundedStringOrJoinSource(block, name);
  }

  /** Scratch's `join` in a bubble: fixed text and one bounded number or word after it. */
  joinedMessage(
    block: ScratchBlock,
  ): { readonly text: string; readonly append?: Expression } | undefined {
    const reference = block.inputs["MESSAGE"]?.[1];
    const join = typeof reference === "string" ? this.blocks.get(reference) : undefined;
    if (join?.opcode !== "operator_join") return undefined;
    const text = this.literal(join, "STRING1");
    if (text === undefined) return undefined;
    const append = this.hasLossyTextLiteral(join, "STRING2")
      ? this.boundedStringSource(join, "STRING2")
      : this.listValue(join, "STRING2");
    if (
      append === undefined ||
      ((append.type === "letterOf" || append.type === "textLength") && append.value.type === "join")
    ) {
      this.drop("join (a second value the scene cannot use)");
      return undefined;
    }
    if (text.length > STUDIO_WORD_MAX_LENGTH || /\p{Cc}/u.test(text)) {
      this.drop("join (a fixed word the scene cannot use)");
      return undefined;
    }
    const prefix: Expression = { type: "textLiteral", value: text };
    return { text: "", append: { type: "join", left: prefix, right: append } };
  }

  broadcastName(block: ScratchBlock): string | undefined {
    const shadow = block.inputs["BROADCAST_INPUT"]?.[1];
    if (Array.isArray(shadow) && typeof shadow[1] === "string") return shadow[1];
    const reference = block.inputs["BROADCAST_INPUT"]?.[1];
    if (typeof reference === "string") {
      const menu = this.blocks.get(reference);
      const value = menu === undefined ? undefined : Object.values(menu.fields)[0]?.[0];
      if (typeof value === "string") return value;
    }
    return undefined;
  }

  messageFor(name: string): string | undefined {
    const known = this.messages.get(name);
    if (known !== undefined) return known;
    const preset = MESSAGES[this.messages.size];
    if (preset === undefined) return undefined;
    this.messages.set(name, preset);
    return preset;
  }

  trigger(hat: ScratchBlock): Trigger | undefined {
    switch (hat.opcode) {
      case "event_whenflagclicked":
        return { type: "greenFlag" };
      case "event_whenthisspriteclicked":
        return { type: "onActorClicked" };
      case "event_whenkeypressed": {
        const key = (this.menu(hat, "KEY_OPTION") ?? "").toLowerCase();
        const mapped = KEYS[key];
        return mapped === undefined ? undefined : { type: "onKeyPressed", key: mapped };
      }
      case "event_whengreaterthan": {
        const menu = String(hat.fields["WHENGREATERTHANMENU"]?.[0] ?? "").toUpperCase();
        const value = this.number(hat, "VALUE");
        if (value === undefined) return undefined;
        this.adjusted += 1;
        if (menu === "TIMER")
          return { type: "onTimerOver", seconds: nearest(value, [1, 2, 3, 5] as const) };
        if (menu === "LOUDNESS")
          return { type: "onLoudnessOver", level: nearest(value, [10, 30, 50, 70] as const) };
        return undefined;
      }
      case "event_whenbroadcastreceived": {
        const name = hat.fields["BROADCAST_OPTION"]?.[0];
        const message = typeof name === "string" ? this.messageFor(name) : undefined;
        return message === undefined ? undefined : { type: "onMessage", message };
      }
      default:
        return undefined;
    }
  }
}

const CLONE_HAT = "control_start_as_clone";

const HAT_ORDER = [
  "event_whenflagclicked",
  "event_whenkeypressed",
  "event_whenthisspriteclicked",
  "event_whenbroadcastreceived",
  "event_whengreaterthan",
];

/** Keeps the statements the scene accepts, one at a time, so one bad block never sinks a script. */
function legalize(
  script: Script,
  baseline: ProjectProgram,
  position: number,
  converter: Converter,
): Script {
  const kept: Statement[] = [];
  for (const statement of script.statements) {
    const candidate: ProjectProgram = {
      ...baseline,
      scripts: baseline.scripts.map((item, index) =>
        index === position ? { ...script, statements: [...kept, statement] } : item,
      ),
    };
    try {
      validateStudioProgram(candidate);
      kept.push(statement);
    } catch {
      converter.drop(`${statement.type} (outside the Kids scene's limits)`);
    }
  }
  return { ...script, statements: kept };
}

export function convertScratchProject(raw: unknown): ScratchImportResult {
  if (!isRecord(raw) || !Array.isArray(raw["targets"]))
    throw new RangeError("not a Scratch 3 project");
  const targets = raw["targets"].filter(isRecord);
  const stage = targets.find((target) => target["isStage"] === true);
  const sprites = targets.filter((target) => target["isStage"] !== true);
  if (sprites.length === 0) throw new RangeError("the project has no sprites");

  const converter = new Converter();
  const used = sprites.slice(0, MAX_SPRITES);
  used.forEach((sprite, index) => {
    const character = KIDS_GALLERY_CHARACTERS[index % KIDS_GALLERY_CHARACTERS.length]!;
    if (typeof sprite["name"] === "string")
      converter.spriteActorIds.set(sprite["name"], studioActorId(index + 1, character.id));
  });

  // Up to three variables, from the stage first, then the sprites.
  const names: { name: string; scope?: "stage"; initialValue: number }[] = [];
  const words: { name: string; scope?: "stage"; initialValue: string }[] = [];
  // A variable holds words when it starts as a word or the project sets it to a word.
  const setToWord = new Set<string>();
  for (const target of [stage, ...sprites]) {
    const rawBlocks = isRecord(target?.["blocks"]) ? target["blocks"] : {};
    for (const raw of Object.values(rawBlocks)) {
      const block = parseBlock(raw);
      if (block?.opcode !== "data_setvariableto") continue;
      const variable = block.fields["VARIABLE"]?.[0];
      const input = block.inputs["VALUE"]?.[1];
      const value = Array.isArray(input) ? (input as unknown as Primitive)[1] : undefined;
      if (typeof variable === "string" && isWord(value)) setToWord.add(variable);
      if (typeof variable === "string" && typeof input === "string") {
        const reporter = parseBlock(rawBlocks[input]);
        if (
          reporter?.opcode === "sensing_of" &&
          (reporter.fields["PROPERTY"]?.[0] === "costume name" ||
            reporter.fields["PROPERTY"]?.[0] === "backdrop name")
        )
          setToWord.add(variable);
        if (
          reporter?.opcode === "looks_costumenumbername" &&
          reporter.fields["NUMBER_NAME"]?.[0] === "name"
        )
          setToWord.add(variable);
        if (
          reporter?.opcode === "looks_backdropnumbername" &&
          reporter.fields["NUMBER_NAME"]?.[0] === "name"
        )
          setToWord.add(variable);
      }
    }
  }
  for (const [targetIndex, target] of [stage, ...sprites].entries()) {
    const variables = isRecord(target?.["variables"]) ? target["variables"] : {};
    for (const [scratchId, entry] of Object.entries(variables)) {
      const name = Array.isArray(entry) ? entry[0] : undefined;
      if (typeof name !== "string" || !DATA_NAME.test(name)) continue;
      if (names.some((item) => item.name === name) || words.some((word) => word.name === name))
        continue;
      const initial: unknown = Array.isArray(entry) ? entry[1] : undefined;
      if (isWord(initial) || setToWord.has(name) || /(?:^|:)studio-text-\d+$/.test(scratchId))
        words.push({
          name,
          ...(targetIndex === 0 && stage !== undefined ? { scope: "stage" as const } : {}),
          initialValue:
            targetIndex === 0 && typeof initial === "string"
              ? converter.adjust(initial.slice(0, STUDIO_WORD_MAX_LENGTH), initial)
              : "",
        });
      else
        names.push({
          name,
          ...(targetIndex === 0 && stage !== undefined ? { scope: "stage" as const } : {}),
          initialValue:
            targetIndex === 0 && stage !== undefined && Number.isFinite(Number(initial))
              ? converter.adjust(
                  Math.round(Math.max(-100, Math.min(100, Number(initial)))),
                  initial,
                )
              : 0,
        });
    }
  }
  names
    .slice(0, 3)
    .forEach((item, index) => converter.variableIds.set(item.name, `studio-var-${index + 1}`));
  for (const item of names.slice(3)) converter.drop(`variable "${item.name}" (more than three)`);
  words
    .slice(0, 3)
    .forEach((word, index) => converter.textIds.set(word.name, `studio-text-${index + 1}`));
  for (const word of words.slice(3))
    converter.drop(`word variable "${word.name}" (more than three)`);

  // Up to three lists, from the stage first. Stage lists keep bounded starting items.
  const listDeclarations: { name: string; scope?: "stage"; initialItems: (number | string)[] }[] =
    [];
  for (const [targetIndex, target] of [stage, ...sprites].entries()) {
    const declared = isRecord(target?.["lists"]) ? target["lists"] : {};
    for (const entry of Object.values(declared)) {
      const name = Array.isArray(entry) ? entry[0] : undefined;
      if (
        typeof name !== "string" ||
        !DATA_NAME.test(name) ||
        listDeclarations.some((item) => item.name === name)
      )
        continue;
      if (listDeclarations.length < 3) {
        converter.listIds.set(name, `studio-list-${listDeclarations.length + 1}`);
        const items: unknown = Array.isArray(entry) ? entry[1] : undefined;
        const initialItems: (number | string)[] = [];
        if (Array.isArray(items) && items.length > 0) {
          if (targetIndex !== 0)
            converter.drop(`list "${name}" (local starting items are not supported)`);
          else {
            for (const item of items.slice(0, 10)) {
              if (typeof item === "number" && Number.isFinite(item))
                initialItems.push(
                  converter.adjust(Math.round(Math.max(-100, Math.min(100, item)) * 10) / 10, item),
                );
              else if (typeof item === "string")
                initialItems.push(
                  converter.adjust(
                    item.replace(/\p{Cc}/gu, "").slice(0, STUDIO_WORD_MAX_LENGTH),
                    item,
                  ),
                );
              else converter.drop(`list "${name}" (invalid starting item)`);
            }
            if (items.length > 10) converter.drop(`list "${name}" (more than ten starting items)`);
          }
        }
        listDeclarations.push({
          name,
          ...(targetIndex === 0 && stage !== undefined ? { scope: "stage" as const } : {}),
          initialItems,
        });
      } else converter.drop(`list "${name}" (more than three)`);
    }
  }

  const scripts: Script[] = [];
  const cloneScripts: Script[] = [];
  const extraScripts: Script[] = [];
  const positions: Record<string, { x: number; y: number; direction: number; size: number }> = {};
  const baseline: ProjectProgram = {
    schema: SCHEMA_VERSION,
    scripts: [],
  };
  used.forEach((sprite, index) => {
    const character = KIDS_GALLERY_CHARACTERS[index % KIDS_GALLERY_CHARACTERS.length]!;
    converter.currentActorId = studioActorId(index + 1, character.id);
    const blocks = new Map<string, ScratchBlock>();
    const rawBlocks = isRecord(sprite["blocks"]) ? sprite["blocks"] : {};
    for (const [id, value] of Object.entries(rawBlocks)) {
      const block = parseBlock(value);
      if (block !== undefined) blocks.set(id, block);
    }
    converter.blocks = blocks;
    const cloneHat = [...blocks.values()].find(
      (block) => block.topLevel && block.opcode === CLONE_HAT,
    );
    converter.spriteHasCloneHat = cloneHat !== undefined;
    converter.inCloneScript = false;
    const supported = [...blocks.entries()]
      .filter(([, block]) => block.topLevel && HAT_ORDER.includes(block.opcode))
      .sort((a, b) => HAT_ORDER.indexOf(a[1].opcode) - HAT_ORDER.indexOf(b[1].opcode));
    let trigger: Trigger = { type: "greenFlag" };
    let statements: Statement[] = [];
    let imported = 0;
    // The character keeps up to three scripts, each with its own event (#1363); a second script
    // for an event it already answers, or a fourth, is left behind and counted below.
    const kept: { trigger: Trigger; statements: Statement[] }[] = [];
    const answered = new Set<string>();
    for (const [, hat] of supported) {
      if (kept.length >= 1 + MAX_STUDIO_EXTRA_SCRIPTS) break;
      const found = converter.trigger(hat);
      if (found === undefined || answered.has(JSON.stringify(found))) continue;
      answered.add(JSON.stringify(found));
      kept.push({ trigger: found, statements: converter.stack(hat.next) });
    }
    if (kept[0] !== undefined) {
      trigger = kept[0].trigger;
      statements = kept[0].statements;
    }
    imported = kept.length;
    kept.slice(1).forEach((extra, at) => {
      extraScripts.push({
        id: extraScriptId(index + 1, character.id, (at + 2) as 2 | 3),
        trigger: extra.trigger,
        statements: extra.statements,
      });
    });
    // A character may also have the script its copies start with: the first clone hat's stack.
    if (cloneHat !== undefined) {
      converter.inCloneScript = true;
      cloneScripts.push({
        id: cloneScriptId(index + 1, character.id),
        trigger: { type: "onCloneStart" },
        statements: converter.stack(cloneHat.next),
      });
      converter.inCloneScript = false;
      imported += 1;
    }
    // The scene gives each character up to three scripts (and a copy script); the rest is left behind.
    const stacks = [...blocks.values()].filter((block) => block.topLevel).length;
    for (let i = 0; i < stacks - imported; i += 1) converter.drop("another script of the sprite");
    const id = `studio-actor-${index + 1}-${character.id}`;
    scripts.push({ id, trigger, statements });
    const x = typeof sprite["x"] === "number" ? sprite["x"] : 0;
    const y = typeof sprite["y"] === "number" ? sprite["y"] : 0;
    const direction = typeof sprite["direction"] === "number" ? sprite["direction"] : 90;
    const size = typeof sprite["size"] === "number" ? sprite["size"] : 100;
    positions[studioActorId(index + 1, character.id)] = {
      x: converter.stageX(x),
      y: converter.stageY(y),
      direction: Math.round((((direction - 90 + 540) % 360) + 360) % 360) - 180 || 0,
      size: Math.max(10, Math.min(400, Math.round(size))),
    };
  });
  for (let i = MAX_SPRITES; i < sprites.length; i += 1) converter.drop("sprite (more than twelve)");

  const variables = names.slice(0, 3).map((item, index) => ({
    id: `studio-var-${index + 1}`,
    name: item.name,
    initialValue: item.initialValue,
    visible: true,
    ...(item.scope === "stage" ? { scope: "stage" as const } : {}),
  }));
  const textVariables = words.slice(0, 3).map((word, index) => ({
    id: `studio-text-${index + 1}`,
    name: word.name,
    initialValue: word.initialValue,
    visible: true,
    ...(word.scope === "stage" ? { scope: "stage" as const } : {}),
  }));
  const lists = [...converter.listIds.values()].map((id, index) => ({
    id,
    name: listDeclarations[index]!.name,
    initialItems: listDeclarations[index]!.initialItems,
    visible: true,
    ...(listDeclarations[index]!.scope === "stage" ? { scope: "stage" as const } : {}),
  }));
  const withData: ProjectProgram = {
    ...baseline,
    ...(variables.length > 0 ? { variables } : {}),
    ...(textVariables.length > 0 ? { textVariables } : {}),
    ...(lists.length > 0 ? { lists } : {}),
    scripts: [...scripts, ...cloneScripts, ...extraScripts].map((script) => ({
      ...script,
      statements: [],
    })),
  };
  const extensions = [
    ...(converter.usesPen ? ["pen"] : []),
    ...(converter.usesMusic ? ["music"] : []),
  ];
  const draft: ProjectProgram =
    extensions.length > 0 ? { ...withData, extensions: extensions as ExtensionId[] } : withData;
  const legal = [...scripts, ...cloneScripts, ...extraScripts].map((script, position) =>
    legalize(script, draft, position, converter),
  );
  const program = validateStudioProgram({ ...draft, scripts: legal });
  const kept = legal.reduce((sum, script) => sum + script.statements.length, 0);

  const dropped = [...converter.dropped.entries()]
    .map(([what, count]) => ({ what, count }))
    .sort((a, b) => b.count - a.count || a.what.localeCompare(b.what));
  return {
    program,
    backdropId: "forest",
    positions,
    report: {
      sprites: used.length,
      spritesSkipped: Math.max(0, sprites.length - MAX_SPRITES),
      blocksImported: kept,
      blocksAdjusted: converter.adjusted,
      dropped,
    },
  };
}
