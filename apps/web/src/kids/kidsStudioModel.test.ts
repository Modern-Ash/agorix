import { describe, expect, it } from "vitest";
import {
  createEditorHistory,
  programToWorkspace,
  undoCanonicalTransaction,
  workspaceToProgram,
} from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectPython } from "@agorix/python-projection";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  addStudioActor,
  STUDIO_EDGE_CONDITION,
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  setStudioTrigger,
  validateStudioProgram,
  addStudioVariable,
  addStudioList,
  wrapStudioTail,
  createStudioProcedure,
  removeStudioStatement,
  renameStudioProcedure,
  deleteStudioProcedure,
  studioProcedureUses,
} from "./kidsStudioModel.js";

describe("Kids creative studio", () => {
  it("keeps edge and distance sensors canonical, bounded and projectable", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = addStudioVariable(history, "Distancia");
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "if",
      condition: STUDIO_EDGE_CONDITION,
      then: [{ type: "say", text: "Borde" }],
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "distanceToActor", actorId: "actor:studio-2-mika" },
    });
    const program = validateStudioProgram(history.current);
    expect(workspaceToProgram(programToWorkspace(program).workspace).program).toEqual(program);
    expect(projectAgorixCode(program).text).toContain("touching edge 0..320, -100..120");
    expect(projectPython(program).text).toContain("distance_to_actor");
    expect(projectProgram(program).code).toContain("sprite.touchingStageEdge");
    const result = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(60);
    expect(result.actors[0]?.world.sprite.bubble?.text).toBe("Borde");
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "if",
        condition: { ...STUDIO_EDGE_CONDITION, maxX: 400 },
        then: [{ type: "move", steps: 40 }],
      }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "setVariable",
        variableId: "studio-var-1",
        value: { type: "distanceToActor", actorId: "actor:unknown" },
      }),
    ).toThrow();
  });
  it("lets one character sense its position and a different visible character", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = addStudioVariable(history, "Lugar");
    history = appendStudioStatement(history, "actor:studio-1-nova", { type: "goTo", x: 40, y: 0 });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "xPosition" },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "if",
      condition: { type: "touchingActor", actorId: "actor:studio-2-mika" },
      then: [{ type: "say", text: "Juntos" }],
    });
    const program = validateStudioProgram(history.current);
    expect(workspaceToProgram(programToWorkspace(program).workspace).program).toEqual(program);
    expect(projectAgorixCode(program).text).toContain('touching "actor:studio-2-mika"');
    expect(projectPython(program).text).toContain('touching_actor("actor:studio-2-mika")');
    expect(projectProgram(program).code).toContain('sprite.touchingActor("actor:studio-2-mika")');
    const result = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(40);
    expect(result.actors[0]?.world.sprite.bubble?.text).toBe("Juntos");
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "if",
        condition: { type: "touchingActor", actorId: "actor:missing" },
        then: [{ type: "move", steps: 40 }],
      }),
    ).toThrow();
  });
  it("moves to a chosen stage coordinate and stops sounds with canonical runtime evidence", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "goTo",
      x: 240,
      y: -40,
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "playSound",
      soundId: "kids:pop",
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", { type: "stopSounds" });
    const program = validateStudioProgram(history.current);
    expect(workspaceToProgram(programToWorkspace(program).workspace).program).toEqual(program);
    expect(projectAgorixCode(program).text).toContain("go to 240, -40");
    expect(projectPython(program).text).toContain("go_to(240, -40)");
    expect(projectProgram(program).code).toContain("sprite.goTo(240, -40)");
    const result = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(result.actors[0]?.world.sprite).toMatchObject({ x: 240, y: -40 });
    expect(result.actors[0]?.world.sounds?.activeSoundIds).toEqual([]);
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "goTo",
      "playSound",
      "stopSounds",
    ]);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", { type: "goTo", x: 321, y: 0 }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", { type: "goTo", x: 20, y: Number.NaN }),
    ).toThrow();
  });
  it("executes bounded sound volume and a variable watcher that the child can hide and show", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Puntos");
    for (const statement of [
      { type: "setVolume", volume: 40 },
      { type: "changeVolume", delta: -15 },
      { type: "hideVariable", variableId: "studio-var-1" },
      { type: "showVariable", variableId: "studio-var-1" },
    ] as const)
      history = appendStudioStatement(history, "actor:studio-1-nova", statement);
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sounds?.volume).toBe(25);
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "setVolume",
      "changeVolume",
      "hideVariable",
      "showVariable",
    ]);
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.visible).toBe(true);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "setVolume",
        volume: 101,
      }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "hideVariable",
        variableId: "missing",
      }),
    ).toThrow();
  });
  it("accepts bounded insert, replace and seeded integer random while rejecting invalid operands", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioVariable(history, "Dado");
    history = addStudioList(history, "Números");
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "listAdd",
      listId: "studio-list-1",
      value: { type: "numericLiteral", value: 2 },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "listInsertAt",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: 1 },
      value: { type: "numericLiteral", value: 4 },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "listReplaceAt",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: 2 },
      value: { type: "numericLiteral", value: 6 },
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "randomInteger",
        min: { type: "numericLiteral", value: 1 },
        max: { type: "numericLiteral", value: 6 },
      },
    });
    const creative = creativeForStudio(history.current, "forest", "es");
    const first = runMultiActorProgram(history.current, creative, { randomSeed: 42 });
    const second = runMultiActorProgram(history.current, creative, { randomSeed: 42 });
    expect(first.actors[0]?.world.lists?.["studio-list-1"]?.items).toEqual([4, 6]);
    expect(first.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(
      second.actors[0]?.world.variables?.["studio-var-1"]?.value,
    );
    expect(first.actors[0]?.world.variables?.["studio-var-1"]?.value).toBeGreaterThanOrEqual(1);
    expect(first.actors[0]?.world.variables?.["studio-var-1"]?.value).toBeLessThanOrEqual(6);
    for (const type of ["listInsertAt", "listReplaceAt"] as const)
      expect(() =>
        appendStudioStatement(history, "actor:studio-1-nova", {
          type,
          listId: "studio-list-1",
          index: { type: "numericLiteral", value: 11 },
          value: { type: "numericLiteral", value: 1 },
        }),
      ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "setVariable",
        variableId: "studio-var-1",
        value: {
          type: "randomInteger",
          min: { type: "numericLiteral", value: 7 },
          max: { type: "numericLiteral", value: 1 },
        },
      }),
    ).toThrow();
  });
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
  it("runs a whole scene with pointing, bouncing and persisted positions", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    const nova = "actor:studio-1-nova";
    const friend = "actor:studio-2-mika";
    for (const statement of [
      { type: "pointTowards", actorId: friend },
      { type: "move", steps: 40 },
      { type: "pointInDirection", degrees: 180 },
      { type: "move", steps: 120 },
      { type: "bounceOnEdge" },
    ] as const)
      history = appendStudioStatement(history, nova, statement);
    const creative = creativeForStudio(history.current, "forest", "es");
    const run = () => runMultiActorProgram(history.current, creative);
    const result = run();
    expect(result.outcome).toBe("completed");
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "pointTowards",
      "move",
      "pointInDirection",
      "move",
      "bounceOnEdge",
    ]);
    expect(result.actors[0]?.world.sprite).toMatchObject({ x: 0, y: 0, heading: 0 });
    expect(JSON.stringify(run())).toBe(JSON.stringify(result));
  });
  it("rejects heading blocks that point outside the scene", () => {
    const history = createEditorHistory(createStudioProgram("nova"));
    const nova = "actor:studio-1-nova";
    expect(() =>
      appendStudioStatement(history, nova, { type: "pointInDirection", degrees: 30 }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, nova, {
        type: "pointTowards",
        actorId: "actor:studio-9-mika",
      }),
    ).toThrow();
    expect(() => appendStudioStatement(history, nova, { type: "bounceOnEdge" })).not.toThrow();
  });
  it("groups the last blocks into a repeat-until loop that ends on a sensor and survives a rerun", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    const nova = "actor:studio-1-nova";
    history = appendStudioStatement(history, nova, { type: "pointInDirection", degrees: 0 });
    history = appendStudioStatement(history, nova, { type: "move", steps: 120 });
    history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
    history = wrapStudioTail(history, nova, 1, {
      type: "repeatUntil",
      condition: STUDIO_EDGE_CONDITION,
    });
    expect(history.current.scripts[0]?.statements.at(-1)?.type).toBe("repeatUntil");
    const creative = creativeForStudio(history.current, "forest", "es");
    const result = runMultiActorProgram(history.current, creative);
    expect(result.outcome).toBe("completed");
    expect(result.actors[0]?.world.sprite.x).toBe(320);
    expect(JSON.stringify(runMultiActorProgram(history.current, creative))).toBe(
      JSON.stringify(result),
    );
    const toMika = wrapStudioTail(
      appendStudioStatement(history, nova, { type: "move", steps: 20 }),
      nova,
      1,
      { type: "repeatUntil", condition: { type: "touchingActor", actorId: "actor:studio-2-mika" } },
    );
    expect(toMika.current.scripts[0]?.statements.at(-1)?.type).toBe("repeatUntil");
  });
  it("rejects repeat-until with an unsupported condition or an empty body", () => {
    const history = appendStudioStatement(
      createEditorHistory(createStudioProgram("nova")),
      "actor:studio-1-nova",
      { type: "move", steps: 40 },
    );
    expect(() =>
      wrapStudioTail(history, "actor:studio-1-nova", 1, {
        type: "repeatUntil",
        condition: { type: "booleanLiteral", value: false },
      }),
    ).toThrow();
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", {
        type: "repeatUntil",
        condition: STUDIO_EDGE_CONDITION,
        body: [],
      }),
    ).toThrow();
  });
  it("runs a bounded size change on the chosen character only", () => {
    let history = createEditorHistory(createStudioProgram("nova"));
    history = addStudioActor(history, "mika");
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "changeSize",
      delta: 50,
    });
    history = appendStudioStatement(history, "actor:studio-1-nova", {
      type: "changeSize",
      delta: -25,
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors.map((actor) => actor.size)).toEqual([125, 100]);
    expect(() =>
      appendStudioStatement(history, "actor:studio-1-nova", { type: "changeSize", delta: 30 }),
    ).toThrow();
  });
  it("computes a remainder in a scene and rejects a zero or variable divisor", () => {
    const nova = "actor:studio-1-nova";
    let history = addStudioVariable(createEditorHistory(createStudioProgram("nova")), "Resto");
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "numericLiteral", value: 7 },
    });
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "modulo",
        left: { type: "variable", variableId: "studio-var-1" },
        right: { type: "numericLiteral", value: 3 },
      },
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(1);
    for (const right of [
      { type: "numericLiteral", value: 0 },
      { type: "variable", variableId: "studio-var-1" },
    ] as const)
      expect(() =>
        appendStudioStatement(history, nova, {
          type: "setVariable",
          variableId: "studio-var-1",
          value: { type: "modulo", left: { type: "numericLiteral", value: 4 }, right },
        }),
      ).toThrow();
  });
  it("rounds a calculated value and rejects an unsupported operand", () => {
    const nova = "actor:studio-1-nova";
    let history = addStudioVariable(createEditorHistory(createStudioProgram("nova")), "Medio");
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: { type: "numericLiteral", value: 7 },
    });
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "divide",
        left: { type: "variable", variableId: "studio-var-1" },
        right: { type: "numericLiteral", value: 2 },
      },
    });
    history = appendStudioStatement(history, nova, {
      type: "setVariable",
      variableId: "studio-var-1",
      value: {
        type: "mathFunction",
        function: "round",
        value: { type: "variable", variableId: "studio-var-1" },
      },
    });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.variables?.["studio-var-1"]?.value).toBe(4);
    expect(() =>
      appendStudioStatement(history, nova, {
        type: "setVariable",
        variableId: "studio-var-1",
        value: {
          type: "mathFunction",
          function: "abs",
          value: { type: "variable", variableId: "missing" },
        },
      }),
    ).toThrow();
  });
  it("sends a character to the front during a run without changing the saved order", () => {
    const nova = "actor:studio-1-nova";
    let history = addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");
    history = appendStudioStatement(history, nova, { type: "goToLayer", layer: "front" });
    const creative = creativeForStudio(history.current, "forest", "es");
    const result = runMultiActorProgram(history.current, creative);
    expect(creative.stage?.actorOrder).toEqual([nova, "actor:studio-2-mika"]);
    expect(result.stage.actorOrder).toEqual(["actor:studio-2-mika", nova]);
    expect(() =>
      appendStudioStatement(history, nova, { type: "goToLayer", layer: "middle" as never }),
    ).toThrow();
  });
  it("glides a character to a stage point and rejects points or durations outside the scene", () => {
    const nova = "actor:studio-1-nova";
    let history = createEditorHistory(createStudioProgram("nova"));
    history = appendStudioStatement(history, nova, { type: "glideTo", x: 200, y: 60, seconds: 2 });
    const result = runMultiActorProgram(
      history.current,
      creativeForStudio(history.current, "forest", "es"),
    );
    expect(result.actors[0]?.world.sprite).toMatchObject({ x: 200, y: 60 });
    for (const bad of [
      { x: 321, y: 0, seconds: 1 },
      { x: 0, y: 121, seconds: 1 },
      { x: 10.5, y: 0, seconds: 1 },
      { x: 0, y: 0, seconds: 4 },
    ])
      expect(() => appendStudioStatement(history, nova, { type: "glideTo", ...bad })).toThrow();
  });
  describe("custom blocks", () => {
    const nova = "actor:studio-1-nova";
    const mika = "actor:studio-2-mika";
    const build = () => {
      let history = addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");
      history = appendStudioStatement(history, nova, { type: "move", steps: 40 });
      history = appendStudioStatement(history, nova, { type: "turn", degrees: 90 });
      return createStudioProcedure(history, nova, 2, "Cuadrado");
    };

    it("turns the last blocks into one block and a call, and undo restores them", () => {
      const history = build();
      const script = history.current.scripts[0]!;
      expect(script.procedures).toEqual([
        {
          id: "proc-1-1",
          name: "Cuadrado",
          body: [
            { type: "move", steps: 40 },
            { type: "turn", degrees: 90 },
          ],
        },
      ]);
      expect(script.statements).toEqual([{ type: "callProcedure", procedureId: "proc-1-1" }]);
      const undone = undoCanonicalTransaction(history).history;
      expect(undone.current.scripts[0]?.procedures).toBeUndefined();
      expect(undone.current.scripts[0]?.statements).toHaveLength(2);
    });

    it("runs the same as the blocks it replaced and lets the child call it again", () => {
      let history = build();
      history = appendStudioStatement(history, nova, {
        type: "callProcedure",
        procedureId: "proc-1-1",
      });
      const creative = creativeForStudio(history.current, "forest", "es");
      const result = runMultiActorProgram(history.current, creative);
      expect(result.outcome).toBe("completed");
      expect(result.actors[0]?.world.sprite).toMatchObject({ x: 40, y: 40, heading: 180 });
      expect(result.actors[1]?.world.sprite.x).toBe(60);
    });

    it("keeps a character's blocks private to that character", () => {
      const history = build();
      expect(() =>
        appendStudioStatement(history, mika, { type: "callProcedure", procedureId: "proc-1-1" }),
      ).toThrow();
    });

    it("renames, and rejects names outside the allowed set", () => {
      const history = renameStudioProcedure(build(), nova, "proc-1-1", "Vuelta");
      expect(history.current.scripts[0]?.procedures?.[0]?.name).toBe("Vuelta");
      for (const bad of ["", "<b>", "x".repeat(21)]) {
        expect(() => renameStudioProcedure(history, nova, "proc-1-1", bad)).toThrow();
        expect(() => createStudioProcedure(history, nova, 1, bad)).toThrow();
      }
    });

    it("refuses to delete a block in use, and inlining restores the blocks in place", () => {
      let history = build();
      history = appendStudioStatement(history, nova, {
        type: "callProcedure",
        procedureId: "proc-1-1",
      });
      expect(studioProcedureUses(history.current, nova, "proc-1-1")).toBe(2);
      expect(() => deleteStudioProcedure(history, nova, "proc-1-1", "refuse")).toThrow();
      const inlined = deleteStudioProcedure(history, nova, "proc-1-1", "inline");
      const script = inlined.current.scripts[0]!;
      expect(script.procedures).toBeUndefined();
      expect(script.statements.map((statement) => statement.type)).toEqual([
        "move",
        "turn",
        "move",
        "turn",
      ]);
      const before = runMultiActorProgram(
        history.current,
        creativeForStudio(history.current, "forest", "es"),
      );
      const after = runMultiActorProgram(
        inlined.current,
        creativeForStudio(inlined.current, "forest", "es"),
      );
      expect(after.actors[0]?.world).toEqual(before.actors[0]?.world);
    });

    it("deletes a block nobody calls", () => {
      let history = build();
      history = removeStudioStatement(history, nova, 0);
      expect(studioProcedureUses(history.current, nova, "proc-1-1")).toBe(0);
      const deleted = deleteStudioProcedure(history, nova, "proc-1-1", "refuse");
      expect(deleted.current.scripts[0]?.procedures).toBeUndefined();
    });

    it("refuses to delete a block that another block uses", () => {
      let history = build();
      history = appendStudioStatement(history, nova, {
        type: "callProcedure",
        procedureId: "proc-1-1",
      });
      const recursive = createStudioProcedure(history, nova, 1, "Otra");
      expect(recursive.current.scripts[0]?.procedures).toHaveLength(2);
      expect(() => deleteStudioProcedure(recursive, nova, "proc-1-2", "refuse")).toThrow();
    });

    it("will not inline a block that calls itself", () => {
      const history = build();
      const looped = {
        ...history.current,
        scripts: [
          {
            ...history.current.scripts[0]!,
            procedures: [
              {
                id: "proc-1-1",
                name: "Cuadrado",
                body: [
                  { type: "move" as const, steps: 40 },
                  { type: "callProcedure" as const, procedureId: "proc-1-1" },
                ],
              },
            ],
          },
          ...history.current.scripts.slice(1),
        ],
      };
      expect(() =>
        deleteStudioProcedure(createEditorHistory(looped), nova, "proc-1-1", "inline"),
      ).toThrow();
    });

    it("limits a character to 20 blocks", () => {
      let history = createEditorHistory(createStudioProgram("nova"));
      for (let i = 0; i < 20; i += 1) {
        history = appendStudioStatement(history, nova, { type: "move", steps: 20 });
        history = createStudioProcedure(history, nova, 1, `Bloque ${i + 1}`);
      }
      history = appendStudioStatement(history, nova, { type: "move", steps: 20 });
      expect(() => createStudioProcedure(history, nova, 1, "Uno más")).toThrow();
    });
  });
});
