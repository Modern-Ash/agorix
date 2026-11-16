import { describe, expect, it } from "vitest";
import { validateProgram, SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { parseAgorixCode, projectAgorixCode } from "./index.js";

const num = (value: number) => ({ type: "numericLiteral", value }) as const;

const program = (): ProjectProgram =>
  validateProgram({
    schema: SCHEMA_VERSION,
    variables: [{ id: "var-1", name: "score", initialValue: 0, visible: true }],
    scripts: [
      {
        id: "script-1",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "move", steps: 40 },
          { type: "turn", degrees: 90 },
          { type: "say", text: "Hola", seconds: 2 },
          { type: "think", text: "Mmm" },
          { type: "wait", seconds: 1 },
          { type: "goTo", x: 40, y: -20 },
          { type: "setVariable", variableId: "var-1", value: num(5) },
          { type: "changeVariable", variableId: "var-1", delta: num(1) },
          { type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] },
          {
            type: "if",
            condition: { type: "keyDown", key: "Space" },
            then: [{ type: "turn", degrees: 90 }],
            else: [{ type: "hide" }],
          },
          { type: "if", condition: { type: "keyDown", key: "ArrowUp" }, then: [{ type: "show" }] },
          { type: "forever", body: [{ type: "move", steps: 40 }] },
        ],
      },
      {
        id: "script-2",
        trigger: { type: "onKeyPressed", key: "ArrowRight" },
        statements: [{ type: "show" }],
      },
      {
        id: "script-3",
        trigger: { type: "onMessage", message: "go" },
        statements: [{ type: "move", steps: 40 }],
      },
    ],
  } as never);

describe("Agorix Code read back into the program", () => {
  it("gives back the same program from the text it was shown as", () => {
    const original = program();
    const text = projectAgorixCode(original).text;
    const parsed = parseAgorixCode(text, original);
    expect(parsed).toEqual({ ok: true, program: original });
  });

  it("reads a text written by hand, and ids are made when there is no program to take them from", () => {
    const parsed = parseAgorixCode('variable "n" = 2\nwhen start\n  move 40\n  change "n" by 1\n');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.program.variables?.[0]).toMatchObject({
        id: "var-1",
        name: "n",
        initialValue: 2,
      });
      expect(parsed.program.scripts[0]!.statements).toHaveLength(2);
    }
  });

  it("keeps what an edit did not touch: ids by name and by position", () => {
    const original = program();
    const edited = projectAgorixCode(original).text.replace(
      "move 40\n  turn 90",
      "move 80\n  turn 90",
    );
    const parsed = parseAgorixCode(edited, original);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.program.scripts.map((s) => s.id)).toEqual(["script-1", "script-2", "script-3"]);
      expect(parsed.program.scripts[0]!.statements[0]).toEqual({ type: "move", steps: 80 });
      expect(parsed.program.variables?.[0]?.id).toBe("var-1");
    }
  });

  it.each([
    ["", "emptyText", 1],
    ["when start\n  jump 3\n", "unknownLine", 2],
    ["when start\n   move 3\n", "badIndent", 2],
    ["when start\n\tmove 3\n", "badIndent", 2],
    ["when start\n  move ten\n", "badNumber", 2],
    ["when start\n  say hola\n", "badText", 2],
    ['when start\n  set "x" to 1\n', "unknownName", 2],
    ["when start\n  else\n", "elseWithoutIf", 2],
    ["when start\n  repeat 2 times\n", "emptyBody", 2],
    ["when start\n    move 3\n", "badIndent", 2],
    ["move 3\n", "unknownLine", 1],
    ["when start\n  move 40000\n", "notValid", 1],
  ])("refuses %j with %s at line %i", (source, code, line) => {
    expect(parseAgorixCode(source)).toEqual({ ok: false, errors: [{ code, line }] });
  });

  it("refuses a text that is too long before reading it", () => {
    const long = `when start\n${"  move 1\n".repeat(500)}`;
    expect(parseAgorixCode(long)).toMatchObject({ ok: false, errors: [{ code: "tooLong" }] });
    expect(parseAgorixCode("x".repeat(20_001))).toMatchObject({
      ok: false,
      errors: [{ code: "tooLong" }],
    });
  });

  it("never returns a program the validator would refuse", () => {
    const parsed = parseAgorixCode("when start\n  repeat 0 times\n    move 1\n");
    expect(parsed.ok).toBe(false);
  });
});

describe("the wider subset: blocks with only words and numbers", () => {
  const whole = (statements: unknown[], extra: Record<string, unknown> = {}): ProjectProgram =>
    validateProgram({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "script-1", trigger: { type: "greenFlag" }, statements }],
      ...extra,
    } as never);
  const roundTrips = (program: ProjectProgram) =>
    expect(parseAgorixCode(projectAgorixCode(program).text, program)).toEqual({
      ok: true,
      program,
    });

  it("reads back motion blocks", () => {
    roundTrips(
      whole([
        { type: "bounceOnEdge" },
        { type: "pointInDirection", degrees: 90 },
        { type: "setX", x: 40 },
        { type: "setY", y: -40 },
        { type: "changeX", dx: 10 },
        { type: "changeY", dy: -10 },
        { type: "glideTo", x: 40, y: 0, seconds: 2 },
        { type: "goToTarget", target: "random" },
        { type: "goToTarget", target: "mouse", seconds: 1 },
        { type: "setRotationStyle", style: "leftRight" },
        { type: "setRotationStyle", style: "none" },
        { type: "setRotationStyle", style: "all" },
        { type: "goToLayer", layer: "front" },
        { type: "goToLayer", layer: "back" },
        { type: "goToLayer", layer: "forward", steps: 2 },
        { type: "goToLayer", layer: "backward", steps: 1 },
      ]),
    );
  });

  it("reads back looks and sound blocks", () => {
    roundTrips(
      whole([
        { type: "setSize", size: 150 },
        { type: "changeSize", delta: 25 },
        { type: "setEffect", effect: "ghost", value: 50 },
        { type: "changeEffect", effect: "color", delta: 25 },
        { type: "clearEffects" },
        { type: "stopSounds" },
        { type: "setVolume", volume: 60 },
        { type: "changeVolume", delta: -10 },
        { type: "resetTimer" },
        { type: "stop", scope: "script" },
      ]),
    );
  });

  it("reads back the pen and music blocks, and declares the packs they need", () => {
    const program = whole(
      [
        { type: "penDown" },
        { type: "setPenColor", color: "red" },
        { type: "setPenSize", size: 4 },
        { type: "setPenShade", shade: "darker" },
        { type: "setPenTransparency", percent: 50 },
        { type: "stamp" },
        { type: "penUp" },
        { type: "clearPen" },
        { type: "playNote", note: 60, beats: 0.5 },
        { type: "playDrum", drum: "kick", beats: 1 },
        { type: "setInstrument", instrument: "bell" },
        { type: "setTempo", bpm: 120 },
        { type: "setPitch", semitones: 2 },
        { type: "setPan", pan: -50 },
      ],
      { extensions: ["pen", "music"] },
    );
    roundTrips(program);
    expect(program.extensions).toEqual(["pen", "music"]);
  });

  it("reads back the other hats", () => {
    const program = validateProgram({
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "s1", trigger: { type: "onActorClicked" }, statements: [{ type: "show" }] },
        { id: "s2", trigger: { type: "onTimerOver", seconds: 3 }, statements: [{ type: "hide" }] },
        {
          id: "s3",
          trigger: { type: "onLoudnessOver", level: 50 },
          statements: [{ type: "show" }],
        },
        { id: "s4", trigger: { type: "onCloneStart" }, statements: [{ type: "hide" }] },
      ],
    } as never);
    roundTrips(program);
  });

  it("reads show and hide of a variable", () => {
    roundTrips(
      whole(
        [
          { type: "showVariable", variableId: "var-1" },
          { type: "hideVariable", variableId: "var-1" },
        ],
        { variables: [{ id: "var-1", name: "score", initialValue: 0, visible: false }] },
      ),
    );
  });

  it("refuses a value the scene does not know, by the validator, not by guessing", () => {
    expect(parseAgorixCode("when start\n  set pen color plaid\n")).toEqual({
      ok: false,
      errors: [{ code: "notValid", line: 1 }],
    });
  });
});

describe("conditions and expressions, read back", () => {
  const num = (value: number) => ({ type: "numericLiteral", value }) as const;
  const text = (value: string) => ({ type: "textLiteral", value }) as const;
  const score = { type: "variable", variableId: "var-1" } as const;
  const word = { type: "textVariable", variableId: "text-1" } as const;
  const whole = (statements: unknown[]): ProjectProgram =>
    validateProgram({
      schema: SCHEMA_VERSION,
      variables: [
        { id: "var-1", name: "score", initialValue: 0, visible: true },
        { id: "var-2", name: "level", initialValue: 1, visible: false, scope: "stage" },
      ],
      textVariables: [
        { id: "text-1", name: "name", initialValue: "", visible: false },
        { id: "text-2", name: "title", initialValue: "hi", visible: true, scope: "stage" },
      ],
      scripts: [{ id: "script-1", trigger: { type: "greenFlag" }, statements }],
    } as never);
  const roundTrips = (program: ProjectProgram) =>
    expect(parseAgorixCode(projectAgorixCode(program).text, program)).toEqual({
      ok: true,
      program,
    });

  it("reads calculations and the variables they use", () => {
    roundTrips(
      whole([
        {
          type: "setVariable",
          variableId: "var-1",
          value: { type: "add", left: score, right: num(2) },
        },
        {
          type: "changeVariable",
          variableId: "var-1",
          delta: {
            type: "multiply",
            left: { type: "subtract", left: score, right: num(1) },
            right: num(3),
          },
        },
        {
          type: "setVariable",
          variableId: "var-2",
          value: { type: "divide", left: num(9), right: num(2) },
        },
        {
          type: "setVariable",
          variableId: "var-1",
          value: { type: "modulo", left: score, right: num(5) },
        },
        {
          type: "setVariable",
          variableId: "var-1",
          value: { type: "mathFunction", function: "sqrt", value: num(9) },
        },
        {
          type: "setVariable",
          variableId: "var-1",
          value: { type: "randomInteger", min: num(1), max: num(6) },
        },
        {
          type: "setVariable",
          variableId: "var-1",
          value: { type: "random", min: num(1), max: num(6) },
        },
      ]),
    );
  });

  it("reads words: set a word, join, length, letter and contains", () => {
    roundTrips(
      whole([
        { type: "setText", variableId: "text-1", value: text("Ana") },
        {
          type: "setText",
          variableId: "text-1",
          value: { type: "join", left: word, right: text("!") },
        },
        { type: "setVariable", variableId: "var-1", value: { type: "textLength", value: word } },
        {
          type: "setText",
          variableId: "text-2",
          value: { type: "letterOf", index: num(1), value: word },
        },
        {
          type: "if",
          condition: { type: "textContains", text: word, part: text("a") },
          then: [{ type: "say", text: "Hola ", append: word, seconds: 2 }],
        },
      ]),
    );
  });

  it("reads conditions: comparisons, and, or, not, and the sensors", () => {
    roundTrips(
      whole([
        {
          type: "if",
          condition: {
            type: "and",
            left: { type: "greaterThan", left: score, right: num(3) },
            right: { type: "not", value: { type: "keyDown", key: "Space" } },
          },
          then: [{ type: "show" }],
          else: [{ type: "hide" }],
        },
        {
          type: "if",
          condition: {
            type: "or",
            left: { type: "lessOrEqual", left: score, right: num(1) },
            right: { type: "equals", left: score, right: num(0) },
          },
          then: [{ type: "show" }],
        },
        { type: "if", condition: { type: "touchingGoal" }, then: [{ type: "show" }] },
        {
          type: "if",
          condition: { type: "touchingActor", actorId: "actor:b" },
          then: [{ type: "show" }],
        },
        { type: "if", condition: { type: "touchingMouse" }, then: [{ type: "show" }] },
        { type: "if", condition: { type: "mouseDown" }, then: [{ type: "show" }] },
        {
          type: "if",
          condition: { type: "touchingColor", color: "red" },
          then: [{ type: "show" }],
        },
        {
          type: "if",
          condition: { type: "lessThan", left: { type: "distanceToMouse" }, right: num(50) },
          then: [{ type: "show" }],
        },
        {
          type: "if",
          condition: { type: "greaterOrEqual", left: { type: "xPosition" }, right: num(0) },
          then: [{ type: "show" }],
        },
        {
          type: "repeatUntil",
          condition: { type: "booleanLiteral", value: false },
          body: [{ type: "show" }],
        },
        { type: "waitUntil", condition: { type: "keyDown", key: "Space" } },
      ]),
    );
  });

  it("refuses an operation without its brackets, and a name that is not declared", () => {
    expect(parseAgorixCode('variable "n" = 0\nwhen start\n  set "n" to 1 + 2\n')).toEqual({
      ok: false,
      errors: [{ code: "badExpression", line: 3 }],
    });
    expect(parseAgorixCode("when start\n  if (1 < 2\n    show\n")).toMatchObject({
      ok: false,
      errors: [{ code: "badExpression", line: 2 }],
    });
    expect(parseAgorixCode('when start\n  change "ghost" by 1\n')).toMatchObject({
      ok: false,
      errors: [{ code: "unknownName" }],
    });
  });

  it("reads the stage variables and word variables of a program", () => {
    const parsed = parseAgorixCode(
      'stage variable "level" = 1\ntext "name" = "Ana"\nshow "name"\n\nwhen start\n  set "level" to 2\n',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.program.variables?.[0]).toMatchObject({ name: "level", scope: "stage" });
      expect(parsed.program.textVariables?.[0]).toMatchObject({ name: "name", visible: true });
    }
  });
});
