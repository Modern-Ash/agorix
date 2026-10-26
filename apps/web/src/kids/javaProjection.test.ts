import { spawnSync } from "node:child_process"; // agora-allowlist: test-only use of the local Java compiler on fixed, generated source files
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { JAVA_SUPPORT_API, JAVA_SUPPORT_STUB, projectJava } from "@agorix/java-projection";
import {
  SCHEMA_VERSION,
  type Expression,
  type NumericLiteralExpression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import {
  RUNTIME_EXPRESSION_OPERATIONS,
  RUNTIME_STATEMENT_OPERATIONS,
  RUNTIME_TRIGGER_OPERATIONS,
} from "@agorix/runtime";
import {
  addStudioActor,
  addStudioList,
  addStudioVariable,
  appendStudioStatement,
  createStudioProcedure,
  createStudioProgram,
  wrapStudioTail,
} from "./kidsStudioModel.js";

// Issues #627 to #630: the Java view covers the whole canonical vocabulary, with no unsupported node,
// and what it prints is valid Java against the support API.
const num = (value: number): NumericLiteralExpression => ({ type: "numericLiteral", value });
const variable: Expression = { type: "variable", variableId: "v" };
const bool = (value: boolean): Expression => ({ type: "booleanLiteral", value });

const statements: Statement[] = [
  { type: "move", steps: 40 },
  { type: "goTo", x: 10, y: 20 },
  { type: "glideTo", x: 5, y: 5, seconds: 1 },
  { type: "turn", degrees: 90 },
  { type: "pointInDirection", degrees: 0 },
  { type: "pointTowards", actorId: "actor:other" },
  { type: "bounceOnEdge" },
  { type: "goToLayer", layer: "front" },
  { type: "setEffect", effect: "color", value: 25 },
  { type: "changeEffect", effect: "ghost", delta: 25 },
  { type: "clearEffects" },
  { type: "say", text: 'Hola "mundo"' },
  { type: "think", text: "Mmm" },
  { type: "show" },
  { type: "hide" },
  { type: "setSize", size: 120 },
  { type: "changeSize", delta: -25 },
  { type: "wait", seconds: 0.5 },
  { type: "switchCostume", costumeId: "costume:luma" },
  { type: "switchBackdrop", backdropId: "backdrop:forest" },
  { type: "playSound", soundId: "kids:pop" },
  { type: "stopSounds" },
  { type: "setVolume", volume: 80 },
  { type: "changeVolume", delta: -10 },
  { type: "broadcast", message: "hola" },
  { type: "setVariable", variableId: "v", value: num(3) },
  {
    type: "changeVariable",
    variableId: "v",
    delta: { type: "add", left: variable, right: num(1) },
  },
  { type: "showVariable", variableId: "v" },
  { type: "hideVariable", variableId: "v" },
  { type: "listAdd", listId: "l", value: bool(true) },
  { type: "listRemoveAt", listId: "l", index: num(1) },
  { type: "listInsertAt", listId: "l", index: num(1), value: { type: "listLength", listId: "l" } },
  {
    type: "listReplaceAt",
    listId: "l",
    index: num(1),
    value: { type: "listItem", listId: "l", index: num(1) },
  },
  { type: "penDown" },
  { type: "setPenColor", color: "red" },
  { type: "setPenSize", size: 8 },
  { type: "penUp" },
  { type: "clearPen" },
  { type: "callProcedure", procedureId: "p", args: [num(40), num(3)] },
  { type: "callProcedure", procedureId: "q" },
  { type: "repeat", count: 2, body: [{ type: "move", steps: 20 }] },
  {
    type: "repeatUntil",
    condition: {
      type: "or",
      left: { type: "touchingGoal" },
      right: { type: "touchingStageEdge", minX: 0, maxX: 320, minY: -100, maxY: 120 },
    },
    body: [{ type: "move", steps: 20 }],
  },
  {
    type: "if",
    condition: {
      type: "and",
      left: { type: "not", value: { type: "touchingActor", actorId: "actor:other" } },
      right: {
        type: "greaterOrEqual",
        left: { type: "distanceToActor", actorId: "actor:other" },
        right: { type: "add", left: { type: "xPosition" }, right: { type: "yPosition" } },
      },
    },
    then: [
      {
        type: "setVariable",
        variableId: "v",
        value: {
          type: "subtract",
          left: { type: "multiply", left: { type: "timer" }, right: num(2) },
          right: {
            type: "divide",
            left: num(9),
            right: { type: "modulo", left: num(7), right: num(4) },
          },
        },
      },
    ],
    else: [
      {
        type: "setVariable",
        variableId: "v",
        value: {
          type: "add",
          left: {
            type: "mathFunction",
            function: "ceiling",
            value: { type: "random", min: num(0), max: num(1) },
          },
          right: { type: "randomInteger", min: num(1), max: num(6) },
        },
      },
      {
        type: "if",
        condition: {
          type: "or",
          left: { type: "lessThan", left: variable, right: num(1) },
          right: {
            type: "and",
            left: { type: "lessOrEqual", left: variable, right: num(2) },
            right: { type: "equals", left: variable, right: { type: "keyDown", key: "Space" } },
          },
        },
        then: [
          {
            type: "if",
            condition: { type: "greaterThan", left: { type: "xPosition" }, right: num(0) },
            then: [{ type: "show" }],
          },
        ],
      },
    ],
  },
];

const everything: ProjectProgram = {
  schema: SCHEMA_VERSION,
  extensions: ["pen"],
  variables: [{ id: "v", name: "Puntos", initialValue: 0, visible: true }],
  lists: [{ id: "l", name: "Tesoros", initialItems: [1, 2.5], visible: true }],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements,
      procedures: [
        {
          id: "p",
          name: "Cuadrado",
          params: [
            { id: "p1", name: "Lado" },
            { id: "p2", name: "Veces" },
          ],
          body: [
            {
              type: "repeat",
              count: 4,
              countFrom: "p2",
              body: [
                { type: "move", steps: 40, stepsFrom: "p1" },
                { type: "turn", degrees: 90 },
              ],
            },
            { type: "wait", seconds: 1, secondsFrom: "p1" },
            { type: "turn", degrees: 45, degreesFrom: "p2" },
            { type: "setVariable", variableId: "v", value: { type: "param", paramId: "p1" } },
          ],
        },
        {
          id: "q",
          name: "Cuadrado",
          body: [{ type: "callProcedure", procedureId: "p", args: [num(20), num(2)] }],
        },
      ],
    },
    {
      id: "k",
      trigger: { type: "onKeyPressed", key: "Space" },
      statements: [{ type: "say", text: "tecla" }],
    },
    { id: "c", trigger: { type: "onActorClicked" }, statements: [{ type: "say", text: "clic" }] },
    {
      id: "m",
      trigger: { type: "onMessage", message: "hola" },
      statements: [{ type: "say", text: "mensaje" }],
    },
    { id: "o", trigger: { type: "onStart" }, statements: [{ type: "show" }] },
  ],
};

function walk(node: unknown, found: Set<string>): void {
  if (Array.isArray(node)) node.forEach((item) => walk(item, found));
  else if (node && typeof node === "object") {
    const type = (node as { type?: unknown }).type;
    if (typeof type === "string") found.add(type);
    Object.values(node).forEach((value) => walk(value, found));
  }
}

const nova = "actor:studio-1-nova";
function studioScene(): ProjectProgram {
  let history = addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");
  history = addStudioVariable(history, "Puntos");
  history = addStudioList(history, "Tesoros");
  for (const statement of [
    { type: "penDown" },
    { type: "setPenColor", color: "blue" },
    { type: "move", steps: 40 },
    { type: "turn", degrees: 90 },
    { type: "say", text: "Hola" },
    { type: "move", steps: 40 },
    {
      type: "if",
      condition: { type: "keyDown", key: "ArrowRight" },
      then: [{ type: "move", steps: 40 }],
    },
    { type: "setVariable", variableId: "studio-var-1", value: { type: "timer" } },
  ] as const)
    history = appendStudioStatement(history, nova, statement);
  history = wrapStudioTail(history, nova, 2, { type: "repeat", times: 3 });
  history = appendStudioStatement(history, nova, { type: "move", steps: 20 });
  history = appendStudioStatement(history, nova, { type: "move", steps: 20 });
  return createStudioProcedure(history, nova, 2, "Paso", ["Largo"]).current;
}

function javac(source: string): { ok: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), "agorix-java-"));
  try {
    writeFileSync(join(dir, "Sprite.java"), JAVA_SUPPORT_STUB);
    writeFileSync(join(dir, "AgorixProgram.java"), source);
    const result = spawnSync(
      "javac",
      ["-Xlint:none", "-d", join(dir, "out"), "Sprite.java", "AgorixProgram.java"],
      {
        cwd: dir,
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const hasJavac = spawnSync("javac", ["-version"], { encoding: "utf8" }).status === 0;

describe("Java projection corpus", () => {
  it("uses every statement, expression and trigger the runtime can run, so coverage is complete", () => {
    const found = new Set<string>();
    walk(everything, found);
    const missing = [
      ...RUNTIME_STATEMENT_OPERATIONS,
      ...RUNTIME_EXPRESSION_OPERATIONS,
      ...RUNTIME_TRIGGER_OPERATIONS,
    ].filter((operation) => !found.has(operation));
    expect(missing).toEqual([]);
  });

  it("projects the whole vocabulary and a real Escena libre scene with no unsupported node", () => {
    for (const program of [everything, studioScene()]) {
      const result = projectJava(program);
      expect(result.diagnostics).toEqual([]);
      expect(result.text).not.toContain("is not available in this Java view");
    }
  });

  it("keeps the support API list in step with the stub it compiles against", () => {
    const declared = [...JAVA_SUPPORT_STUB.matchAll(/^\s+(?:void|double|boolean) (\w+)\(/gm)].map(
      (match) => match[1],
    );
    expect([...declared].sort()).toEqual([...JAVA_SUPPORT_API].sort());
  });

  it.skipIf(!hasJavac)("is valid Java that compiles against the support API", () => {
    for (const [name, program] of [
      ["whole vocabulary", everything],
      ["Escena libre scene", studioScene()],
    ] as const) {
      const result = javac(projectJava(program).text);
      expect(result.output, name).toBe("");
      expect(result.ok, name).toBe(true);
    }
  });
});
