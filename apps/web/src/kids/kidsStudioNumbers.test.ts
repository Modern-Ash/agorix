import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  addStudioProcedureNumber,
  addStudioVariable,
  appendStudioStatement,
  bindStudioProcedureBlock,
  createStudioProcedure,
  createStudioProgram,
  creativeForStudio,
  deleteStudioProcedure,
  removeStudioProcedureNumber,
  setStudioCallNumbers,
  studioBlockNumber,
  studioProcedureNumberUnits,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const nova = "actor:studio-1-nova";

function stepsBlock() {
  let history = createEditorHistory(createStudioProgram("nova"));
  history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
  history = appendStudioStatement(history, nova, { type: "turn", degrees: 90 });
  return createStudioProcedure(history, nova, 2, "Paso", ["Largo"]);
}

function xOf(history: ReturnType<typeof stepsBlock>): number {
  const program = validateStudioProgram(history.current);
  return runMultiActorProgram(program, creativeForStudio(program, "forest", "es")).actors[0]!.world
    .sprite.x;
}

describe("Mis bloques numbers", () => {
  it("creates a block with a titled number and gives its call a placeholder value", () => {
    const script = stepsBlock().current.scripts[0]!;
    expect(script.procedures?.[0]?.params).toEqual([{ id: "p1", name: "Largo" }]);
    expect(script.statements).toEqual([
      {
        type: "callProcedure",
        procedureId: "proc-1-1",
        args: [{ type: "numericLiteral", value: 0 }],
      },
    ]);
  });

  it("keeps behaviour when a block first follows a number, then lets each call choose", () => {
    const before = xOf(stepsBlock());
    let history = bindStudioProcedureBlock(stepsBlock(), nova, "proc-1-1", [0], "p1");
    expect(history.current.scripts[0]?.statements[0]).toMatchObject({
      args: [{ type: "numericLiteral", value: 40 }],
    });
    expect(xOf(history)).toBe(before);
    history = setStudioCallNumbers(history, nova, 0, [100]);
    expect(xOf(history)).toBe(before + 60);
    const undone = undoCanonicalTransaction(history).history;
    expect(xOf(undone)).toBe(before);
  });

  it("reports the unit of each number from the first block that uses it", () => {
    const history = bindStudioProcedureBlock(stepsBlock(), nova, "proc-1-1", [0], "p1");
    const procedure = history.current.scripts[0]!.procedures![0]!;
    expect(studioProcedureNumberUnits(procedure)).toEqual(["steps"]);
    expect(studioBlockNumber(procedure.body[0]!)).toBe("p1");
    expect(studioBlockNumber(procedure.body[1]!)).toBeNull();
  });

  it("binds expression slots inside a repeat and keeps them valid", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Puntos");
    history = appendStudioStatement(history, nova, {
      type: "repeat",
      count: 2,
      body: [
        {
          type: "changeVariable",
          variableId: "studio-var-1",
          delta: { type: "numericLiteral", value: 5 },
        },
      ],
    });
    history = appendStudioStatement(history, nova, { type: "say", text: "Hola" });
    history = createStudioProcedure(history, nova, 2, "Sumar", ["Cuánto"]);
    history = bindStudioProcedureBlock(history, nova, "proc-1-1", [0, 0], "p1");
    history = bindStudioProcedureBlock(history, nova, "proc-1-1", [0], "p1");
    expect(() => validateStudioProgram(history.current)).not.toThrow();
    history = setStudioCallNumbers(history, nova, 0, [3]);
    const program = validateStudioProgram(history.current);
    const world = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"))
      .actors[0]!.world;
    expect(world.variables?.["studio-var-1"]?.value).toBe(9);
  });

  it("rejects numbers a block cannot use and calls with the wrong count", () => {
    const history = stepsBlock();
    expect(() => bindStudioProcedureBlock(history, nova, "proc-1-1", [0], "p2")).toThrow();
    expect(() => setStudioCallNumbers(history, nova, 0, [1, 2])).toThrow();
    expect(() => addStudioProcedureNumber(history, nova, "proc-1-1", "Largo")).toThrow();
    expect(() =>
      validateStudioProgram({
        ...history.current,
        scripts: [
          {
            ...history.current.scripts[0]!,
            statements: [{ type: "move", steps: 20, stepsFrom: "p1" }],
          },
        ],
      }),
    ).toThrow();
  });

  it("adds up to three numbers and removes one without changing behaviour", () => {
    let history = bindStudioProcedureBlock(stepsBlock(), nova, "proc-1-1", [0], "p1");
    history = addStudioProcedureNumber(history, nova, "proc-1-1", "Giro");
    history = bindStudioProcedureBlock(history, nova, "proc-1-1", [1], "p2");
    history = addStudioProcedureNumber(history, nova, "proc-1-1", "Tercero");
    expect(() => addStudioProcedureNumber(history, nova, "proc-1-1", "Cuarto")).toThrow();
    const before = xOf(history);
    history = removeStudioProcedureNumber(history, nova, "proc-1-1", "p1");
    const procedure = history.current.scripts[0]!.procedures![0]!;
    expect(procedure.params?.map((item) => [item.id, item.name])).toEqual([
      ["p1", "Giro"],
      ["p2", "Tercero"],
    ]);
    expect(procedure.body).toEqual([
      { type: "move", steps: 40 },
      { type: "turn", degrees: 90, degreesFrom: "p1" },
    ]);
    expect(history.current.scripts[0]?.statements[0]).toMatchObject({
      args: [
        { type: "numericLiteral", value: 90 },
        { type: "numericLiteral", value: 0 },
      ],
    });
    expect(xOf(history)).toBe(before);
  });

  it("inlines a numbered call with its own values", () => {
    let history = bindStudioProcedureBlock(stepsBlock(), nova, "proc-1-1", [0], "p1");
    history = setStudioCallNumbers(history, nova, 0, [100]);
    const before = xOf(history);
    history = deleteStudioProcedure(history, nova, "proc-1-1", "inline");
    expect(history.current.scripts[0]?.procedures).toBeUndefined();
    expect(history.current.scripts[0]?.statements[0]).toEqual({ type: "move", steps: 100 });
    expect(xOf(history)).toBe(before);
  });
});
