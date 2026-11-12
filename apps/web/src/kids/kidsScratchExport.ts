import {
  STAGE_ACTOR_ID,
  type Expression,
  MathFunction,
  ProjectAsset,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "@agorix/program-model";
import {
  KIDS_GALLERY_BACKDROPS,
  KIDS_GALLERY_CHARACTERS,
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
} from "./kidsGallery.js";
import type { Locale } from "../i18n.js";
import { md5Hex, zipStored, type PackedFile } from "./kidsScratchPack.js";
import {
  actorOfScript,
  cloneActorOfScript,
  creativeForStudio,
  type StudioArt,
  extraActorOfScript,
  studioActorId,
  validateStudioProgram,
} from "./kidsStudioModel.js";

/**
 * Writes a Kids free scene as a Scratch 3 project (`.sb3`), the way back out of the product: the
 * canonical program is read, never changed, and every block is a plain opcode. Scratch holds less
 * in some places (the scene's own sounds, prompts, copy rules, backdrop hats) and more in others,
 * so what cannot be written is counted in the report instead of being guessed. The pictures are
 * stand-ins drawn from the character's glyph and colour: a scene's own drawings are not exported yet.
 */
export interface ScratchExportReport {
  readonly sprites: number;
  readonly blocksExported: number;
  /** Blocks written with a value the scene had to approximate (a copy rule, a unit). */
  readonly blocksAdjusted: number;
  /** What could not be written, by kind, most frequent first. */
  readonly left: readonly { readonly what: string; readonly count: number }[];
}

export interface ScratchExport {
  readonly bytes: Uint8Array;
  readonly report: ScratchExportReport;
}

type Json = Record<string, unknown>;

/** A picture of the child's, as a PNG a Scratch project can hold. */
export interface ScratchPicture {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** The child's own pictures and recordings, with the PNG of each picture already made. */
export interface ScratchExportArt extends StudioArt {
  readonly pictures?: ReadonlyMap<string, ScratchPicture>;
}

interface Names {
  readonly variable: (id: string) => string | undefined;
  readonly variableId: (id: string) => string;
  readonly list: (id: string) => string | undefined;
  readonly listId: (id: string) => string;
  readonly sprite: (actorId: string) => string | undefined;
  readonly costume: (id: string) => string | undefined;
  readonly backdrop: (id: string) => string | undefined;
  readonly sound: (id: string) => string | undefined;
  readonly broadcast: (message: string) => string;
}

const scratchMathName = (name: MathFunction): string =>
  name === "exp" ? "e ^" : name === "pow10" ? "10 ^" : name;

const KEY_NAME: Readonly<Record<string, string>> = {
  Space: "space",
  ArrowUp: "up arrow",
  ArrowDown: "down arrow",
  ArrowLeft: "left arrow",
  ArrowRight: "right arrow",
  Enter: "enter",
  // Letters and digits are written the same in Scratch and here.
  ...Object.fromEntries(
    [..."abcdefghijklmnopqrstuvwxyz0123456789"].map((key) => [key, key] as const),
  ),
};
const PEN_HEX: Readonly<Record<string, string>> = {
  dark: "#252342",
  red: "#ef627d",
  orange: "#ffb14a",
  green: "#61b992",
  blue: "#548de4",
  purple: "#a17ad6",
};
const DRUM_NUMBER: Readonly<Record<string, string>> = {
  snare: "1",
  kick: "2",
  hat: "6",
  clap: "8",
};
const INSTRUMENT_NUMBER: Readonly<Record<string, string>> = {
  piano: "1",
  guitar: "4",
  flute: "12",
  bell: "16",
};
const SHADE_NUMBER = { lighter: 70, normal: 50, darker: 30 } as const;
const encoder = new TextEncoder();

/** The scene's stage (320 by about 220, y down) on Scratch's 480 by 360 stage, centred, y up. */
const scratchX = (x: number) => Math.round(((x - 160) * 3) / 2);
const scratchY = (y: number) => Math.round(((10 - y) * 180) / 110);
const scratchDirection = (degrees: number) => {
  const turned = (((degrees + 90) % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
};

class Counter {
  readonly left = new Map<string, number>();
  exported = 0;
  adjusted = 0;
  miss(what: string): void {
    this.left.set(what, (this.left.get(what) ?? 0) + 1);
  }
}

class Emitter {
  readonly blocks: Record<string, Json> = {};
  private next = 0;
  constructor(
    private readonly counter: Counter,
    private readonly names: Names,
  ) {}

  private variableName(id: string) {
    return this.names.variable(id);
  }
  private variableId(id: string) {
    return this.names.variableId(id);
  }
  private spriteName(id: string) {
    return this.names.sprite(id);
  }
  private broadcastId(message: string) {
    return this.names.broadcast(message);
  }

  private id(): string {
    this.next += 1;
    return `b${this.next}`;
  }

  private block(
    opcode: string,
    parent: string | null,
    parts: { inputs?: Json; fields?: Json; shadow?: boolean } = {},
  ): { id: string; block: Json } {
    const id = this.id();
    const block: Json = {
      opcode,
      next: null,
      parent,
      inputs: parts.inputs ?? {},
      fields: parts.fields ?? {},
      shadow: parts.shadow ?? false,
      topLevel: false,
    };
    this.blocks[id] = block;
    return { id, block };
  }

  private menu(parent: string, opcode: string, field: string, value: string): string {
    return this.block(opcode, parent, { fields: { [field]: [value, null] }, shadow: true }).id;
  }

  /** A number or word typed into a slot, or a reporter block; null when it cannot be written. */
  private value(expression: Expression, parent: string): unknown[] | null {
    switch (expression.type) {
      case "numericLiteral":
        return [1, [4, String(expression.value)]];
      case "textLiteral":
        return [1, [10, expression.value]];
      case "variable":
      case "textVariable": {
        const name = this.variableName(expression.variableId);
        return name === undefined
          ? null
          : [3, [12, name, this.variableId(expression.variableId)], [4, "0"]];
      }
      default: {
        const id = this.reporter(expression, parent);
        return id === null ? null : [3, id, [4, "0"]];
      }
    }
  }

  private binary(
    opcode: string,
    names: readonly [string, string],
    left: Expression,
    right: Expression,
    parent: string,
  ): string | null {
    const made = this.block(opcode, parent);
    const a = this.value(left, made.id);
    const b = this.value(right, made.id);
    if (a === null || b === null) return null;
    (made.block["inputs"] as Json)[names[0]] = a;
    (made.block["inputs"] as Json)[names[1]] = b;
    return made.id;
  }

  /** A true-or-false slot, [2, id]; null when it cannot be written. */
  private condition(expression: Expression, parent: string): unknown[] | null {
    const id = this.reporter(expression, parent);
    return id === null ? null : [2, id];
  }

  private reporter(expression: Expression, parent: string): string | null {
    const simple = (opcode: string, parts: { fields?: Json } = {}) =>
      this.block(opcode, parent, parts).id;
    switch (expression.type) {
      case "xPosition":
        return simple("motion_xposition");
      case "yPosition":
        return simple("motion_yposition");
      case "direction":
        return simple("motion_direction");
      case "sizePercent":
        return simple("looks_size");
      case "timer":
        return simple("sensing_timer");
      case "loudness":
        return simple("sensing_loudness");
      case "touchingMouse": {
        const made = this.block("sensing_touchingobject", parent);
        (made.block["inputs"] as Json)["TOUCHINGOBJECTMENU"] = [
          1,
          this.menu(made.id, "sensing_touchingobjectmenu", "TOUCHINGOBJECTMENU", "_mouse_"),
        ];
        return made.id;
      }
      case "distanceToActor": {
        const name = this.spriteName(expression.actorId);
        if (name === undefined) return null;
        const made = this.block("sensing_distanceto", parent);
        (made.block["inputs"] as Json)["DISTANCETOMENU"] = [
          1,
          this.menu(made.id, "sensing_distancetomenu", "DISTANCETOMENU", name),
        ];
        return made.id;
      }
      case "actorProperty": {
        const name =
          expression.actorId === STAGE_ACTOR_ID ? "_stage_" : this.spriteName(expression.actorId);
        if (name === undefined) return null;
        const property =
          expression.property === "variable"
            ? this.variableName(expression.variableId ?? "")
            : (
                {
                  xPosition: "x position",
                  yPosition: "y position",
                  direction: "direction",
                  size: "size",
                  costumeNumber: "costume #",
                  costumeName: "costume name",
                  volume: "volume",
                  backdropNumber: "backdrop #",
                  backdropName: "backdrop name",
                } as const
              )[expression.property];
        if (property === undefined) return null;
        const made = this.block("sensing_of", parent, {
          fields: { PROPERTY: [property, null] },
        });
        (made.block["inputs"] as Json)["OBJECT"] = [
          1,
          this.menu(made.id, "sensing_of_object_menu", "OBJECT", name),
        ];
        return made.id;
      }
      case "distanceToMouse": {
        const made = this.block("sensing_distanceto", parent);
        (made.block["inputs"] as Json)["DISTANCETOMENU"] = [
          1,
          this.menu(made.id, "sensing_distancetomenu", "DISTANCETOMENU", "_mouse_"),
        ];
        return made.id;
      }
      case "mouseX":
        return simple("sensing_mousex");
      case "mouseY":
        return simple("sensing_mousey");
      case "mouseDown":
        return simple("sensing_mousedown");
      case "costumeNumber":
        return simple("looks_costumenumbername", { fields: { NUMBER_NAME: ["number", null] } });
      case "backdropNumber":
        return simple("looks_backdropnumbername", { fields: { NUMBER_NAME: ["number", null] } });
      case "listItem": {
        const name = this.names.list(expression.listId);
        if (name === undefined) return null;
        const made = this.block("data_itemoflist", parent, {
          fields: { LIST: [name, this.names.listId(expression.listId)] },
        });
        const index = this.value(expression.index, made.id);
        if (index === null) return null;
        (made.block["inputs"] as Json)["INDEX"] = index;
        return made.id;
      }
      case "listLength": {
        const name = this.names.list(expression.listId);
        return name === undefined
          ? null
          : this.block("data_lengthoflist", parent, {
              fields: { LIST: [name, this.names.listId(expression.listId)] },
            }).id;
      }
      case "listContains":
      case "listIndexOf": {
        const name = this.names.list(expression.listId);
        if (name === undefined) return null;
        const made = this.block(
          expression.type === "listContains" ? "data_listcontainsitem" : "data_itemnumoflist",
          parent,
          { fields: { LIST: [name, this.names.listId(expression.listId)] } },
        );
        const item = this.value(expression.value, made.id);
        if (item === null) return null;
        (made.block["inputs"] as Json)["ITEM"] = item;
        return made.id;
      }
      case "currentTime":
        return simple("sensing_current", {
          fields: { CURRENTMENU: [expression.part.toUpperCase(), null] },
        });
      case "keyDown": {
        const key = KEY_NAME[expression.key];
        if (key === undefined) return null;
        const made = this.block("sensing_keypressed", parent);
        (made.block["inputs"] as Json)["KEY_OPTION"] = [
          1,
          this.menu(made.id, "sensing_keyoptions", "KEY_OPTION", key),
        ];
        return made.id;
      }
      case "touchingColor": {
        const made = this.block("sensing_touchingcolor", parent);
        (made.block["inputs"] as Json)["COLOR"] = [1, [9, PEN_HEX[expression.color] ?? "#000000"]];
        return made.id;
      }
      case "touchingActor": {
        const name = this.spriteName(expression.actorId);
        if (name === undefined) return null;
        const made = this.block("sensing_touchingobject", parent);
        (made.block["inputs"] as Json)["TOUCHINGOBJECTMENU"] = [
          1,
          this.menu(made.id, "sensing_touchingobjectmenu", "TOUCHINGOBJECTMENU", name),
        ];
        return made.id;
      }
      case "touchingStageEdge": {
        const made = this.block("sensing_touchingobject", parent);
        (made.block["inputs"] as Json)["TOUCHINGOBJECTMENU"] = [
          1,
          this.menu(made.id, "sensing_touchingobjectmenu", "TOUCHINGOBJECTMENU", "_edge_"),
        ];
        return made.id;
      }
      case "add":
        return this.binary(
          "operator_add",
          ["NUM1", "NUM2"],
          expression.left,
          expression.right,
          parent,
        );
      case "subtract":
        return this.binary(
          "operator_subtract",
          ["NUM1", "NUM2"],
          expression.left,
          expression.right,
          parent,
        );
      case "multiply":
        return this.binary(
          "operator_multiply",
          ["NUM1", "NUM2"],
          expression.left,
          expression.right,
          parent,
        );
      case "divide":
        return this.binary(
          "operator_divide",
          ["NUM1", "NUM2"],
          expression.left,
          expression.right,
          parent,
        );
      case "modulo":
        return this.binary(
          "operator_mod",
          ["NUM1", "NUM2"],
          expression.left,
          expression.right,
          parent,
        );
      case "mathFunction": {
        const rounds = expression.function === "round";
        const made = this.block(rounds ? "operator_round" : "operator_mathop", parent, {
          ...(rounds ? {} : { fields: { OPERATOR: [scratchMathName(expression.function), null] } }),
        });
        const operand = this.value(expression.value, made.id);
        if (operand === null) return null;
        (made.block["inputs"] as Json)["NUM"] = operand;
        return made.id;
      }
      case "randomInteger":
        return this.binary(
          "operator_random",
          ["FROM", "TO"],
          expression.min,
          expression.max,
          parent,
        );
      case "equals":
        return this.binary(
          "operator_equals",
          ["OPERAND1", "OPERAND2"],
          expression.left,
          expression.right,
          parent,
        );
      case "greaterThan":
        return this.binary(
          "operator_gt",
          ["OPERAND1", "OPERAND2"],
          expression.left,
          expression.right,
          parent,
        );
      case "lessThan":
        return this.binary(
          "operator_lt",
          ["OPERAND1", "OPERAND2"],
          expression.left,
          expression.right,
          parent,
        );
      case "and":
      case "or": {
        const made = this.block(expression.type === "and" ? "operator_and" : "operator_or", parent);
        const a = this.condition(expression.left, made.id);
        const b = this.condition(expression.right, made.id);
        if (a === null || b === null) return null;
        (made.block["inputs"] as Json)["OPERAND1"] = a;
        (made.block["inputs"] as Json)["OPERAND2"] = b;
        return made.id;
      }
      case "not": {
        const made = this.block("operator_not", parent);
        const operand = this.condition(expression.value, made.id);
        if (operand === null) return null;
        (made.block["inputs"] as Json)["OPERAND"] = operand;
        return made.id;
      }
      case "join":
        return this.binary(
          "operator_join",
          ["STRING1", "STRING2"],
          expression.left,
          expression.right,
          parent,
        );
      case "textLength": {
        const made = this.block("operator_length", parent);
        const value = this.value(expression.value, made.id);
        if (value === null) return null;
        (made.block["inputs"] as Json)["STRING"] = value;
        return made.id;
      }
      case "letterOf":
        return this.binary(
          "operator_letter_of",
          ["LETTER", "STRING"],
          expression.index,
          expression.value,
          parent,
        );
      default:
        this.counter.miss(expression.type);
        return null;
    }
  }

  /** A stack of statements; returns the first block's id. Statements Scratch cannot hold are left out. */
  stack(statements: readonly Statement[], parent: string | null): string | null {
    let first: string | null = null;
    let previous: string | null = null;
    for (const statement of statements) {
      const id = this.statement(statement, previous ?? parent);
      if (id === null) continue;
      if (first === null) first = id;
      else (this.blocks[previous!] as Json)["next"] = id;
      previous = id;
    }
    return first;
  }

  private loop(
    opcode: string,
    parent: string | null,
    body: readonly Statement[],
    inputs: (id: string) => Json | null,
  ): string | null {
    const made = this.block(opcode, parent);
    const extra = inputs(made.id);
    if (extra === null) return null;
    Object.assign(made.block["inputs"] as Json, extra);
    const first = this.stack(body, made.id);
    if (first !== null) (made.block["inputs"] as Json)["SUBSTACK"] = [2, first];
    return made.id;
  }

  private statement(statement: Statement, parent: string | null): string | null {
    const id = this.build(statement, parent);
    if (id === null) {
      this.counter.miss(statement.type);
      return null;
    }
    this.counter.exported += 1;
    return id;
  }

  /** One block with its inputs; null (and nothing kept) when a slot cannot be written. */
  private with(
    opcode: string,
    parent: string | null,
    slots: Record<string, Expression | number | string>,
    fields: Json = {},
  ): string | null {
    const made = this.block(opcode, parent, { fields });
    const inputs = made.block["inputs"] as Json;
    for (const [name, slot] of Object.entries(slots)) {
      if (typeof slot === "number") inputs[name] = [1, [4, String(slot)]];
      else if (typeof slot === "string") inputs[name] = [1, [10, slot]];
      else {
        const value = this.value(slot, made.id);
        if (value === null) return null;
        inputs[name] = value;
      }
    }
    return made.id;
  }

  private build(statement: Statement, parent: string | null): string | null {
    const num = (value: number) => value;
    switch (statement.type) {
      case "move":
        return this.with("motion_movesteps", parent, { STEPS: num((statement.steps * 3) / 2) });
      case "turn":
        return this.with(statement.degrees < 0 ? "motion_turnleft" : "motion_turnright", parent, {
          DEGREES: Math.abs(statement.degrees),
        });
      case "pointInDirection":
        return this.with("motion_pointindirection", parent, {
          DIRECTION: scratchDirection(statement.degrees),
        });
      case "goTo":
        return this.with("motion_gotoxy", parent, {
          X: scratchX(statement.x),
          Y: scratchY(statement.y),
        });
      case "glideTo":
        return this.with("motion_glidesecstoxy", parent, {
          SECS: statement.seconds,
          X: scratchX(statement.x),
          Y: scratchY(statement.y),
        });
      case "setX":
        return this.with("motion_setx", parent, { X: scratchX(statement.x) });
      case "setY":
        return this.with("motion_sety", parent, { Y: scratchY(statement.y) });
      case "changeX":
        return this.with("motion_changexby", parent, { DX: Math.round((statement.dx * 3) / 2) });
      case "changeY":
        return this.with("motion_changeyby", parent, {
          DY: Math.round((-statement.dy * 180) / 110),
        });
      case "bounceOnEdge":
        return this.with("motion_ifonedgebounce", parent, {});
      case "setRotationStyle":
        return this.with(
          "motion_setrotationstyle",
          parent,
          {},
          {
            STYLE: [
              statement.style === "leftRight"
                ? "left-right"
                : statement.style === "none"
                  ? "don't rotate"
                  : "all around",
              null,
            ],
          },
        );
      case "goToTarget": {
        const place =
          statement.target === "random"
            ? "_random_"
            : statement.target === "mouse"
              ? "_mouse_"
              : this.spriteName(statement.actorId ?? "");
        if (place === undefined) return null;
        const glide = statement.seconds !== undefined;
        const made = this.block(glide ? "motion_glideto" : "motion_goto", parent);
        const inputs = made.block["inputs"] as Json;
        if (glide) inputs["SECS"] = [1, [4, String(statement.seconds)]];
        inputs["TO"] = [
          1,
          this.menu(made.id, glide ? "motion_glideto_menu" : "motion_goto_menu", "TO", place),
        ];
        return made.id;
      }
      case "pointTowards": {
        const name = this.spriteName(statement.actorId);
        if (name === undefined) return null;
        const made = this.block("motion_pointtowards", parent);
        (made.block["inputs"] as Json)["TOWARDS"] = [
          1,
          this.menu(made.id, "motion_pointtowards_menu", "TOWARDS", name),
        ];
        return made.id;
      }
      case "say":
      case "think": {
        const base = statement.type === "say" ? "looks_say" : "looks_think";
        const opcode = statement.seconds === undefined ? base : `${base}forsecs`;
        const made = this.block(opcode, parent);
        const inputs = made.block["inputs"] as Json;
        if (statement.append === undefined) inputs["MESSAGE"] = [1, [10, statement.text]];
        else if (statement.text === "") {
          const value = this.value(statement.append, made.id);
          if (value === null) return null;
          inputs["MESSAGE"] = value;
        } else {
          const join = this.binary(
            "operator_join",
            ["STRING1", "STRING2"],
            { type: "textLiteral", value: statement.text },
            statement.append,
            made.id,
          );
          if (join === null) return null;
          inputs["MESSAGE"] = [3, join, [10, ""]];
        }
        if (statement.seconds !== undefined) inputs["SECS"] = [1, [4, String(statement.seconds)]];
        return made.id;
      }
      case "show":
        return this.with("looks_show", parent, {});
      case "hide":
        return this.with("looks_hide", parent, {});
      case "setSize":
        return this.with("looks_setsizeto", parent, { SIZE: statement.size });
      case "changeSize":
        return this.with("looks_changesizeby", parent, { CHANGE: statement.delta });
      case "goToLayer":
        if (statement.steps !== undefined)
          return this.with(
            "looks_goforwardbackwardlayers",
            parent,
            { NUM: statement.steps },
            { FORWARD_BACKWARD: [statement.layer, null] },
          );
        return this.with(
          "looks_gotofrontback",
          parent,
          {},
          { FRONT_BACK: [statement.layer, null] },
        );
      case "setEffect":
        return this.with(
          "looks_seteffectto",
          parent,
          { VALUE: statement.value },
          {
            EFFECT: [statement.effect.toUpperCase(), null],
          },
        );
      case "changeEffect":
        return this.with(
          "looks_changeeffectby",
          parent,
          { CHANGE: statement.delta },
          {
            EFFECT: [statement.effect.toUpperCase(), null],
          },
        );
      case "clearEffects":
        return this.with("looks_cleargraphiceffects", parent, {});
      case "nextCostume":
        return this.with("looks_nextcostume", parent, {});
      case "wait":
        return this.with("control_wait", parent, { DURATION: statement.seconds });
      case "repeat":
        return this.loop("control_repeat", parent, statement.body, () => ({
          TIMES: [1, [4, String(statement.count)]],
        }));
      case "forever":
        return this.loop("control_forever", parent, statement.body, () => ({}));
      case "repeatUntil":
        return this.loop("control_repeat_until", parent, statement.body, (id) => {
          const test = this.condition(statement.condition, id);
          return test === null ? null : { CONDITION: test };
        });
      case "waitUntil": {
        const made = this.block("control_wait_until", parent);
        const test = this.condition(statement.condition, made.id);
        if (test === null) return null;
        (made.block["inputs"] as Json)["CONDITION"] = test;
        return made.id;
      }
      case "if": {
        const made = this.block(
          statement.else === undefined ? "control_if" : "control_if_else",
          parent,
        );
        const inputs = made.block["inputs"] as Json;
        const test = this.condition(statement.condition, made.id);
        if (test === null) return null;
        inputs["CONDITION"] = test;
        const then = this.stack(statement.then, made.id);
        if (then !== null) inputs["SUBSTACK"] = [2, then];
        if (statement.else !== undefined) {
          const otherwise = this.stack(statement.else, made.id);
          if (otherwise !== null) inputs["SUBSTACK2"] = [2, otherwise];
        }
        return made.id;
      }
      case "stop":
        if (statement.scope === "actor") return null;
        return this.with(
          "control_stop",
          parent,
          {},
          {
            STOP_OPTION: [statement.scope === "scene" ? "all" : "this script", null],
          },
        );
      case "broadcast": {
        const made = this.block(
          statement.wait === true ? "event_broadcastandwait" : "event_broadcast",
          parent,
        );
        (made.block["inputs"] as Json)["BROADCAST_INPUT"] = [
          1,
          this.block("event_broadcast_menu", made.id, {
            fields: { BROADCAST_OPTION: [statement.message, this.broadcastId(statement.message)] },
            shadow: true,
          }).id,
        ];
        return made.id;
      }
      case "createCopies": {
        // The copy rule (spread, fall, follow) has no Scratch name: each copy is a plain clone.
        this.counter.adjusted += 1;
        const made = this.block("control_repeat", parent);
        const inputs = made.block["inputs"] as Json;
        inputs["TIMES"] = [1, [4, String(statement.count)]];
        const clone = this.block("control_create_clone_of", made.id);
        (clone.block["inputs"] as Json)["CLONE_OPTION"] = [
          1,
          this.menu(clone.id, "control_create_clone_of_menu", "CLONE_OPTION", "_myself_"),
        ];
        inputs["SUBSTACK"] = [2, clone.id];
        return made.id;
      }
      case "deleteThisClone":
        return this.with("control_delete_this_clone", parent, {});
      case "setVariable":
      case "setText":
      case "changeVariable": {
        const name = this.variableName(statement.variableId);
        if (name === undefined) return null;
        const slot = statement.type === "changeVariable" ? statement.delta : statement.value;
        return this.with(
          statement.type === "changeVariable" ? "data_changevariableby" : "data_setvariableto",
          parent,
          { VALUE: slot },
          { VARIABLE: [name, this.variableId(statement.variableId)] },
        );
      }
      case "showVariable":
      case "hideVariable": {
        const name = this.variableName(statement.variableId);
        if (name === undefined) return null;
        return this.with(
          statement.type === "showVariable" ? "data_showvariable" : "data_hidevariable",
          parent,
          {},
          { VARIABLE: [name, this.variableId(statement.variableId)] },
        );
      }
      case "showList":
      case "hideList": {
        const name = this.names.list(statement.listId);
        if (name === undefined) return null;
        return this.with(
          statement.type === "showList" ? "data_showlist" : "data_hidelist",
          parent,
          {},
          { LIST: [name, this.names.listId(statement.listId)] },
        );
      }
      case "listClear": {
        const name = this.names.list(statement.listId);
        if (name === undefined) return null;
        return this.with(
          "data_deleteoflist",
          parent,
          { INDEX: { type: "textLiteral", value: "all" } },
          { LIST: [name, this.names.listId(statement.listId)] },
        );
      }
      case "listAdd":
      case "listInsertAt":
      case "listReplaceAt":
      case "listRemoveAt": {
        const name = this.names.list(statement.listId);
        if (name === undefined) return null;
        const slots: Record<string, Expression> = {};
        if (statement.type !== "listAdd") slots["INDEX"] = statement.index;
        if (statement.type !== "listRemoveAt") slots["ITEM"] = statement.value;
        return this.with(
          {
            listAdd: "data_addtolist",
            listInsertAt: "data_insertatlist",
            listReplaceAt: "data_replaceitemoflist",
            listRemoveAt: "data_deleteoflist",
          }[statement.type],
          parent,
          slots,
          { LIST: [name, this.names.listId(statement.listId)] },
        );
      }
      case "resetTimer":
        return this.with("sensing_resettimer", parent, {});
      case "setVolume":
        return this.with("sound_setvolumeto", parent, { VOLUME: statement.volume });
      case "changeVolume":
        return this.with("sound_changevolumeby", parent, { VOLUME: statement.delta });
      case "stopSounds":
        return this.with("sound_stopallsounds", parent, {});
      case "playSound": {
        // Only the child's own recordings are real audio files; the scene's built-in sounds are not.
        const name = this.names.sound(statement.soundId);
        if (name === undefined) return null;
        const made = this.block("sound_play", parent);
        (made.block["inputs"] as Json)["SOUND_MENU"] = [
          1,
          this.menu(made.id, "sound_sounds_menu", "SOUND_MENU", name),
        ];
        return made.id;
      }
      case "switchCostume": {
        const name = this.names.costume(statement.costumeId);
        if (name === undefined) return null;
        const made = this.block("looks_switchcostumeto", parent);
        (made.block["inputs"] as Json)["COSTUME"] = [
          1,
          this.menu(made.id, "looks_costume", "COSTUME", name),
        ];
        return made.id;
      }
      case "switchBackdrop": {
        const name = this.names.backdrop(statement.backdropId);
        if (name === undefined) return null;
        const made = this.block("looks_switchbackdropto", parent);
        (made.block["inputs"] as Json)["BACKDROP"] = [
          1,
          this.menu(made.id, "looks_backdrops", "BACKDROP", name),
        ];
        return made.id;
      }
      case "penDown":
        return this.with("pen_penDown", parent, {});
      case "penUp":
        return this.with("pen_penUp", parent, {});
      case "clearPen":
        return this.with("pen_clear", parent, {});
      case "stamp":
        return this.with("pen_stamp", parent, {});
      case "setPenColor": {
        const made = this.block("pen_setPenColorToColor", parent);
        (made.block["inputs"] as Json)["COLOR"] = [1, [9, PEN_HEX[statement.color] ?? "#000000"]];
        return made.id;
      }
      case "setPenSize":
        return this.with("pen_setPenSizeTo", parent, { SIZE: statement.size / 4 });
      case "setPenTransparency":
      case "setPenShade": {
        const transparency = statement.type === "setPenTransparency";
        const made = this.block(
          transparency ? "pen_setPenColorParamTo" : "pen_setPenShadeToNumber",
          parent,
        );
        const inputs = made.block["inputs"] as Json;
        if (transparency) {
          inputs["COLOR_PARAM"] = [
            1,
            this.menu(made.id, "pen_menu_colorParam", "colorParam", "transparency"),
          ];
          inputs["VALUE"] = [1, [4, String(statement.percent)]];
        } else inputs["SHADE"] = [1, [4, String(SHADE_NUMBER[statement.shade])]];
        return made.id;
      }
      case "setTempo":
        return this.with("music_setTempo", parent, { TEMPO: statement.bpm });
      case "playNote":
        return this.with("music_playNoteForBeats", parent, {
          NOTE: statement.note,
          BEATS: statement.beats,
        });
      case "playDrum": {
        const made = this.block("music_playDrumForBeats", parent);
        const inputs = made.block["inputs"] as Json;
        inputs["BEATS"] = [1, [4, String(statement.beats)]];
        inputs["DRUM"] = [
          1,
          this.menu(made.id, "music_menu_DRUM", "DRUM", DRUM_NUMBER[statement.drum] ?? "1"),
        ];
        return made.id;
      }
      case "setInstrument": {
        const made = this.block("music_setInstrument", parent);
        (made.block["inputs"] as Json)["INSTRUMENT"] = [
          1,
          this.menu(
            made.id,
            "music_menu_INSTRUMENT",
            "INSTRUMENT",
            INSTRUMENT_NUMBER[statement.instrument] ?? "1",
          ),
        ];
        return made.id;
      }
      default:
        return null;
    }
  }

  /** The hat of a script, then its stack. Returns false when the script cannot be written. */
  script(trigger: Trigger, statements: readonly Statement[], row: number): boolean {
    const hat = this.hat(trigger);
    if (hat === null) {
      this.counter.miss(`script that starts with ${trigger.type}`);
      return false;
    }
    const made = this.block(hat.opcode, null, { fields: hat.fields, inputs: hat.inputs });
    made.block["topLevel"] = true;
    made.block["x"] = 24;
    made.block["y"] = 24 + row * 320;
    const first = this.stack(statements, made.id);
    if (first !== null) made.block["next"] = first;
    return true;
  }

  private hat(trigger: Trigger): { opcode: string; fields: Json; inputs: Json } | null {
    switch (trigger.type) {
      case "greenFlag":
      case "onStart":
        return { opcode: "event_whenflagclicked", fields: {}, inputs: {} };
      case "onActorClicked":
        return { opcode: "event_whenthisspriteclicked", fields: {}, inputs: {} };
      case "onKeyPressed": {
        const key = KEY_NAME[trigger.key];
        return key === undefined
          ? null
          : { opcode: "event_whenkeypressed", fields: { KEY_OPTION: [key, null] }, inputs: {} };
      }
      case "onMessage":
        return {
          opcode: "event_whenbroadcastreceived",
          fields: { BROADCAST_OPTION: [trigger.message, this.broadcastId(trigger.message)] },
          inputs: {},
        };
      case "onTimerOver":
        return {
          opcode: "event_whengreaterthan",
          fields: { WHENGREATERTHANMENU: ["TIMER", null] },
          inputs: { VALUE: [1, [4, String(trigger.seconds)]] },
        };
      case "onLoudnessOver":
        return {
          opcode: "event_whengreaterthan",
          fields: { WHENGREATERTHANMENU: ["LOUDNESS", null] },
          inputs: { VALUE: [1, [4, String(trigger.level)]] },
        };
      case "onBackdropSwitch": {
        const name = this.names.backdrop(trigger.backdropId);
        return name === undefined
          ? null
          : {
              opcode: "event_whenbackdropswitchesto",
              fields: { BACKDROP: [name, null] },
              inputs: {},
            };
      }
      case "onCloneStart":
        return { opcode: "control_start_as_clone", fields: {}, inputs: {} };
      default:
        return null;
    }
  }
}

function svg(width: number, height: number, body: string): PackedFile & { assetId: string } {
  const bytes = encoder.encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`,
  );
  return { name: "", bytes, assetId: md5Hex(bytes) };
}

/** The bytes of a `data:` URL; null when it is not base64. */
export function bytesOfDataUrl(url: string): Uint8Array | null {
  const match = /^data:[^;,]+;base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (match === null) return null;
  const raw = atob(match[1]!);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** Sample rate and count of a PCM WAV; null when the header is not one we can describe. */
function wavFacts(bytes: Uint8Array): { rate: number; samples: number } | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let rate = 0;
  let frame = 0;
  for (let at = 12; at + 8 <= bytes.length;) {
    const size = view.getUint32(at + 4, true);
    if (tag(at) === "fmt ") {
      rate = view.getUint32(at + 12, true);
      frame = (view.getUint16(at + 10, true) * view.getUint16(at + 22, true)) / 8;
    }
    if (tag(at) === "data")
      return rate > 0 && frame > 0 ? { rate, samples: Math.floor(size / frame) } : null;
    at += 8 + size + (size % 2);
  }
  return null;
}

/** Referenced ids of one kind (`costume:nova`, `backdrop:forest`) written anywhere in the program. */
function referenced(program: ProjectProgram, kind: "costume" | "backdrop"): string[] {
  const found = new Set<string>();
  for (const match of JSON.stringify(program).matchAll(new RegExp(`"${kind}:([a-z0-9-]+)"`, "g")))
    found.add(`${kind}:${match[1]}`);
  return [...found];
}

export function exportScratchProject(
  rawProgram: ProjectProgram,
  backdropId: KidsGalleryBackdropId,
  locale: Locale,
  positions: Readonly<
    Record<string, { x: number; y: number; direction?: number; size?: number }>
  > = {},
  art: ScratchExportArt = {},
): ScratchExport {
  const program = validateStudioProgram(rawProgram);
  const creative = creativeForStudio(program, backdropId, locale, positions, [], art);
  const counter = new Counter();
  const actors = creative.actors ?? [];
  const ownAssets = (creative.assets ?? []).filter((item) => item.source.startsWith("data:"));

  // Scratch needs a unique name for each sprite.
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const actor of actors) {
    let name = actor.name.slice(0, 40) || "Sprite";
    for (let n = 2; used.has(name); n += 1) name = `${actor.name} ${n}`;
    used.add(name);
    names.set(actor.id, name);
  }

  const variables = new Map<string, string>();
  for (const item of program.variables ?? []) variables.set(item.id, item.name);
  for (const item of program.textVariables ?? []) variables.set(item.id, item.name);
  const listNames = new Map<string, string>();
  for (const item of program.lists ?? []) listNames.set(item.id, item.name);
  const broadcasts: Record<string, string> = {};
  const broadcastId = (message: string) => {
    const id = `msg-${message}`;
    broadcasts[id] = message;
    return id;
  };

  const files: PackedFile[] = [];
  const addFile = (bytes: Uint8Array, ext: string) => {
    const assetId = md5Hex(bytes);
    const md5ext = `${assetId}.${ext}`;
    if (!files.some((item) => item.name === md5ext)) files.push({ name: md5ext, bytes });
    return { assetId, md5ext };
  };
  const asset = (file: PackedFile) => addFile(file.bytes, "svg");
  const uniqueNames = (wanted: string[]): string[] => {
    const seen = new Set<string>();
    return wanted.map((raw) => {
      let name = raw.slice(0, 40) || "item";
      for (let n = 2; seen.has(name); n += 1) name = `${raw.slice(0, 36)} ${n}`;
      seen.add(name);
      return name;
    });
  };

  // Backdrops: the scene's own, any other gallery one a block names, then the child's pictures.
  const galleryBackdrops = [
    `backdrop:${backdropId}`,
    ...referenced(program, "backdrop").filter(
      (id) => isGalleryBackdropId(id.slice(9)) && id !== `backdrop:${backdropId}`,
    ),
  ];
  const ownBackdrops = ownAssets.filter(
    (item) => item.kind === "backdrop" && art.pictures?.has(item.id),
  );
  for (const item of ownAssets)
    if ((item.kind === "backdrop" || item.kind === "costume") && !art.pictures?.has(item.id))
      counter.miss("a picture that could not be converted");
  const backdropList = [
    ...galleryBackdrops.map((id) => ({ id, own: undefined as ProjectAsset | undefined })),
    ...ownBackdrops.map((item) => ({ id: item.id, own: item as ProjectAsset | undefined })),
  ];
  const backdropNames = uniqueNames(
    backdropList.map(
      ({ id, own }) =>
        own?.name ??
        (() => {
          const found = KIDS_GALLERY_BACKDROPS.find((item) => `backdrop:${item.id}` === id);
          return found ? (locale === "es" ? found.es : found.en) : "backdrop";
        })(),
    ),
  );
  const backdropName = new Map(backdropList.map((item, at) => [item.id, backdropNames[at]!]));
  const stageCostumes = backdropList.map(({ id, own }) => {
    const name = backdropName.get(id)!;
    if (own !== undefined) {
      const picture = art.pictures!.get(own.id)!;
      return {
        name,
        dataFormat: "png",
        bitmapResolution: Math.max(1, Math.round(picture.width / 480)),
        ...addFile(picture.png, "png"),
        rotationCenterX: picture.width / 2,
        rotationCenterY: picture.height / 2,
      };
    }
    const gallery = KIDS_GALLERY_BACKDROPS.find((item) => `backdrop:${item.id}` === id)!;
    return {
      name,
      dataFormat: "svg",
      ...asset(
        svg(
          480,
          360,
          `<rect width="480" height="360" fill="${gallery.sky}"/><rect y="220" width="480" height="140" fill="${gallery.ground}"/>`,
        ),
      ),
      rotationCenterX: 240,
      rotationCenterY: 180,
    };
  });
  const currentBackdrop = Math.max(
    0,
    backdropList.findIndex((item) => item.id === creative.stage?.backdropId),
  );

  // The child's recordings: real audio files, shared by every sprite so any of them can play one.
  const soundAssets = ownAssets.filter((item) => item.kind === "sound");
  const soundNames = uniqueNames(soundAssets.map((item) => item.name));
  const soundName = new Map(soundAssets.map((item, at) => [item.id, soundNames[at]!]));
  const soundEntries: Json[] = [];
  for (const [at, item] of soundAssets.entries()) {
    const bytes = bytesOfDataUrl(item.source);
    const facts = bytes === null ? null : wavFacts(bytes);
    if (bytes === null || facts === null) {
      counter.miss("a recording that is not a WAV");
      soundName.delete(item.id);
      continue;
    }
    soundEntries.push({
      name: soundNames[at]!,
      dataFormat: "wav",
      format: "",
      rate: facts.rate,
      sampleCount: facts.samples,
      ...addFile(bytes, "wav"),
    });
  }

  const sprites: Json[] = [];
  actors.forEach((actor, index) => {
    const character = KIDS_GALLERY_CHARACTERS.find(
      (item) => `actor:studio-${index + 1}-${item.id}` === actor.id,
    );
    // Costumes: the character's own picture, the other characters' a block names, then the child's.
    const galleryCostumes = [
      `costume:${character?.id ?? ""}`,
      ...referenced(program, "costume").filter(
        (id) => isGalleryCharacterId(id.slice(8)) && id !== `costume:${character?.id}`,
      ),
    ];
    const ownCostumes = ownAssets.filter(
      (item) => item.kind === "costume" && art.pictures?.has(item.id),
    );
    const costumeList = [
      ...galleryCostumes.map((id) => ({ id, own: undefined as ProjectAsset | undefined })),
      ...ownCostumes.map((item) => ({ id: item.id, own: item as ProjectAsset | undefined })),
    ];
    const costumeNames = uniqueNames(
      costumeList.map(
        ({ id, own }) =>
          own?.name ??
          (() => {
            const found = KIDS_GALLERY_CHARACTERS.find((item) => `costume:${item.id}` === id);
            return found ? (locale === "es" ? found.es : found.en) : "costume";
          })(),
      ),
    );
    const costumeName = new Map(costumeList.map((item, at) => [item.id, costumeNames[at]!]));
    const costumes = costumeList.map(({ id, own }) => {
      const name = costumeName.get(id)!;
      if (own !== undefined) {
        const picture = art.pictures!.get(own.id)!;
        return {
          name,
          dataFormat: "png",
          bitmapResolution: 1,
          ...addFile(picture.png, "png"),
          rotationCenterX: picture.width / 2,
          rotationCenterY: picture.height / 2,
        };
      }
      const gallery = KIDS_GALLERY_CHARACTERS.find((item) => `costume:${item.id}` === id);
      return {
        name,
        dataFormat: "svg",
        ...asset(
          svg(
            96,
            96,
            `<circle cx="48" cy="48" r="44" fill="${gallery?.color ?? "#dce9ff"}"/><text x="48" y="64" font-size="48" text-anchor="middle">${gallery?.glyph ?? ""}</text>`,
          ),
        ),
        rotationCenterX: 48,
        rotationCenterY: 48,
      };
    });
    const emitter = new Emitter(counter, {
      variable: (id) => variables.get(id),
      variableId: (id) =>
        program.variables?.some((item) => item.id === id && item.scope !== "stage") ||
        program.textVariables?.some((item) => item.id === id && item.scope !== "stage")
          ? `${actor.id}:${id}`
          : id,
      list: (id) => listNames.get(id),
      listId: (id) =>
        program.lists?.some((item) => item.id === id && item.scope !== "stage")
          ? `${actor.id}:${id}`
          : id,
      sprite: (actorId) => names.get(actorId),
      costume: (id) => costumeName.get(id),
      backdrop: (id) => backdropName.get(id),
      sound: (id) => soundName.get(id),
      broadcast: broadcastId,
    });
    let row = 0;
    for (const script of program.scripts as readonly Script[]) {
      const own =
        actorOfScript(script.id) ?? cloneActorOfScript(script.id) ?? extraActorOfScript(script.id);
      if (own === null || studioActorId(own.index, own.characterId) !== actor.id) continue;
      if (emitter.script(script.trigger, script.statements, row)) row += 1;
    }
    sprites.push({
      isStage: false,
      name: names.get(actor.id)!,
      variables: Object.fromEntries(
        [...(program.variables ?? []), ...(program.textVariables ?? [])]
          .filter((item) => item.scope !== "stage")
          .map((item) => [`${actor.id}:${item.id}`, [item.name, item.initialValue]]),
      ),
      lists: Object.fromEntries(
        (program.lists ?? [])
          .filter((item) => item.scope !== "stage")
          .map((item) => [`${actor.id}:${item.id}`, [item.name, item.initialItems]]),
      ),
      broadcasts: {},
      blocks: emitter.blocks,
      comments: {},
      currentCostume: Math.max(
        0,
        costumeList.findIndex((item) => item.id === actor.costumeId),
      ),
      costumes,
      sounds: soundEntries,
      volume: 100,
      layerOrder: index + 1,
      visible: actor.visible !== false,
      x: scratchX(actor.x),
      y: scratchY(actor.y),
      size: actor.size ?? 100,
      direction: scratchDirection(actor.direction ?? 0),
      draggable: false,
      rotationStyle: "all around",
    });
  });

  // What the scene holds that Scratch has no counterpart for in this version.
  for (const kind of ["procedures", "sharedProcedures"] as const) {
    const present = (program as unknown as Record<string, unknown[] | undefined>)[kind];
    if (present !== undefined && present.length > 0) counter.miss(kind);
  }

  const stage: Json = {
    isStage: true,
    name: "Stage",
    variables: Object.fromEntries([
      ...(program.variables ?? [])
        .filter((item) => item.scope === "stage")
        .map((item) => [item.id, [item.name, item.initialValue]]),
      ...(program.textVariables ?? [])
        .filter((item) => item.scope === "stage")
        .map((item) => [item.id, [item.name, item.initialValue]]),
    ]),
    lists: Object.fromEntries(
      (program.lists ?? [])
        .filter((item) => item.scope === "stage")
        .map((item) => [item.id, [item.name, item.initialItems]]),
    ),
    broadcasts,
    blocks: {},
    comments: {},
    currentCostume: currentBackdrop,
    costumes: stageCostumes,
    sounds: [],
    volume: 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: "off",
    textToSpeechLanguage: null,
  };
  const project = {
    targets: [stage, ...sprites],
    monitors: [],
    extensions: [...(program.extensions ?? [])].filter(
      (item) => item === "pen" || item === "music",
    ),
    meta: { semver: "3.0.0", vm: "0.2.0", agent: "Agorix" },
  };
  const bytes = zipStored([
    { name: "project.json", bytes: encoder.encode(JSON.stringify(project)) },
    ...files,
  ]);
  const left = [...counter.left.entries()]
    .map(([what, count]) => ({ what, count }))
    .sort((a, b) => b.count - a.count || a.what.localeCompare(b.what));
  return {
    bytes,
    report: {
      sprites: sprites.length,
      blocksExported: counter.exported,
      blocksAdjusted: counter.adjusted,
      left,
    },
  };
}
