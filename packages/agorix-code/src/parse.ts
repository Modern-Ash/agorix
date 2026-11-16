import { ExpressionError, parseExpression, type ExpressionNames } from "./parseExpression.js";
import {
  validateProgram,
  ProgramValidationError,
  SCHEMA_VERSION,
  type Expression,
  type ProjectProgram,
  type Script,
  type Statement,
  type Trigger,
} from "@agorix/program-model";

/**
 * Reads Agorix Code back into the canonical program. The text is never run: it is only read, line
 * by line, and the result must pass the canonical validator like any other program. Only the
 * beginner subset below is understood; every other line is refused with a code and a line number
 * (never guessed at, never sent anywhere), so a program that uses more than the subset stays
 * editable with blocks.
 *
 * Names tie text to the program it came from: a variable is found by its name in `base`, and the
 * n-th script keeps the n-th script's id, so reading the text a program was shown as gives back
 * that same program.
 */
export type AgorixCodeErrorCode =
  | "emptyText"
  | "unknownLine"
  | "badIndent"
  | "badNumber"
  | "badText"
  | "badExpression"
  | "unknownName"
  | "elseWithoutIf"
  | "emptyBody"
  | "tooDeep"
  | "tooLong"
  | "notValid";

export interface AgorixCodeError {
  readonly code: AgorixCodeErrorCode;
  /** 1-based. */
  readonly line: number;
}

export type AgorixCodeParse =
  | { readonly ok: true; readonly program: ProjectProgram }
  | { readonly ok: false; readonly errors: readonly AgorixCodeError[] };

/** Most characters and lines read; a longer text is refused before it is looked at. */
export const AGORIX_CODE_MAX_CHARS = 20_000;
export const AGORIX_CODE_MAX_LINES = 400;
const MAX_DEPTH = 12;

interface Line {
  readonly n: number;
  readonly depth: number;
  readonly text: string;
}

class Refusal extends Error {
  constructor(readonly error: AgorixCodeError) {
    super(error.code);
  }
}

const refuse = (code: AgorixCodeErrorCode, line: number): never => {
  throw new Refusal({ code, line });
};

const NUMBER = /^-?\d+(?:\.\d+)?$/;
const QUOTED = /^"((?:[^"\\]|\\.)*)"$/;

function numberOf(text: string, line: number): number {
  if (!NUMBER.test(text)) return refuse("badNumber", line);
  return Number(text);
}

function quoted(text: string, line: number): string {
  const match = QUOTED.exec(text);
  if (match === null) return refuse("badText", line);
  try {
    return JSON.parse(text) as string;
  } catch {
    return refuse("badText", line);
  }
}

function lines(source: string): Line[] {
  if (source.length > AGORIX_CODE_MAX_CHARS) return refuse("tooLong", 1);
  const out: Line[] = [];
  source.split("\n").forEach((raw, index) => {
    const text = raw.replace(/\s+$/, "");
    if (text.trim() === "") return;
    const spaces = /^ */.exec(text)![0].length;
    if (/^\t/.test(text) || spaces % 2 !== 0) refuse("badIndent", index + 1);
    out.push({ n: index + 1, depth: spaces / 2, text: text.trim() });
  });
  if (out.length === 0) return refuse("emptyText", 1);
  if (out.length > AGORIX_CODE_MAX_LINES) return refuse("tooLong", AGORIX_CODE_MAX_LINES);
  return out;
}

const Q = '("(?:[^"\\\\]|\\\\.)*")';

/**
 * Statements whose parts are only words and numbers (no variable, no list, no custom block): each
 * line is one pattern and one way to build the block. The canonical validator still has the last
 * word on every value (a colour, a drum, a size the scene offers).
 */
const SIMPLE: readonly {
  readonly pattern: RegExp;
  readonly build: (
    m: RegExpExecArray,
    n: (text: string) => number,
    q: (text: string) => string,
  ) => unknown;
}[] = [
  { pattern: /^bounce on edge$/, build: () => ({ type: "bounceOnEdge" }) },
  {
    pattern: /^point in direction (\S+)$/,
    build: (m, n) => ({ type: "pointInDirection", degrees: n(m[1]!) }),
  },
  {
    pattern: new RegExp(`^point towards ${Q}$`),
    build: (m, _n, q) => ({ type: "pointTowards", actorId: q(m[1]!) }),
  },
  { pattern: /^set x to (\S+)$/, build: (m, n) => ({ type: "setX", x: n(m[1]!) }) },
  { pattern: /^set y to (\S+)$/, build: (m, n) => ({ type: "setY", y: n(m[1]!) }) },
  { pattern: /^change x by (\S+)$/, build: (m, n) => ({ type: "changeX", dx: n(m[1]!) }) },
  { pattern: /^change y by (\S+)$/, build: (m, n) => ({ type: "changeY", dy: n(m[1]!) }) },
  {
    pattern: /^glide to (\S+), (\S+) in (\S+) seconds$/,
    build: (m, n) => ({ type: "glideTo", x: n(m[1]!), y: n(m[2]!), seconds: n(m[3]!) }),
  },
  { pattern: /^go to random position$/, build: () => ({ type: "goToTarget", target: "random" }) },
  { pattern: /^go to mouse pointer$/, build: () => ({ type: "goToTarget", target: "mouse" }) },
  {
    pattern: new RegExp(`^go to ${Q}$`),
    build: (m, _n, q) => ({ type: "goToTarget", target: "actor", actorId: q(m[1]!) }),
  },
  {
    pattern: new RegExp(`^glide (\\S+) secs to (random position|mouse pointer|${Q})$`),
    build: (m, n, q) => {
      const seconds = n(m[1]!);
      return m[2] === "random position"
        ? { type: "goToTarget", target: "random", seconds }
        : m[2] === "mouse pointer"
          ? { type: "goToTarget", target: "mouse", seconds }
          : { type: "goToTarget", target: "actor", actorId: q(m[2]!), seconds };
    },
  },
  {
    pattern: /^set rotation style (left-right|don't rotate|all around)$/,
    build: (m) => ({
      type: "setRotationStyle",
      style: m[1] === "left-right" ? "leftRight" : m[1] === "don't rotate" ? "none" : "all",
    }),
  },
  { pattern: /^go to (front|back) layer$/, build: (m) => ({ type: "goToLayer", layer: m[1] }) },
  {
    pattern: /^go (forward|backward) (\S+) layers$/,
    build: (m, n) => ({ type: "goToLayer", layer: m[1], steps: n(m[2]!) }),
  },
  { pattern: /^set size to (\S+)$/, build: (m, n) => ({ type: "setSize", size: n(m[1]!) }) },
  { pattern: /^change size by (\S+)$/, build: (m, n) => ({ type: "changeSize", delta: n(m[1]!) }) },
  {
    pattern: new RegExp(`^switch costume to ${Q}$`),
    build: (m, _n, q) => ({ type: "switchCostume", costumeId: q(m[1]!) }),
  },
  {
    pattern: new RegExp(`^switch backdrop to ${Q}$`),
    build: (m, _n, q) => ({ type: "switchBackdrop", backdropId: q(m[1]!) }),
  },
  {
    pattern: /^set (\w+) effect to (\S+)$/,
    build: (m, n) => ({ type: "setEffect", effect: m[1], value: n(m[2]!) }),
  },
  {
    pattern: /^change (\w+) effect by (\S+)$/,
    build: (m, n) => ({ type: "changeEffect", effect: m[1], delta: n(m[2]!) }),
  },
  { pattern: /^clear graphic effects$/, build: () => ({ type: "clearEffects" }) },
  {
    pattern: new RegExp(`^play sound ${Q}$`),
    build: (m, _n, q) => ({ type: "playSound", soundId: q(m[1]!) }),
  },
  { pattern: /^stop all sounds$/, build: () => ({ type: "stopSounds" }) },
  { pattern: /^set volume to (\S+)$/, build: (m, n) => ({ type: "setVolume", volume: n(m[1]!) }) },
  {
    pattern: /^change volume by (\S+)$/,
    build: (m, n) => ({ type: "changeVolume", delta: n(m[1]!) }),
  },
  { pattern: /^stop (script|actor|scene)$/, build: (m) => ({ type: "stop", scope: m[1] }) },
  { pattern: /^reset timer$/, build: () => ({ type: "resetTimer" }) },
  { pattern: /^delete this clone$/, build: () => ({ type: "deleteThisClone" }) },
  { pattern: /^pen down$/, build: () => ({ type: "penDown" }) },
  { pattern: /^pen up$/, build: () => ({ type: "penUp" }) },
  { pattern: /^clear pen$/, build: () => ({ type: "clearPen" }) },
  { pattern: /^stamp$/, build: () => ({ type: "stamp" }) },
  { pattern: /^set pen color (\w+)$/, build: (m) => ({ type: "setPenColor", color: m[1] }) },
  { pattern: /^set pen size (\S+)$/, build: (m, n) => ({ type: "setPenSize", size: n(m[1]!) }) },
  { pattern: /^set pen shade (\w+)$/, build: (m) => ({ type: "setPenShade", shade: m[1] }) },
  {
    pattern: /^set pen transparency (\S+)$/,
    build: (m, n) => ({ type: "setPenTransparency", percent: n(m[1]!) }),
  },
  {
    pattern: /^play note (\S+) for (\S+) beats$/,
    build: (m, n) => ({ type: "playNote", note: n(m[1]!), beats: n(m[2]!) }),
  },
  {
    pattern: /^play drum (\w+) for (\S+) beats$/,
    build: (m, n) => ({ type: "playDrum", drum: m[1], beats: n(m[2]!) }),
  },
  {
    pattern: /^set instrument (\w+)$/,
    build: (m) => ({ type: "setInstrument", instrument: m[1] }),
  },
  { pattern: /^set tempo (\S+)$/, build: (m, n) => ({ type: "setTempo", bpm: n(m[1]!) }) },
  { pattern: /^set pitch (\S+)$/, build: (m, n) => ({ type: "setPitch", semitones: n(m[1]!) }) },
  { pattern: /^set pan (\S+)$/, build: (m, n) => ({ type: "setPan", pan: n(m[1]!) }) },
];

const PEN_BLOCKS = new Set([
  "penDown",
  "penUp",
  "clearPen",
  "stamp",
  "setPenColor",
  "setPenSize",
  "setPenShade",
  "setPenTransparency",
]);
const MUSIC_BLOCKS = new Set([
  "playNote",
  "playDrum",
  "setInstrument",
  "setTempo",
  "setPitch",
  "setPan",
]);

/** The packs a script's blocks need, found by looking through the nested blocks. */
function packsUsed(value: unknown, into: Set<"pen" | "music">): void {
  if (Array.isArray(value)) {
    for (const item of value) packsUsed(item, into);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  const type = record["type"];
  if (typeof type === "string" && PEN_BLOCKS.has(type)) into.add("pen");
  if (typeof type === "string" && MUSIC_BLOCKS.has(type)) into.add("music");
  for (const key of ["statements", "then", "else", "body"]) packsUsed(record[key], into);
}

class Reader {
  position = 0;
  constructor(
    private readonly all: readonly Line[],
    private readonly variableIds: ReadonlyMap<string, string>,
    private readonly textIds: ReadonlyMap<string, string>,
    private readonly listIds: ReadonlyMap<string, string> = new Map(),
  ) {}

  private get names(): ExpressionNames {
    return {
      numberId: (name) => this.variableIds.get(name),
      textId: (name) => this.textIds.get(name),
      listId: (name) => this.listIds.get(name),
    };
  }

  /** One expression, read from the rest of a line. */
  expr(text: string, line: number): Expression {
    try {
      return parseExpression(text, this.names);
    } catch (error) {
      if (error instanceof ExpressionError) return refuse("badExpression", line);
      throw error;
    }
  }

  get done(): boolean {
    return this.position >= this.all.length;
  }
  peek(): Line | undefined {
    return this.all[this.position];
  }
  take(): Line {
    return this.all[this.position++]!;
  }

  variable(name: string, line: number): string {
    const id = this.variableIds.get(quoted(name, line));
    return id ?? refuse("unknownName", line);
  }

  list(name: string, line: number): string {
    return this.listIds.get(quoted(name, line)) ?? refuse("unknownName", line);
  }

  number(text: string, line: number): Expression {
    return { type: "numericLiteral", value: numberOf(text, line) };
  }

  /** The indented block that follows a line; it must exist. */
  block(parent: Line): Statement[] {
    const body: Statement[] = [];
    while (!this.done && this.peek()!.depth > parent.depth) {
      const child = this.peek()!;
      if (child.depth !== parent.depth + 1) refuse("badIndent", child.n);
      body.push(this.statement());
    }
    if (body.length === 0) refuse("emptyBody", parent.n);
    return body;
  }

  statement(): Statement {
    const line = this.take();
    if (line.depth > MAX_DEPTH) refuse("tooDeep", line.n);
    const t = line.text;
    let m: RegExpExecArray | null;
    if ((m = /^move (\S+)$/.exec(t))) return { type: "move", steps: numberOf(m[1]!, line.n) };
    if ((m = /^turn (\S+)$/.exec(t))) return { type: "turn", degrees: numberOf(m[1]!, line.n) };
    if ((m = /^go to (\S+), (\S+)$/.exec(t)))
      return { type: "goTo", x: numberOf(m[1]!, line.n), y: numberOf(m[2]!, line.n) };
    if ((m = /^wait (\S+) seconds$/.exec(t)))
      return { type: "wait", seconds: numberOf(m[1]!, line.n) };
    if (t === "show") return { type: "show" };
    if (t === "hide") return { type: "hide" };
    if ((m = /^(say|think) ("(?:[^"\\]|\\.)*")(?: \+ (.+?))?(?: for (\S+) seconds)?$/.exec(t))) {
      const text = quoted(m[2]!, line.n);
      return {
        type: m[1] as "say" | "think",
        text,
        ...(m[3] === undefined ? {} : { append: this.expr(m[3], line.n) }),
        ...(m[4] === undefined ? {} : { seconds: numberOf(m[4], line.n) }),
      };
    }
    if ((m = /^set ("(?:[^"\\]|\\.)*") to (.+)$/.exec(t))) {
      const name = quoted(m[1]!, line.n);
      const value = this.expr(m[2]!, line.n);
      const numberId = this.variableIds.get(name);
      if (numberId !== undefined) return { type: "setVariable", variableId: numberId, value };
      const textId = this.textIds.get(name);
      if (textId !== undefined) return { type: "setText", variableId: textId, value };
      return refuse("unknownName", line.n);
    }
    if ((m = /^change ("(?:[^"\\]|\\.)*") by (.+)$/.exec(t)))
      return {
        type: "changeVariable",
        variableId: this.variable(m[1]!, line.n),
        delta: this.expr(m[2]!, line.n),
      };
    if ((m = /^repeat until (.+)$/.exec(t)))
      return { type: "repeatUntil", condition: this.expr(m[1]!, line.n), body: this.block(line) };
    if ((m = /^wait until (.+) \(up to 10 seconds\)$/.exec(t)))
      return { type: "waitUntil", condition: this.expr(m[1]!, line.n) };
    if ((m = /^repeat (\S+) times$/.exec(t)))
      return { type: "repeat", count: numberOf(m[1]!, line.n), body: this.block(line) };
    if (/^forever(?: \(bounded by run budget\))?$/.test(t))
      return { type: "forever", body: this.block(line) };
    if ((m = /^if (.+)$/.exec(t))) {
      const condition = this.expr(m[1]!, line.n);
      const then = this.block(line);
      const next = this.peek();
      if (next !== undefined && next.depth === line.depth && next.text === "else") {
        const elseLine = this.take();
        return { type: "if", condition, then, else: this.block(elseLine) };
      }
      return { type: "if", condition, then };
    }
    for (const entry of SIMPLE) {
      const found = entry.pattern.exec(t);
      if (found !== null)
        return entry.build(
          found,
          (text) => numberOf(text, line.n),
          (text) => quoted(text, line.n),
        ) as Statement;
    }
    if ((m = new RegExp(`^add (.+) to ${Q}$`).exec(t)))
      return { type: "listAdd", listId: this.list(m[2]!, line.n), value: this.expr(m[1]!, line.n) };
    if ((m = new RegExp(`^delete all of ${Q}$`).exec(t)))
      return { type: "listClear", listId: this.list(m[1]!, line.n) };
    if ((m = new RegExp(`^remove item (.+) of ${Q}$`).exec(t)))
      return {
        type: "listRemoveAt",
        listId: this.list(m[2]!, line.n),
        index: this.expr(m[1]!, line.n),
      };
    if ((m = new RegExp(`^(insert|replace) item (.+) of ${Q} with (.+)$`).exec(t)))
      return {
        type: m[1] === "insert" ? "listInsertAt" : "listReplaceAt",
        listId: this.list(m[3]!, line.n),
        index: this.expr(m[2]!, line.n),
        value: this.expr(m[4]!, line.n),
      };
    if (
      (m = new RegExp(`^(show|hide) ${Q}$`).exec(t)) &&
      this.listIds.has(quoted(m[2]!, line.n)) &&
      !this.variableIds.has(quoted(m[2]!, line.n))
    )
      return { type: m[1] === "show" ? "showList" : "hideList", listId: this.list(m[2]!, line.n) };
    if ((m = new RegExp(`^show ${Q}$`).exec(t)))
      return { type: "showVariable", variableId: this.variable(m[1]!, line.n) };
    if ((m = new RegExp(`^hide ${Q}$`).exec(t)))
      return { type: "hideVariable", variableId: this.variable(m[1]!, line.n) };
    if (/^(say|think) /.test(t)) return refuse("badText", line.n);
    if (t === "else") return refuse("elseWithoutIf", line.n);
    return refuse("unknownLine", line.n);
  }
}

function trigger(line: Line): Trigger {
  const t = line.text;
  let m: RegExpExecArray | null;
  if (t === "when start") return { type: "greenFlag" };
  if ((m = /^when key ("(?:[^"\\]|\\.)*") pressed$/.exec(t)))
    return { type: "onKeyPressed", key: quoted(m[1]!, line.n) };
  if ((m = /^when message ("(?:[^"\\]|\\.)*") received$/.exec(t)))
    return { type: "onMessage", message: quoted(m[1]!, line.n) };
  if (t === "when actor clicked") return { type: "onActorClicked" };
  if (t === "when I start as a clone") return { type: "onCloneStart" };
  if ((m = new RegExp(`^when backdrop switches to ${Q}$`).exec(t)))
    return { type: "onBackdropSwitch", backdropId: quoted(m[1]!, line.n) };
  if ((m = /^when (\S+) seconds have passed$/.exec(t)))
    return { type: "onTimerOver", seconds: numberOf(m[1]!, line.n) };
  if ((m = /^when loudness is over (\S+)$/.exec(t)))
    return { type: "onLoudnessOver", level: numberOf(m[1]!, line.n) };
  return refuse("unknownLine", line.n);
}

/** The items of a list declaration: numbers and quoted words, separated by commas. */
function listItems(text: string, line: number): (number | string)[] {
  const items: (number | string)[] = [];
  let rest = text.trim();
  while (rest.length > 0) {
    const word = /^"(?:[^"\\]|\\.)*"/.exec(rest);
    const number = /^-?\d+(?:\.\d+)?/.exec(rest);
    const found = word ?? number;
    if (found === null) return refuse("badText", line);
    items.push(word !== null ? quoted(found[0], line) : Number(found[0]));
    rest = rest.slice(found[0].length).trim();
    if (rest.length === 0) break;
    if (!rest.startsWith(",")) return refuse("badText", line);
    rest = rest.slice(1).trim();
  }
  return items;
}

/**
 * Text to program. `base` is the program the text was shown from, if there is one: it supplies the
 * variable ids (by name) and the script ids (by position), so an edit keeps what it did not touch.
 */
export function parseAgorixCode(
  source: string,
  base?: ProjectProgram,
  options: {
    /** The id of a variable the text declares and the base does not have; the n-th new one. */
    readonly newVariableId?: (taken: ReadonlySet<string>, n: number) => string;
    /** The same for a list the base does not have. */
    readonly newListId?: (taken: ReadonlySet<string>, n: number) => string;
  } = {},
): AgorixCodeParse {
  try {
    const all = lines(source);
    const variables: {
      id: string;
      name: string;
      initialValue: number;
      visible: boolean;
      scope?: "stage";
    }[] = [];
    const textVariables: {
      id: string;
      name: string;
      initialValue: string;
      visible: boolean;
      scope?: "stage";
    }[] = [];
    const known = new Map<string, string>(
      (base?.variables ?? []).map((item) => [item.name, item.id] as const),
    );
    const knownText = new Map<string, string>(
      (base?.textVariables ?? []).map((item) => [item.name, item.id] as const),
    );
    const knownLists = new Map<string, string>(
      (base?.lists ?? []).map((item) => [item.name, item.id] as const),
    );
    const lists: {
      id: string;
      name: string;
      initialItems: (number | string)[];
      visible: boolean;
      scope?: "stage";
    }[] = [];
    let index = 0;
    // Declarations come first: `variable "name" = N` or `text "name" = "words"` (each with
    // `stage ` in front when it is shared by the whole scene), then optionally `show "name"`.
    while (
      index < all.length &&
      all[index]!.depth === 0 &&
      /^(?:stage )?(?:variable|text|list) /.test(all[index]!.text)
    ) {
      const line = all[index]!;
      const m = /^(stage )?(variable|text|list) ("(?:[^"\\]|\\.)*") =(?: (.*))?$/.exec(line.text);
      if (m === null) refuse("unknownLine", line.n);
      if (m![2] === "list") {
        const name = quoted(m![3]!, line.n);
        const taken = new Set(lists.map((item) => item.id));
        const allTaken = new Set([...taken, ...knownLists.values()]);
        const id =
          knownLists.get(name) ??
          options.newListId?.(allTaken, lists.length + 1) ??
          Array.from({ length: lists.length + 1 }, (_, k) => `list-${k + 1}`).find(
            (candidate) => !allTaken.has(candidate),
          )!;
        knownLists.set(name, id);
        let visible = false;
        const next = all[index + 1];
        if (
          next !== undefined &&
          next.depth === 0 &&
          next.text === `show ${JSON.stringify(name)}`
        ) {
          visible = true;
          index += 1;
        }
        lists.push({
          id,
          name,
          initialItems: listItems(m![4] ?? "", line.n),
          visible,
          ...(m![1] === undefined ? {} : { scope: "stage" as const }),
        });
        index += 1;
        continue;
      }
      if (m![4] === undefined) refuse("unknownLine", line.n);
      const isText = m![2] === "text";
      const name = quoted(m![3]!, line.n);
      const scope = m![1] === undefined ? {} : { scope: "stage" as const };
      const taken = new Set([
        ...known.values(),
        ...knownText.values(),
        ...variables.map((item) => item.id),
        ...textVariables.map((item) => item.id),
      ]);
      const own = isText ? knownText : known;
      const id =
        own.get(name) ??
        options.newVariableId?.(taken, variables.length + textVariables.length + 1) ??
        `${isText ? "text" : "var"}-${(isText ? textVariables : variables).length + 1}`;
      own.set(name, id);
      let visible = false;
      const next = all[index + 1];
      if (next !== undefined && next.depth === 0 && next.text === `show ${JSON.stringify(name)}`) {
        visible = true;
        index += 1;
      }
      if (isText)
        textVariables.push({ id, name, initialValue: quoted(m![4]!, line.n), visible, ...scope });
      else variables.push({ id, name, initialValue: numberOf(m![4]!, line.n), visible, ...scope });
      index += 1;
    }
    const reader = new Reader(all.slice(index), known, knownText, knownLists);
    const scripts: Script[] = [];
    while (!reader.done) {
      const head = reader.take();
      if (head.depth !== 0) refuse("badIndent", head.n);
      const kind = trigger(head);
      const statements = reader.block(head);
      scripts.push({
        id: base?.scripts[scripts.length]?.id ?? `script-${scripts.length + 1}`,
        trigger: kind,
        statements,
      });
    }
    if (scripts.length === 0) refuse("emptyText", 1);
    const packs = new Set<"pen" | "music">();
    for (const script of scripts) packsUsed(script.statements, packs);
    const extensions = (["pen", "music"] as const).filter((pack) => packs.has(pack));
    const program = validateProgram({
      schema: SCHEMA_VERSION,
      ...(extensions.length > 0 ? { extensions } : {}),
      ...(variables.length > 0 ? { variables } : {}),
      ...(textVariables.length > 0 ? { textVariables } : {}),
      ...(lists.length > 0 ? { lists } : {}),
      scripts,
    } as never);
    return { ok: true, program };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, errors: [error.error] };
    if (error instanceof ProgramValidationError)
      return { ok: false, errors: [{ code: "notValid", line: 1 }] };
    throw error;
  }
}
