import { ACTOR_PROPERTIES, type Expression } from "@agorix/program-model";

/**
 * Agorix Code expressions, read back. Every operation with two sides is written inside brackets,
 * so there is no precedence to guess: `(a + b)`, `(score > 3)`, `(a and b)`. A quoted word is a
 * variable when a variable of that name is declared, and a piece of text otherwise.
 */
export interface ExpressionNames {
  /** The id of a number variable of this name, if one is declared. */
  readonly numberId: (name: string) => string | undefined;
  /** The id of a word variable of this name, if one is declared. */
  readonly textId: (name: string) => string | undefined;
  /** The id of a list of this name, if one is declared. */
  readonly listId?: (name: string) => string | undefined;
  /** The numbers the custom block being read received, with their ids; none outside a block. */
  readonly params?: () => readonly { readonly name: string; readonly id: string }[];
}

export class ExpressionError extends Error {}

const BINARY: Readonly<Record<string, Expression["type"]>> = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  mod: "modulo",
  "<": "lessThan",
  ">": "greaterThan",
  "<=": "lessOrEqual",
  ">=": "greaterOrEqual",
  "=": "equals",
  and: "and",
  or: "or",
  contains: "textContains",
};

const MATH = new Set([
  "abs",
  "round",
  "floor",
  "ceiling",
  "sqrt",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "ln",
  "log",
  "exp",
  "pow10",
]);

/** Words that stand alone, with no part after them. */
const WORDS: Readonly<Record<string, Expression>> = {
  "touching goal": { type: "touchingGoal" },
  "touching mouse": { type: "touchingMouse" },
  "distance to mouse": { type: "distanceToMouse" },
  "x position": { type: "xPosition" },
  "y position": { type: "yPosition" },
  direction: { type: "direction" },
  size: { type: "sizePercent" },
  timer: { type: "timer" },
  loudness: { type: "loudness" },
  "costume number": { type: "costumeNumber" },
  "backdrop number": { type: "backdropNumber" },
  "mouse x": { type: "mouseX" },
  "mouse y": { type: "mouseY" },
  "mouse is down": { type: "mouseDown" },
  true: { type: "booleanLiteral", value: true },
  false: { type: "booleanLiteral", value: false },
};

const MAX_DEPTH = 12;

class Cursor {
  position = 0;
  constructor(
    readonly text: string,
    private readonly names: ExpressionNames,
  ) {}

  skip(): void {
    while (this.text[this.position] === " ") this.position += 1;
  }
  get done(): boolean {
    this.skip();
    return this.position >= this.text.length;
  }
  startsWith(word: string): boolean {
    this.skip();
    if (!this.text.startsWith(word, this.position)) return false;
    // A word must end where the next character is not part of a word.
    const next = this.text[this.position + word.length];
    return (
      !/^[A-Za-z0-9_]$/.test(word.at(-1) ?? "") || next === undefined || !/[A-Za-z0-9_]/.test(next)
    );
  }
  take(word: string): boolean {
    if (!this.startsWith(word)) return false;
    this.position += word.length;
    return true;
  }
  list(): string {
    const id = this.names.listId?.(this.quoted());
    if (id === undefined) throw new ExpressionError("unknown list");
    return id;
  }

  expect(word: string): void {
    if (!this.take(word)) throw new ExpressionError(`expected ${word}`);
  }

  quoted(): string {
    this.skip();
    const match = /^"(?:[^"\\]|\\.)*"/.exec(this.text.slice(this.position));
    if (match === null) throw new ExpressionError("expected text");
    this.position += match[0].length;
    return JSON.parse(match[0]) as string;
  }

  number(): number {
    this.skip();
    const match = /^-?\d+(?:\.\d+)?/.exec(this.text.slice(this.position));
    if (match === null) throw new ExpressionError("expected a number");
    this.position += match[0].length;
    return Number(match[0]);
  }

  expression(depth: number): Expression {
    if (depth > MAX_DEPTH) throw new ExpressionError("too deep");
    this.skip();
    const here = this.text[this.position];
    if (here === "(") {
      this.position += 1;
      const left = this.expression(depth + 1);
      this.skip();
      const op = Object.keys(BINARY)
        .sort((a, b) => b.length - a.length)
        .find((candidate) => this.startsWith(candidate));
      if (op === undefined) throw new ExpressionError("expected an operator");
      this.position += op.length;
      const right = this.expression(depth + 1);
      this.expect(")");
      const type = BINARY[op]!;
      return type === "textContains"
        ? { type, text: left, part: right }
        : ({ type, left, right } as unknown as Expression);
    }
    if (here === '"') {
      const value = this.quoted();
      if (this.startsWith('of "')) {
        this.take("of ");
        const variableId = this.names.numberId(value) ?? this.names.textId(value);
        if (variableId === undefined) throw new ExpressionError("unknown variable");
        return {
          type: "actorProperty",
          actorId: this.quoted(),
          property: "variable",
          variableId,
        } as Expression;
      }
      const listId = this.names.listId?.(value);
      if (listId !== undefined && this.startsWith("contains ")) {
        this.take("contains ");
        return { type: "listContains", listId, value: this.expression(depth + 1) };
      }
      const id = this.names.numberId(value);
      if (id !== undefined) return { type: "variable", variableId: id };
      const textId = this.names.textId(value);
      if (textId !== undefined) return { type: "textVariable", variableId: textId };
      return { type: "textLiteral", value };
    }
    if (here !== undefined && /[-\d]/.test(here))
      return { type: "numericLiteral", value: this.number() };
    if (this.take("not ")) return { type: "not", value: this.expression(depth + 1) };
    if (this.take("join(")) {
      const left = this.expression(depth + 1);
      this.expect(",");
      const right = this.expression(depth + 1);
      this.expect(")");
      return { type: "join", left, right };
    }
    if (this.take("item # of ")) {
      const value = this.expression(depth + 1);
      this.expect("in ");
      return { type: "listIndexOf", listId: this.list(), value };
    }
    if (this.take("item ")) {
      const index = this.expression(depth + 1);
      this.expect("of ");
      return { type: "listItem", listId: this.list(), index };
    }
    if (this.take("length of ")) {
      const mark = this.position;
      this.skip();
      if (this.text[this.position] === '"') {
        const id = this.names.listId?.(this.quoted());
        if (id !== undefined) return { type: "listLength", listId: id };
      }
      this.position = mark;
      return { type: "textLength", value: this.expression(depth + 1) };
    }
    if (this.take("letter ")) {
      const index = this.expression(depth + 1);
      this.expect("of ");
      return { type: "letterOf", index, value: this.expression(depth + 1) };
    }
    if (this.take("random whole number ")) {
      const min = this.expression(depth + 1);
      this.expect("to ");
      return { type: "randomInteger", min, max: this.expression(depth + 1) };
    }
    if (this.take("random ")) {
      const min = this.expression(depth + 1);
      this.expect("to ");
      return { type: "random", min, max: this.expression(depth + 1) };
    }
    if (this.take("key ")) {
      const match = /^(\S+) is down/.exec(this.text.slice(this.position));
      if (match === null) throw new ExpressionError("expected a key");
      this.position += match[0].length;
      return { type: "keyDown", key: match[1]! };
    }
    if (this.take("touching color ")) {
      const match = /^\w+/.exec(this.text.slice(this.position));
      if (match === null) throw new ExpressionError("expected a colour");
      this.position += match[0].length;
      return { type: "touchingColor", color: match[0] } as unknown as Expression;
    }
    if (this.take("touching edge ")) {
      const match = /^(-?[\d.]+)\.\.(-?[\d.]+), (-?[\d.]+)\.\.(-?[\d.]+)/.exec(
        this.text.slice(this.position),
      );
      if (match === null) throw new ExpressionError("expected an edge");
      this.position += match[0].length;
      return {
        type: "touchingStageEdge",
        minX: Number(match[1]),
        maxX: Number(match[2]),
        minY: Number(match[3]),
        maxY: Number(match[4]),
      };
    }
    if (this.startsWith('touching "')) {
      this.take("touching ");
      return { type: "touchingActor", actorId: this.quoted() };
    }
    if (this.take("distance to ")) {
      if (this.take("mouse")) return { type: "distanceToMouse" };
      return { type: "distanceToActor", actorId: this.quoted() };
    }
    if (this.take("current ")) {
      const match = /^\w+/.exec(this.text.slice(this.position));
      if (match === null) throw new ExpressionError("expected a part of the clock");
      this.position += match[0].length;
      return { type: "currentTime", part: match[0] } as unknown as Expression;
    }
    const property = /^[A-Za-z]+(?= of ")/.exec(this.text.slice(this.position))?.[0];
    if (property !== undefined && (ACTOR_PROPERTIES as readonly string[]).includes(property)) {
      this.position += property.length;
      this.expect("of ");
      return { type: "actorProperty", actorId: this.quoted(), property } as Expression;
    }
    // A number a custom block received, written as its name.
    const params = [...(this.names.params?.() ?? [])].sort((a, b) => b.name.length - a.name.length);
    for (const param of params) {
      if (this.take(param.name)) return { type: "param", paramId: param.id } as Expression;
    }
    // A math function (`round 3`, `sqrt 9`) and the words that stand alone.
    const word = /^[A-Za-z0-9]+/.exec(this.text.slice(this.position))?.[0];
    if (word !== undefined && MATH.has(word) && this.text[this.position + word.length] === " ") {
      this.position += word.length;
      return {
        type: "mathFunction",
        function: word,
        value: this.expression(depth + 1),
      } as unknown as Expression;
    }
    for (const key of Object.keys(WORDS).sort((a, b) => b.length - a.length)) {
      if (this.take(key)) return WORDS[key]!;
    }
    throw new ExpressionError("unknown expression");
  }
}

/** Reads all of `text` as one expression; anything left over is an error. */
export function parseExpression(text: string, names: ExpressionNames): Expression {
  const cursor = new Cursor(text, names);
  const expression = cursor.expression(0);
  if (!cursor.done) throw new ExpressionError("unexpected text after the expression");
  return expression;
}
