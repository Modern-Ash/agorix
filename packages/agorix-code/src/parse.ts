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

class Reader {
  position = 0;
  constructor(
    private readonly all: readonly Line[],
    private readonly variableIds: ReadonlyMap<string, string>,
  ) {}

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
    if ((m = /^(say|think) ("(?:[^"\\]|\\.)*")(?: for (\S+) seconds)?$/.exec(t))) {
      const text = quoted(m[2]!, line.n);
      return {
        type: m[1] as "say" | "think",
        text,
        ...(m[3] === undefined ? {} : { seconds: numberOf(m[3], line.n) }),
      };
    }
    if ((m = /^set ("(?:[^"\\]|\\.)*") to (\S+)$/.exec(t)))
      return {
        type: "setVariable",
        variableId: this.variable(m[1]!, line.n),
        value: this.number(m[2]!, line.n),
      };
    if ((m = /^change ("(?:[^"\\]|\\.)*") by (\S+)$/.exec(t)))
      return {
        type: "changeVariable",
        variableId: this.variable(m[1]!, line.n),
        delta: this.number(m[2]!, line.n),
      };
    if ((m = /^repeat (\S+) times$/.exec(t)))
      return { type: "repeat", count: numberOf(m[1]!, line.n), body: this.block(line) };
    if (/^forever(?: \(bounded by run budget\))?$/.test(t))
      return { type: "forever", body: this.block(line) };
    if ((m = /^if key (\S+) is down$/.exec(t))) {
      const then = this.block(line);
      const next = this.peek();
      if (next !== undefined && next.depth === line.depth && next.text === "else") {
        const elseLine = this.take();
        return {
          type: "if",
          condition: { type: "keyDown", key: m[1]! },
          then,
          else: this.block(elseLine),
        };
      }
      return { type: "if", condition: { type: "keyDown", key: m[1]! }, then };
    }
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
  return refuse("unknownLine", line.n);
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
  } = {},
): AgorixCodeParse {
  try {
    const all = lines(source);
    const variables: { id: string; name: string; initialValue: number; visible: boolean }[] = [];
    const known = new Map<string, string>(
      (base?.variables ?? []).map((item) => [item.name, item.id] as const),
    );
    let index = 0;
    // Declarations come first: `variable "name" = N`, then optionally `show "name"`.
    while (index < all.length && all[index]!.depth === 0 && /^variable /.test(all[index]!.text)) {
      const line = all[index]!;
      const m = /^variable ("(?:[^"\\]|\\.)*") = (\S+)$/.exec(line.text);
      if (m === null) refuse("unknownLine", line.n);
      const name = quoted(m![1]!, line.n);
      const taken = new Set([...known.values(), ...variables.map((item) => item.id)]);
      const id =
        known.get(name) ??
        options.newVariableId?.(taken, variables.length + 1) ??
        `var-${variables.length + 1}`;
      known.set(name, id);
      let visible = false;
      const next = all[index + 1];
      if (next !== undefined && next.depth === 0 && next.text === `show ${JSON.stringify(name)}`) {
        visible = true;
        index += 1;
      }
      variables.push({ id, name, initialValue: numberOf(m![2]!, line.n), visible });
      index += 1;
    }
    const reader = new Reader(all.slice(index), known);
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
    const program = validateProgram({
      schema: SCHEMA_VERSION,
      ...(variables.length > 0 ? { variables } : {}),
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
