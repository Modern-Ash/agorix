import { describe, expect, it } from "vitest";
import { createEditorHistory, undoCanonicalTransaction } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  setStudioTrigger,
  validateStudioProgram,
  addStudioVariable,
  addStudioList,
  wrapStudioTail,
} from "./kidsStudioModel.js";

describe("Kids creative studio", () => {
  it("reads list values and length, then removes a bounded position", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Resultado");
    history = addStudioList(history, "Tesoros");
    for (const value of [7, 9])
      history = appendStudioStatement(history, "actor:studio-1-nova", {
        type: "listAdd",
        listId: "studio-list-1",
        value: { type: "numericLiteral", value },
      });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "listItem",
        listId: "studio-list-1",
        index: { type: "numericLiteral", value: 2 },
      },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "listRemoveAt",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: 1 },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "listLength", listId: "studio-list-1" },
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.lists?.["studio-list-1"]?.items).toEqual([9]);
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(1);
    expect(result.trace.map((entry) => entry.statementType)).toContain("listRemoveAt");
    for (const index of [0, 11, 1.5])
      expect(() =>
        appendStudioStatement(history, "actor:studio-1-nova", {
          type: "listRemoveAt",
          listId: "studio-list-1",
          index: { type: "numericLiteral", value: index },
        }),
      ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "setVariable",
        variableId: "studio-var-1",
        value: { type: "listItem", listId: "missing", index: { type: "numericLiteral", value: 1 } },
      }),
    ).toThrow();
  });
  it("keeps each chosen character's program independent and derives the stage from canonical scripts", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = appendStudioStatement(history, "actor:studio-2-mika", {
      type: "move",
      steps: 40,
    });
    const creative = creativeForStudio(history.current, "forest", "es");
    expect(creative.actors?.map((actor) => actor.id)).toEqual([
      "actor:studio-1-nova",
      "actor:studio-2-mika",
    ]);
    expect(creative.stage?.backdropId).toBe("backdrop:forest");
    const result = runMultiActorProgram(history.current, creative);
    expect(result.actors.find((actor) => actor.id === "actor:studio-1-nova")?.world.sprite.x).toBe(
      0,
    );
    expect(result.actors.find((actor) => actor.id === "actor:studio-2-mika")?.world.sprite.x).toBe(
      100,
    );
    const undone = undoCanonicalTransaction(history).history;
    expect(undone.current.scripts[1]?.statements).toEqual([]);
  });

  it("can change an included costume, backdrop and sound without accepting invalid assets", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "switchCostume",
      costumeId: "costume:mika",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "switchBackdrop",
      backdropId: "backdrop:moon",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "playSound",
      soundId: "kids:splash",
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite.costumeId).toBe("costume:mika");
    expect(result.stage.backdropId).toBe("backdrop:moon");
    expect(result.trace.some((entry) => entry.statementType === "playSound")).toBe(true);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "switchBackdrop",
        backdropId: "backdrop:invented",
      }),
    ).toThrow();
    expect(() =>
      validateStudioProgram({
        ...history.current,
        scripts: [
          ...history.current.scripts,
          { id: "studio-actor-3-evil", trigger: { type: "greenFlag" }, statements: [] },
        ],
      }),
    ).toThrow();
  });

  it("runs bounded looks and wait blocks on the selected character only", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    for (const statement of [
      { type: "say", text: "¡Hola!" },
      { type: "setSize", size: 150 },
      { type: "hide" },
      { type: "wait", seconds: 1 },
      { type: "show" },
      { type: "think", text: "¿Y ahora?" },
    ] as const)
      history = appendStudioStatement(history, "actor:studio-2-mika", statement);
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite.bubble).toBeUndefined();
    expect(result.actors[1]?.world.sprite).toMatchObject({
      visible: true,
      size: 150,
      bubble: { kind: "think", text: "¿Y ahora?" },
    });
    expect(result.trace.map((entry) => entry.statementType)).toContain("wait");
    expect(() =>
      appendStudioStatement(history, "actor:studio-2-mika", { type: "say", text: " " }),
    ).toThrow();
  });

  it("runs a character click script only after that character is tapped", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = setStudioTrigger(history, "actor:studio-2-mika", "onActorClicked");
    history = appendStudioStatement(history, "actor:studio-2-mika", { type: "say", text: "Hola" });
    const creative = creativeForStudio(history.current, "forest", "es");
    expect(runMultiActorProgram(history.current, creative).trace).toHaveLength(0);
    const clicked = runMultiActorProgram(history.current, creative, {
      events: [{ type: "start" }, { type: "actorClicked", actorId: "actor:studio-2-mika" }],
    });
    expect(clicked.trace.map((entry) => [entry.actorId, entry.statementType])).toEqual([
      ["actor:studio-2-mika", "say"],
    ]);
    expect(clicked.actors[1]?.world.sprite.bubble?.text).toBe("Hola");
  });

  it("composes bounded repeat and condition blocks from canonical data", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Puntos");
    history = addStudioList(history, "Tesoros");
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "numericLiteral", value: 2 },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "repeat",
      count: 3,
      body: [
        { type: "listAdd", listId: "studio-list-1", value: { type: "numericLiteral", value: 1 } },
      ],
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "if",
      condition: {
        type: "greaterThan",
        left: { type: "variable", variableId: "studio-var-1" },
        right: { type: "numericLiteral", value: 1 },
      },
      then: [{ type: "move", steps: 40 }],
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite.x).toBe(40);
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(2);
    expect(result.actors[0]?.world.lists?.["studio-list-1"]?.items).toEqual([1, 1, 1]);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "repeat",
        count: 1000,
        body: [{ type: "move", steps: 40 }],
      }),
    ).toThrow();
  });

  it("starts scripts from a key or another actor's message and rejects unknown events", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "broadcast",
      message: "vamos",
    });
    history = setStudioTrigger(history, "actor:studio-2-mika", {
      type: "onMessage",
      message: "vamos",
    });
    history = appendStudioStatement(history, "actor:studio-2-mika", { type: "move", steps: 40 });
    const creative = creativeForStudio(history.current, "forest", "es");
    expect(runMultiActorProgram(history.current, creative).actors[1]?.world.sprite.x).toBe(100);
    history = setStudioTrigger(history, "actor:studio-1-nova", {
      type: "onKeyPressed",
      key: "Space",
    });
    expect(
      runMultiActorProgram(history.current, creativeForStudio(history.current, "forest", "es"))
        .trace,
    ).toHaveLength(0);
    expect(
      runMultiActorProgram(history.current, creativeForStudio(history.current, "forest", "es"), {
        events: [{ type: "start" }, { type: "keyPressed", key: "Space" }],
      }).actors[1]?.world.sprite.x,
    ).toBe(100);
    expect(() =>
      setStudioTrigger(history, "actor:studio-1-nova", { type: "onKeyPressed", key: "Escape" }),
    ).toThrow();
  });

  it("groups the child's last blocks and evaluates a composed calculation deterministically", () => {
    const actor = "actor:studio-1-nova";
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Puntos");
    history = appendStudioStatement(history, actor, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "numericLiteral", value: 2 },
    });
    history = appendStudioStatement(history, actor, { type: "move", steps: -40 });
    history = appendStudioStatement(history, actor, { type: "turn", degrees: 45 });
    history = wrapStudioTail(history, actor, 2, { type: "repeat", times: 3 });
    expect(history.current.scripts[0]?.statements[1]).toMatchObject({
      type: "repeat",
      body: [
        { type: "move", steps: -40 },
        { type: "turn", degrees: 45 },
      ],
    });
    history = appendStudioStatement(history, actor, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "add",
        left: { type: "variable", variableId: "studio-var-1" },
        right: { type: "numericLiteral", value: 3 },
      },
    });
    history = appendStudioStatement(history, actor, { type: "move", steps: 40 });
    history = wrapStudioTail(history, actor, 2, {
      type: "if",
      condition: {
        type: "lessThan",
        left: { type: "variable", variableId: "studio-var-1" },
        right: { type: "numericLiteral", value: 6 },
      },
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(5);
    expect(result.trace.filter((entry) => entry.statementType === "move")).toHaveLength(4);
    expect(result.trace.filter((entry) => entry.statementType === "turn")).toHaveLength(3);
    expect(undoCanonicalTransaction(history).history.current.scripts[0]?.statements).toHaveLength(
      4,
    );
  });

  it("rejects oversized, too-deep, or unsafe groups without mutating history", () => {
    const actor = "actor:studio-1-nova";
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Puntos");
    for (let i = 0; i < 4; i++)
      history = appendStudioStatement(history, actor, { type: "move", steps: 40 });
    expect(() => wrapStudioTail(history, actor, 4, { type: "repeat", times: 3 })).toThrow();
    expect(() => wrapStudioTail(history, actor, 2, { type: "repeat", times: 3 })).not.toThrow();
    expect(history.current.scripts[0]?.statements).toHaveLength(4);
    expect(() =>
      appendStudioStatement(history, actor, {
        type: "setVariable",
        variableId: "studio-var-1",
        value: {
          type: "divide",
          left: { type: "variable", variableId: "studio-var-1" },
          right: { type: "numericLiteral", value: 0 },
        },
      }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, actor, {
        type: "setVariable",
        variableId: "studio-var-1",
        value: {
          type: "divide",
          left: { type: "numericLiteral", value: 4 },
          right: { type: "variable", variableId: "studio-var-1" },
        },
      }),
    ).toThrow();
    expect(() =>
      validateStudioProgram({
        ...history.current,
        scripts: [
          {
            ...history.current.scripts[0]!,
            statements: [
              {
                type: "repeat",
                count: 3,
                body: [
                  {
                    type: "repeat",
                    count: 3,
                    body: [{ type: "repeat", count: 3, body: [{ type: "move", steps: 40 }] }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
