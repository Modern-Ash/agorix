import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { convertScratchProject } from "./kidsScratchImport.js";
import { exportScratchProject } from "./kidsScratchExport.js";
import { readScratchProject } from "./kidsScratchZip.js";
import { creativeForStudio } from "./kidsStudioModel.js";
import { validateStudioProgram } from "./kidsStudioModel.js";

const lit = (value: string | number, type = 4) => [1, [type, String(value)]];
const block = (opcode: string, extra: Record<string, unknown> = {}) => ({
  opcode,
  next: null,
  parent: null,
  inputs: {},
  fields: {},
  shadow: false,
  topLevel: false,
  ...extra,
});

/** A small project: a flag script, a key script, a loop, a variable and values Scratch allows. */
function project() {
  return {
    targets: [
      {
        isStage: true,
        name: "Stage",
        variables: { v1: ["score", 0] },
        blocks: {},
      },
      {
        isStage: false,
        name: "Cat",
        x: 0,
        y: 0,
        direction: 90,
        size: 100,
        variables: {},
        blocks: {
          hat: block("event_whenflagclicked", { next: "move", topLevel: true }),
          move: block("motion_movesteps", { next: "turn", inputs: { STEPS: lit(10) } }),
          turn: block("motion_turnright", { next: "say", inputs: { DEGREES: lit(15) } }),
          say: block("looks_sayforsecs", {
            next: "rep",
            inputs: { MESSAGE: lit("Hola", 10), SECS: lit(2) },
          }),
          rep: block("control_repeat", {
            next: "var",
            inputs: { TIMES: lit(4), SUBSTACK: [2, "inner"] },
          }),
          inner: block("motion_changexby", { inputs: { DX: lit(10) } }),
          var: block("data_changevariableby", {
            next: "weird",
            fields: { VARIABLE: ["score", "v1"] },
            inputs: { VALUE: lit(1) },
          }),
          weird: block("motion_glideto", { next: "go", inputs: {} }),
          go: block("motion_goto", { inputs: { TO: [1, "menu"] } }),
          menu: block("motion_goto_menu", { fields: { TO: ["_random_", null] }, shadow: true }),
          other: block("event_whenkeypressed", {
            topLevel: true,
            fields: { KEY_OPTION: ["space", null] },
          }),
        },
      },
      {
        isStage: false,
        name: "Ball",
        x: 100,
        y: 50,
        direction: 0,
        size: 50,
        variables: {},
        blocks: {
          click: block("event_whenthisspriteclicked", { next: "hide", topLevel: true }),
          hide: block("looks_hide"),
        },
      },
    ],
  };
}

describe("Scratch import", () => {
  it("brings the scripts of each sprite across, snapped to the scene's lists", () => {
    const { program, report, positions } = convertScratchProject(project());
    // The cat's flag script, the ball's tap script, then the cat's second script (the space key).
    expect(program.scripts).toHaveLength(3);
    const [cat, ball] = program.scripts;
    expect(cat!.trigger).toEqual({ type: "greenFlag" });
    expect(cat!.statements.map((statement) => statement.type)).toEqual([
      "move",
      "turn",
      "say",
      "repeat",
      "changeVariable",
      "goToTarget",
    ]);
    expect(cat!.statements[0]).toMatchObject({ type: "move", steps: 20 });
    expect(cat!.statements[1]).toMatchObject({ type: "turn", degrees: 45 });
    expect(cat!.statements[2]).toMatchObject({ type: "say", text: "Hola", seconds: 2 });
    expect(cat!.statements[3]).toMatchObject({ type: "repeat", count: 3 });
    expect(ball!.trigger).toEqual({ type: "onActorClicked" });
    expect(Object.values(positions)).toHaveLength(2);
    expect(report.sprites).toBe(2);
    expect(report.blocksAdjusted).toBeGreaterThan(0);
  });

  it("reports what it could not bring, by reason", () => {
    const { report } = convertScratchProject(project());
    const reasons = report.dropped.map((item) => item.what);
    expect(reasons.some((what) => what.startsWith("motion_glideto"))).toBe(true);
  });

  it("keeps a second script for another event, and leaves one for an event already answered", () => {
    const twice = project();
    (twice.targets[1] as { blocks: Record<string, unknown> }).blocks["again"] = block(
      "event_whenkeypressed",
      { topLevel: true, fields: { KEY_OPTION: ["space", null] }, next: "step" },
    );
    (twice.targets[1] as { blocks: Record<string, unknown> }).blocks["step"] = block(
      "motion_movesteps",
      { inputs: { STEPS: lit(10) } },
    );
    const { report } = convertScratchProject(twice);
    expect(report.dropped.map((item) => item.what)).toContain("another script of the sprite");
  });

  it("produces a program that runs in the deterministic runtime", () => {
    const { program, backdropId, positions } = convertScratchProject(project());
    const creative = creativeForStudio(program, backdropId, "es", positions);
    const run = runMultiActorProgram(program, creative);
    expect(run.trace.length).toBeGreaterThan(0);
  });

  it("rejects something that is not a Scratch project, and a project without sprites", () => {
    expect(() => convertScratchProject({ nope: true })).toThrow(RangeError);
    expect(() => convertScratchProject({ targets: [{ isStage: true, blocks: {} }] })).toThrow(
      RangeError,
    );
  });

  it("never sinks the import over a block it cannot place", () => {
    const strange = project();
    (strange.targets[1] as { blocks: Record<string, unknown> }).blocks["move"] = block(
      "motion_movesteps",
      { next: "turn", inputs: { STEPS: [3, "someReporter", [4, "10"]] } },
    );
    const { program, report } = convertScratchProject(strange);
    expect(program.scripts[0]!.statements[0]!.type).toBe("turn");
    expect(report.dropped.some((item) => item.what.includes("motion_movesteps"))).toBe(true);
  });

  it("turns a Scratch join of a text and a variable into a say with the value after it", () => {
    const joined = project();
    const blocks = (joined.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "join", [10, "Hola"]] },
    });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: lit("Puntos: ", 10), STRING2: [3, "val", [10, ""]] },
    });
    blocks["val"] = block("data_variable", { fields: { VARIABLE: ["score", "v1"] } });
    const { program } = convertScratchProject(joined);
    expect(program.scripts[0]!.statements[2]).toMatchObject({
      type: "say",
      text: "Puntos:",
      append: { type: "variable", variableId: "studio-var-1" },
    });
  });

  it.each([
    [
      "word variable",
      [3, [12, "word", "w"], [10, ""]],
      { type: "textVariable", variableId: "studio-text-1" },
      "Hola",
    ],
    [
      "costume name",
      [3, "nameReporter", [10, ""]],
      { type: "actorProperty", property: "costumeName" },
      "Nova",
    ],
    ["short literal", lit("mundo", 10), { type: "textLiteral", value: "mundo" }, "mundo"],
  ] as const)("keeps a join with a %s", async (_kind, second, expected, suffix) => {
    const joined = project();
    (joined.targets[0] as { variables: Record<string, unknown> }).variables["w"] = ["word", "Hola"];
    const blocks = (joined.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", { next: "rep", inputs: { MESSAGE: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: lit("Saludo:", 10), STRING2: second },
    });
    blocks["nameReporter"] = block("looks_costumenumbername", {
      fields: { NUMBER_NAME: ["name", null] },
    });
    const { program, report } = convertScratchProject(joined);
    expect(
      report.dropped.some((item) => item.what.includes("join") || item.what.includes("looks_say")),
    ).toBe(false);
    const statement = program.scripts[0]!.statements[2]!;
    expect(statement).toMatchObject({ type: "say", text: "Saludo:", append: expected });
    const creative = creativeForStudio(program, "forest", "es");
    const result = runMultiActorProgram(program, creative);
    const bubble = result.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite
      .bubble;
    expect(bubble?.text).toBe(`Saludo: ${suffix}`);
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(statement);
  });

  it("reports and drops a join whose second value is too long", () => {
    const joined = project();
    const blocks = (joined.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", { next: "rep", inputs: { MESSAGE: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: lit("Saludo:", 10), STRING2: lit("una palabra demasiado larga", 10) },
    });
    const { program, report } = convertScratchProject(joined);
    expect(program.scripts[0]!.statements.some((statement) => statement.type === "say")).toBe(
      false,
    );
    expect(report.dropped.some((item) => item.what.includes("join (a second value"))).toBe(true);
  });

  it("imports a dynamic join into speech and a word variable without adding a space", async () => {
    const scratch = project();
    const stage = scratch.targets[0] as { variables: Record<string, unknown> };
    stage.variables["w1"] = ["first", "Hola"];
    stage.variables["w2"] = ["result", "Listo"];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "setWord",
      inputs: { MESSAGE: [3, "speechJoin", [10, ""]] },
    });
    blocks["speechJoin"] = block("operator_join", {
      inputs: { STRING1: [3, [12, "first", "w1"], [10, ""]], STRING2: [3, "name", [10, ""]] },
    });
    blocks["name"] = block("looks_costumenumbername", { fields: { NUMBER_NAME: ["name", null] } });
    blocks["setWord"] = block("data_setvariableto", {
      next: "rep",
      fields: { VARIABLE: ["result", "w2"] },
      inputs: { VALUE: [3, "wordJoin", [10, ""]] },
    });
    blocks["wordJoin"] = block("operator_join", {
      inputs: { STRING1: [3, [12, "first", "w1"], [10, ""]], STRING2: lit("mundo", 10) },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped.some((item) => item.what.includes("operator_join"))).toBe(false);
    expect(program.scripts[0]!.statements[2]).toMatchObject({
      type: "say",
      text: "",
      append: { type: "join" },
    });
    expect(program.scripts[0]!.statements[3]).toMatchObject({
      type: "setText",
      value: { type: "join" },
    });
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(
      run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
    ).toBe("HolaNova");
    const resultId = program.textVariables?.find((item) => item.name === "result")?.id;
    expect(run.actors[0]!.world.texts?.[resultId ?? ""]?.value).toBe("Holamundo");
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(program.scripts[0]!.statements[2]);
    expect(back.program.scripts[0]!.statements[3]).toEqual(program.scripts[0]!.statements[3]);
  });

  it("keeps numeric join operands typed through runtime and Scratch round-trip", async () => {
    const scratch = project();
    const stage = scratch.targets[0] as { variables: Record<string, unknown> };
    stage.variables["w"] = ["word", "Hola"];
    stage.variables["result"] = ["result", "Listo"];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "setWord",
      inputs: { MESSAGE: [3, "speechJoin", [10, ""]] },
    });
    blocks["speechJoin"] = block("operator_join", {
      inputs: {
        STRING1: [3, [12, "word", "w"], [10, ""]],
        STRING2: [3, [12, "score", "v1"], [10, ""]],
      },
    });
    blocks["setWord"] = block("data_setvariableto", {
      next: "rep",
      fields: { VARIABLE: ["result", "result"] },
      inputs: { VALUE: [3, "wordJoin", [10, ""]] },
    });
    blocks["wordJoin"] = block("operator_join", {
      inputs: { STRING1: lit(12), STRING2: [3, [12, "word", "w"], [10, ""]] },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped.some((item) => item.what.includes("join"))).toBe(false);
    expect(program.scripts[0]!.statements[2]).toMatchObject({
      type: "say",
      append: { type: "join", left: { type: "textVariable" }, right: { type: "variable" } },
    });
    expect(program.scripts[0]!.statements[3]).toMatchObject({
      type: "setText",
      value: {
        type: "join",
        left: { type: "numericLiteral", value: 12 },
        right: { type: "textVariable" },
      },
    });
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(
      run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
    ).toBe("Hola0");
    const resultId = program.textVariables?.find((item) => item.name === "result")?.id;
    expect(run.actors[0]!.world.texts?.[resultId ?? ""]?.value).toBe("12Hola");
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(program.scripts[0]!.statements[2]);
    expect(back.program.scripts[0]!.statements[3]).toEqual(program.scripts[0]!.statements[3]);
  });

  it("reports and drops a dynamic join with an unsupported source", () => {
    const scratch = project();
    (scratch.targets[0] as { variables: Record<string, unknown> }).variables["w"] = [
      "first",
      "Hola",
    ];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", { next: "rep", inputs: { MESSAGE: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: {
        STRING1: [3, [12, "first", "w"], [10, ""]],
        STRING2: lit("una palabra demasiado larga", 10),
      },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements.some((statement) => statement.type === "say")).toBe(
      false,
    );
    expect(report.dropped.some((item) => item.what.startsWith("operator_join"))).toBe(true);
  });

  it("drops nested Scratch joins instead of changing their text", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "outer", [10, ""]] },
    });
    blocks["outer"] = block("operator_join", {
      inputs: { STRING1: lit("Hola", 10), STRING2: [3, "inner", [10, ""]] },
    });
    blocks["inner"] = block("operator_join", {
      inputs: { STRING1: lit("mundo", 10), STRING2: lit("!", 10) },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements.some((statement) => statement.type === "say")).toBe(
      false,
    );
    expect(report.dropped.some((item) => item.what.includes("join"))).toBe(true);
  });

  it("imports Scratch letter and length reporters, executes them, and round-trips them", async () => {
    const scratch = project();
    (scratch.targets[0] as { variables: Record<string, unknown> }).variables["w"] = [
      "word",
      "Hola",
    ];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "letter", [10, ""]] },
    });
    blocks["letter"] = block("operator_letter_of", {
      inputs: { LETTER: lit(2), STRING: [3, [12, "word", "w"], [10, ""]] },
    });
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", {
      inputs: { STRING: [3, [12, "word", "w"], [10, ""]] },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(
      report.dropped.some(
        (item) => item.what.includes("operator_letter_of") || item.what.includes("operator_length"),
      ),
    ).toBe(false);
    expect(program.scripts[0]!.statements[2]).toMatchObject({
      type: "say",
      append: { type: "letterOf", index: { value: 2 }, value: { type: "textVariable" } },
    });
    expect(program.scripts[0]!.statements[4]).toMatchObject({
      type: "setVariable",
      value: { type: "textLength", value: { type: "textVariable" } },
    });
    const creative = creativeForStudio(program, "forest", "es");
    const run = runMultiActorProgram(program, creative);
    expect(
      run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
    ).toBe("o");
    expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(4);
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(program.scripts[0]!.statements[2]);
    expect(back.program.scripts[0]!.statements[4]).toEqual(program.scripts[0]!.statements[4]);
  });

  it("keeps numeric sources in Scratch letter and length reporters through round-trip", async () => {
    const scratch = project();
    (scratch.targets[0] as { variables: Record<string, unknown> }).variables["v1"] = ["score", 42];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "letter", [10, ""]] },
    });
    blocks["letter"] = block("operator_letter_of", {
      inputs: { LETTER: lit(2), STRING: [3, [12, "score", "v1"], [10, ""]] },
    });
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", { inputs: { STRING: lit(12) } });
    const { program, report } = convertScratchProject(scratch);
    expect(
      report.dropped.some(
        (item) => item.what.includes("operator_letter_of") || item.what.includes("operator_length"),
      ),
    ).toBe(false);
    expect(program.scripts[0]!.statements[2]).toMatchObject({
      type: "say",
      append: { type: "letterOf", value: { type: "variable" } },
    });
    expect(program.scripts[0]!.statements[4]).toMatchObject({
      type: "setVariable",
      value: { type: "textLength", value: { type: "numericLiteral", value: 12 } },
    });
    expect(validateStudioProgram(program)).toEqual(program);
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(
      run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
    ).toBe("2");
    expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(2);
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(program.scripts[0]!.statements[2]);
    expect(back.program.scripts[0]!.statements[4]).toEqual(program.scripts[0]!.statements[4]);
  });

  it("reports a nested source in Scratch length instead of importing a changed value", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", { inputs: { STRING: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: lit("Hola", 10), STRING2: lit(2) },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(
      program.scripts[0]!.statements.some((statement) => statement.type === "setVariable"),
    ).toBe(false);
    expect(report.dropped.some((item) => item.what.startsWith("operator_length"))).toBe(true);
  });

  it("reports an unsupported letter position and overlong length source", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "letter", [10, ""]] },
    });
    blocks["letter"] = block("operator_letter_of", {
      inputs: { LETTER: lit(21), STRING: lit("Hola", 10) },
    });
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", {
      inputs: { STRING: lit("una palabra demasiado larga", 10) },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(
      program.scripts[0]!.statements.some(
        (statement) => statement.type === "say" || statement.type === "setVariable",
      ),
    ).toBe(false);
    expect(report.dropped.some((item) => item.what.startsWith("operator_letter_of"))).toBe(true);
    expect(report.dropped.some((item) => item.what.startsWith("operator_length"))).toBe(true);
  });

  it("uses a sprite's numeric Scratch property as digits in a text reporter", async () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", { inputs: { STRING: [3, "property", [10, ""]] } });
    blocks["property"] = block("sensing_of", {
      fields: { PROPERTY: ["volume", null] },
      inputs: { OBJECT: [1, "target"] },
    });
    blocks["target"] = block("sensing_of_object_menu", { fields: { OBJECT: ["Cat", null] } });
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped.some((item) => item.what.startsWith("operator_length"))).toBe(false);
    expect(program.scripts[0]!.statements[4]).toMatchObject({
      type: "setVariable",
      value: { type: "textLength", value: { type: "actorProperty", property: "volume" } },
    });
    expect(validateStudioProgram(program)).toEqual(program);
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(3);
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[4]).toEqual(program.scripts[0]!.statements[4]);
  });

  it.each([
    { opcode: "operator_join", input: "STRING1", other: "STRING2", slot: "say", expected: "100!" },
    { opcode: "operator_letter_of", input: "STRING", other: "LETTER", slot: "say", expected: "0" },
    { opcode: "operator_length", input: "STRING", other: "", slot: "number", expected: 3 },
    {
      opcode: "operator_contains",
      input: "STRING1",
      other: "STRING2",
      slot: "condition",
      expected: "Sí",
    },
    {
      opcode: "operator_equals",
      input: "OPERAND1",
      other: "OPERAND2",
      slot: "condition",
      expected: "Sí",
    },
  ])(
    "keeps Stage volume numeric in Scratch $opcode",
    async ({ opcode, input, other, slot, expected }) => {
      const scratch = project();
      const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
      blocks["hat"] = block("event_whenflagclicked", {
        next: slot === "condition" ? "if" : slot === "number" ? "set" : "say",
        topLevel: true,
      });
      const inputs: Record<string, unknown> = { [input]: [3, "property", [10, ""]] };
      if (other)
        inputs[other] =
          opcode === "operator_letter_of"
            ? lit(2)
            : opcode === "operator_join"
              ? lit("!", 10)
              : opcode === "operator_contains"
                ? lit(0)
                : lit(100);
      blocks["reporter"] = block(opcode, { inputs });
      blocks["property"] = block("sensing_of", {
        fields: { PROPERTY: ["volume", null] },
        inputs: { OBJECT: [1, "stageMenu"] },
      });
      blocks["stageMenu"] = block("sensing_of_object_menu", {
        fields: { OBJECT: ["_stage_", null] },
      });
      blocks["say"] = block("looks_say", { inputs: { MESSAGE: [3, "reporter", [10, ""]] } });
      blocks["set"] = block("data_setvariableto", {
        fields: { VARIABLE: ["score", "v1"] },
        inputs: { VALUE: [3, "reporter", [4, "0"]] },
      });
      blocks["if"] = block("control_if", {
        inputs: { CONDITION: [2, "reporter"], SUBSTACK: [2, "found"] },
      });
      blocks["found"] = block("looks_say", { inputs: { MESSAGE: lit("Sí", 10) } });
      const { program, report } = convertScratchProject(scratch);
      expect(report.dropped).toEqual([]);
      expect(JSON.stringify(program.scripts[0]!.statements[0])).toContain('"property":"volume"');
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      if (slot === "number")
        expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(expected);
      else
        expect(
          run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
        ).toBe(expected);
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements).toEqual(program.scripts[0]!.statements);
    },
  );

  it("reports an unknown numeric property source in a Scratch text operator", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "say", topLevel: true });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: {
        STRING1: [3, "property", [10, ""]],
        STRING2: lit("!", 10),
      },
    });
    blocks["property"] = block("sensing_of", {
      fields: { PROPERTY: ["volume", null] },
      inputs: { OBJECT: [1, "target"] },
    });
    blocks["target"] = block("sensing_of_object_menu", { fields: { OBJECT: ["Missing", null] } });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("operator_join"))).toBe(true);
  });

  it("keeps a short literal letter and the current costume name length", async () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["say"] = block("looks_say", {
      next: "rep",
      inputs: { MESSAGE: [3, "letter", [10, ""]] },
    });
    blocks["letter"] = block("operator_letter_of", {
      inputs: { LETTER: lit(2), STRING: lit("luna", 10) },
    });
    blocks["var"] = block("data_setvariableto", {
      next: "weird",
      fields: { VARIABLE: ["score", "v1"] },
      inputs: { VALUE: [3, "length", [4, "0"]] },
    });
    blocks["length"] = block("operator_length", { inputs: { STRING: [3, "name", [10, ""]] } });
    blocks["name"] = block("looks_costumenumbername", { fields: { NUMBER_NAME: ["name", null] } });
    const { program } = convertScratchProject(scratch);
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(
      run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
    ).toBe("u");
    expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(4);
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[2]).toEqual(program.scripts[0]!.statements[2]);
    expect(back.program.scripts[0]!.statements[4]).toEqual(program.scripts[0]!.statements[4]);
  });

  it.each(["Mariposa", "Luna"])(
    "round-trips a bounded Scratch contains condition for %s",
    async (word) => {
      const scratch = project();
      (scratch.targets[0] as { variables: Record<string, unknown> }).variables["w"] = [
        "word",
        word,
      ];
      const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
      blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
      blocks["if"] = block("control_if", {
        inputs: { CONDITION: [2, "contains"], SUBSTACK: [2, "say"] },
      });
      blocks["contains"] = block("operator_contains", {
        inputs: { STRING1: [3, [12, "word", "w"], [10, ""]], STRING2: lit("POS", 10) },
      });
      blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Encontrado", 10) } });
      const { program, report } = convertScratchProject(scratch);
      expect(report.dropped.some((item) => item.what.includes("operator_contains"))).toBe(false);
      expect(program.scripts[0]!.statements[0]).toMatchObject({
        type: "if",
        condition: { type: "textContains", text: { type: "textVariable" }, part: { value: "POS" } },
      });
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      expect(run.trace.some((entry) => entry.statementType === "say")).toBe(word === "Mariposa");
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements[0]).toEqual(program.scripts[0]!.statements[0]);
    },
  );

  it.each([
    { source: "number", needle: 2, found: true },
    { source: "number", needle: 3, found: false },
    { source: "word", needle: 12, found: true },
    { source: "word", needle: 13, found: false },
  ])(
    "round-trips Scratch contains with $source and numeric $needle",
    async ({ source, needle, found }) => {
      const scratch = project();
      const stage = scratch.targets[0] as { variables: Record<string, unknown> };
      stage.variables["v1"] = ["score", source === "word" ? needle : 12];
      const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
      blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
      blocks["if"] = block("control_if", {
        inputs: { CONDITION: [2, "contains"], SUBSTACK: [2, "say"] },
      });
      blocks["contains"] = block("operator_contains", {
        inputs: {
          STRING1: source === "number" ? [3, [12, "score", "v1"], [10, ""]] : lit("Hola12", 10),
          STRING2: source === "number" ? lit(needle) : [3, [12, "score", "v1"], [10, ""]],
        },
      });
      blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Encontrado", 10) } });
      const { program, report } = convertScratchProject(scratch);
      expect(report.dropped.some((item) => item.what.includes("operator_contains"))).toBe(false);
      expect(program.scripts[0]!.statements[0]).toMatchObject({
        type: "if",
        condition: {
          type: "textContains",
          text: { type: source === "number" ? "variable" : "textLiteral" },
          part: { type: source === "number" ? "numericLiteral" : "variable" },
        },
      });
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      expect(run.trace.some((entry) => entry.statementType === "say")).toBe(found);
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements[0]).toEqual(program.scripts[0]!.statements[0]);
    },
  );

  it("drops an unsupported Scratch contains condition with an explicit reason", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
    blocks["if"] = block("control_if", {
      inputs: { CONDITION: [2, "contains"], SUBSTACK: [2, "say"] },
    });
    blocks["contains"] = block("operator_contains", {
      inputs: { STRING1: lit("una palabra demasiado larga", 10), STRING2: lit("palabra", 10) },
    });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Encontrado", 10) } });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("operator_contains"))).toBe(true);
  });

  it("reports a nested Scratch contains source instead of silently changing its meaning", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
    blocks["if"] = block("control_if", {
      inputs: { CONDITION: [2, "contains"], SUBSTACK: [2, "say"] },
    });
    blocks["contains"] = block("operator_contains", {
      inputs: { STRING1: [3, "join", [10, ""]], STRING2: lit("12", 10) },
    });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: lit("Hola", 10), STRING2: lit(12) },
    });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Encontrado", 10) } });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("operator_contains"))).toBe(true);
  });

  it.each(["Sol", "Luna"])("round-trips a Scratch word equality for %s", async (word) => {
    const scratch = project();
    (scratch.targets[0] as { variables: Record<string, unknown> }).variables["w"] = ["word", word];
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
    blocks["if"] = block("control_if", {
      inputs: { CONDITION: [2, "equal"], SUBSTACK: [2, "say"] },
    });
    blocks["equal"] = block("operator_equals", {
      inputs: { OPERAND1: [3, [12, "word", "w"], [10, ""]], OPERAND2: lit("sOL", 10) },
    });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Iguales", 10) } });
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped.some((item) => item.what.includes("operator_equals"))).toBe(false);
    expect(program.scripts[0]!.statements[0]).toMatchObject({
      type: "if",
      condition: {
        type: "equals",
        left: { type: "textVariable" },
        right: { type: "textLiteral", value: "sOL" },
      },
    });
    const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
    expect(run.trace.some((entry) => entry.statementType === "say")).toBe(word === "Sol");
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[0]).toEqual(program.scripts[0]!.statements[0]);
  });

  it.each([
    { word: "12", number: 12, expected: true, reverse: false },
    { word: "Hola", number: 0, expected: false, reverse: false },
    { word: "13", number: 12, expected: false, reverse: true },
  ])(
    "round-trips mixed Scratch equality for '$word' and $number",
    async ({ word, number, expected, reverse }) => {
      const scratch = project();
      const stage = scratch.targets[0] as { variables: Record<string, unknown> };
      stage.variables["v1"] = ["score", number];
      stage.variables["stage:studio-text-1"] = ["word", word];
      const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
      blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
      blocks["if"] = block("control_if", {
        inputs: { CONDITION: [2, "equal"], SUBSTACK: [2, "say"] },
      });
      const wordInput = [3, [12, "word", "stage:studio-text-1"], [10, ""]];
      const numberInput = [3, [12, "score", "v1"], [4, "0"]];
      blocks["equal"] = block("operator_equals", {
        inputs: {
          OPERAND1: reverse ? numberInput : wordInput,
          OPERAND2: reverse ? wordInput : numberInput,
        },
      });
      blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Iguales", 10) } });
      const { program, report } = convertScratchProject(scratch);
      expect(report.dropped.some((item) => item.what.includes("operator_equals"))).toBe(false);
      expect(program.scripts[0]!.statements[0]).toMatchObject({
        type: "if",
        condition: {
          type: "equals",
          left: { type: reverse ? "variable" : "textVariable" },
          right: { type: reverse ? "textVariable" : "variable" },
        },
      });
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      expect(run.trace.some((entry) => entry.statementType === "say")).toBe(expected);
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements[0]).toEqual(program.scripts[0]!.statements[0]);
    },
  );

  it("keeps numeric equality and reports an unsupported word equality", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "if", topLevel: true });
    blocks["if"] = block("control_if", {
      inputs: { CONDITION: [2, "equal"], SUBSTACK: [2, "say"] },
    });
    blocks["equal"] = block("operator_equals", { inputs: { OPERAND1: lit(2), OPERAND2: lit(2) } });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: lit("Iguales", 10) } });
    const numeric = convertScratchProject(scratch);
    expect(numeric.program.scripts[0]!.statements[0]).toMatchObject({
      type: "if",
      condition: {
        type: "equals",
        left: { type: "numericLiteral", value: 2 },
        right: { type: "numericLiteral", value: 2 },
      },
    });
    blocks["equal"] = block("operator_equals", {
      inputs: { OPERAND1: lit("una palabra demasiado larga", 10), OPERAND2: lit("palabra", 10) },
    });
    const unsupported = convertScratchProject(scratch);
    expect(unsupported.program.scripts[0]!.statements).toEqual([]);
    expect(unsupported.report.dropped.some((item) => item.what.startsWith("operator_equals"))).toBe(
      true,
    );
  });
});

describe("Scratch clones (#1311)", () => {
  /** A sprite that makes clones of itself, and the script each clone runs. */
  function cloneProject(withHat: boolean, deleteOutside = false) {
    return {
      targets: [
        { isStage: true, name: "Stage", variables: {}, blocks: {} },
        {
          isStage: false,
          name: "Rain",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            flag: block("event_whenflagclicked", { next: "make", topLevel: true }),
            make: block("control_create_clone_of", {
              next: deleteOutside ? "gone" : null,
              inputs: { CLONE_OPTION: [1, "who"] },
            }),
            who: block("control_create_clone_of_menu", {
              fields: { CLONE_OPTION: ["_myself_", null] },
              shadow: true,
            }),
            gone: block("control_delete_this_clone"),
            ...(withHat
              ? {
                  hat: block("control_start_as_clone", { next: "fall", topLevel: true }),
                  fall: block("motion_movesteps", { next: "edge", inputs: { STEPS: lit(10) } }),
                  edge: block("control_delete_this_clone"),
                }
              : {}),
          },
        },
      ],
    };
  }

  it("brings the clone hat across as the character's copy script, and copies keep running it", () => {
    const result = convertScratchProject(cloneProject(true));
    expect(result.program.scripts.map((script) => script.id)).toEqual([
      "studio-actor-1-nova",
      "studio-actor-1-nova-clone",
    ]);
    expect(result.program.scripts[0]!.statements[0]).toMatchObject({
      type: "createCopies",
      withScript: true,
    });
    expect(result.program.scripts[1]!.trigger.type).toBe("onCloneStart");
    expect(result.program.scripts[1]!.statements.map((item) => item.type)).toEqual([
      "move",
      "deleteThisClone",
    ]);
    // Nothing about clones is reported as left behind.
    expect(result.report.dropped.map((item) => item.what).join(" ")).not.toMatch(/clone/);
    // And the result runs: copies are born, run it and end.
    const creative = creativeForStudio(result.program, "forest", "es");
    const run = runMultiActorProgram(result.program, creative);
    expect(run.activations.filter((item) => item.scriptId.endsWith("-clone"))).toHaveLength(3);
    expect(run.actors).toHaveLength(1);
  });

  it("makes plain copies when the sprite has no clone hat, as before", () => {
    const result = convertScratchProject(cloneProject(false));
    expect(result.program.scripts).toHaveLength(1);
    expect(result.program.scripts[0]!.statements[0]).toEqual({
      type: "createCopies",
      count: 3,
      rule: "spread",
    });
    expect(result.report.dropped.map((item) => item.what).join(" ")).toMatch(/plain copies/);
  });

  it("leaves a delete this clone outside a clone script behind, and says so", () => {
    const result = convertScratchProject(cloneProject(true, true));
    expect(result.program.scripts[0]!.statements.map((item) => item.type)).toEqual([
      "createCopies",
    ]);
    expect(result.report.dropped.map((item) => item.what)).toContain(
      "control_delete_this_clone (outside a clone script)",
    );
  });
});

describe("Scratch costume and backdrop number", () => {
  it.each([
    {
      operator: "operator_join",
      input: "STRING1",
      other: "STRING2",
      reporter: "looks_costumenumbername",
      slot: "say",
      expected: "1!",
    },
    {
      operator: "operator_letter_of",
      input: "STRING",
      other: "LETTER",
      reporter: "looks_backdropnumbername",
      slot: "say",
      expected: "1",
    },
    {
      operator: "operator_length",
      input: "STRING",
      other: "",
      reporter: "looks_costumenumbername",
      slot: "number",
      expected: 1,
    },
    {
      operator: "operator_contains",
      input: "STRING1",
      other: "STRING2",
      reporter: "looks_backdropnumbername",
      slot: "condition",
      expected: "Sí",
    },
    {
      operator: "operator_equals",
      input: "OPERAND1",
      other: "OPERAND2",
      reporter: "looks_costumenumbername",
      slot: "condition",
      expected: "Sí",
    },
  ])(
    "keeps $reporter numeric in $operator through Scratch round-trip",
    async ({ operator, input, other, reporter, slot, expected }) => {
      const scratch = project();
      const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
      blocks["hat"] = block("event_whenflagclicked", {
        next: slot === "condition" ? "if" : slot === "number" ? "set" : "say",
        topLevel: true,
      });
      const inputs: Record<string, unknown> = { [input]: [3, "lookNumber", [4, "0"]] };
      if (other) inputs[other] = operator === "operator_join" ? lit("!", 10) : lit(1);
      blocks["operator"] = block(operator, { inputs });
      blocks["lookNumber"] = block(reporter, { fields: { NUMBER_NAME: ["number", null] } });
      blocks["say"] = block("looks_say", { inputs: { MESSAGE: [3, "operator", [10, ""]] } });
      blocks["set"] = block("data_setvariableto", {
        fields: { VARIABLE: ["score", "v1"] },
        inputs: { VALUE: [3, "operator", [4, "0"]] },
      });
      blocks["if"] = block("control_if", {
        inputs: { CONDITION: [2, "operator"], SUBSTACK: [2, "found"] },
      });
      blocks["found"] = block("looks_say", { inputs: { MESSAGE: lit("Sí", 10) } });
      const { program, report } = convertScratchProject(scratch);
      expect(report.dropped.some((item) => item.what.includes(operator))).toBe(false);
      expect(JSON.stringify(program.scripts[0]!.statements[0])).toContain(
        reporter === "looks_costumenumbername"
          ? '"type":"costumeNumber"'
          : '"type":"backdropNumber"',
      );
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      if (slot === "number")
        expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(expected);
      else
        expect(
          run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
        ).toBe(expected);
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements).toEqual(program.scripts[0]!.statements);
    },
  );

  it("drops an unsupported costume reporter mode inside a text operator", () => {
    const scratch = project();
    const blocks = (scratch.targets[1] as { blocks: Record<string, unknown> }).blocks;
    blocks["hat"] = block("event_whenflagclicked", { next: "say", topLevel: true });
    blocks["say"] = block("looks_say", { inputs: { MESSAGE: [3, "join", [10, ""]] } });
    blocks["join"] = block("operator_join", {
      inputs: { STRING1: [3, "lookNumber", [4, "0"]], STRING2: lit("!", 10) },
    });
    blocks["lookNumber"] = block("looks_costumenumbername", {
      fields: { NUMBER_NAME: ["unsupported", null] },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("operator_join"))).toBe(true);
  });

  function numberProject(field: "number" | "name") {
    return {
      targets: [
        { isStage: true, name: "Stage", variables: {}, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            hat: block("event_whenflagclicked", { next: "if", topLevel: true }),
            if: block("control_if", {
              inputs: { CONDITION: [2, "gt"], SUBSTACK: [2, "step"] },
            }),
            step: block("motion_movesteps", { inputs: { STEPS: lit(10) } }),
            gt: block("operator_gt", {
              inputs: { OPERAND1: [3, "num", [4, "0"]], OPERAND2: lit(1) },
            }),
            num: block("looks_costumenumbername", { fields: { NUMBER_NAME: [field, null] } }),
          },
        },
      ],
    };
  }

  it("reads the costume number", () => {
    const { program } = convertScratchProject(numberProject("number"));
    expect(program.scripts[0]!.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "greaterThan", left: { type: "costumeNumber" } },
    });
  });

  it("leaves the costume name out and says so", () => {
    const { program, report } = convertScratchProject(numberProject("name"));
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.length).toBeGreaterThan(0);
  });
});

describe("Scratch variables that hold words", () => {
  function wordProject(value: string, extra: Record<string, unknown> = {}) {
    return {
      targets: [
        {
          isStage: true,
          name: "Stage",
          variables: { w: ["name", "Ana"], n: ["score", 0] },
          blocks: {},
        },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            hat: block("event_whenflagclicked", { next: "set", topLevel: true }),
            set: block("data_setvariableto", {
              next: "num",
              fields: { VARIABLE: ["name", "w"] },
              inputs: { VALUE: lit(value, 10) },
            }),
            num: block("data_setvariableto", {
              fields: { VARIABLE: ["score", "n"] },
              inputs: { VALUE: lit(5) },
            }),
            ...extra,
          },
        },
      ],
    };
  }

  it("keeps a word variable as a word, and numbers as numbers", () => {
    const { program } = convertScratchProject(wordProject("Hola"));
    expect(program.textVariables).toEqual([
      { id: "studio-text-1", name: "name", initialValue: "Ana", visible: true, scope: "stage" },
    ]);
    expect(program.variables?.map((item) => item.name)).toEqual(["score"]);
    expect(program.scripts[0]!.statements[0]).toEqual({
      type: "setText",
      variableId: "studio-text-1",
      value: { type: "textLiteral", value: "Hola" },
    });
    expect(program.scripts[0]!.statements[1]).toMatchObject({ type: "setVariable" });
  });

  it.each([
    ["looks_costumenumbername", "costumeName"],
    ["looks_backdropnumbername", "backdropName"],
  ] as const)("imports %s in name mode into a word variable", async (opcode, property) => {
    const scratch = wordProject("Hola");
    (scratch.targets[0] as { variables: Record<string, unknown> }).variables["w"] = ["name", 0];
    const sprite = scratch.targets[1] as { blocks: Record<string, unknown> };
    sprite.blocks["set"] = block("data_setvariableto", {
      next: "num",
      fields: { VARIABLE: ["name", "w"] },
      inputs: { VALUE: [1, "nameReporter"] },
    });
    sprite.blocks["nameReporter"] = block(opcode, { fields: { NUMBER_NAME: ["name", null] } });
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped).toEqual([]);
    expect(program.scripts[0]!.statements[0]).toEqual({
      type: "setText",
      variableId: "studio-text-1",
      value: {
        type: "actorProperty",
        actorId: property === "backdropName" ? "__stage__" : "actor:studio-1-nova",
        property,
      },
    });
    const creative = creativeForStudio(program, "forest", "es");
    const result = runMultiActorProgram(program, creative);
    expect(result.stage.texts?.["studio-text-1"]?.value).not.toBe("");
    const { bytes } = exportScratchProject(program, "forest", "es");
    const again = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(again.program.scripts[0]!.statements[0]).toEqual(program.scripts[0]!.statements[0]);
  });

  it("rejects an unknown name reporter mode without inventing a word", () => {
    const scratch = wordProject("Hola");
    const sprite = scratch.targets[1] as { blocks: Record<string, unknown> };
    sprite.blocks["set"] = block("data_setvariableto", {
      next: "num",
      fields: { VARIABLE: ["name", "w"] },
      inputs: { VALUE: [1, "nameReporter"] },
    });
    sprite.blocks["nameReporter"] = block("looks_costumenumbername", {
      fields: { NUMBER_NAME: ["other", null] },
    });
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements.map((statement) => statement.type)).toEqual([
      "setVariable",
    ]);
    expect(report.dropped.some((item) => item.what.includes("data_setvariableto"))).toBe(true);
  });

  it("leaves out a word that is too long, and says so", () => {
    const { program, report } = convertScratchProject(
      wordProject("una frase demasiado larga para guardarla"),
    );
    expect(program.scripts[0]!.statements.map((statement) => statement.type)).toEqual([
      "setVariable",
    ]);
    expect(report.dropped.some((item) => item.what.includes("data_setvariableto"))).toBe(true);
  });
});

describe("Scratch name reporters in bubbles", () => {
  it.each([
    ["looks_say", "looks_costumenumbername", "costumeName"],
    ["looks_thinkforsecs", "looks_backdropnumbername", "backdropName"],
  ] as const)("imports %s with a direct %s reporter", async (opcode, reporterOpcode, property) => {
    const scratch = {
      targets: [
        { isStage: true, name: "Stage", variables: {}, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            hat: block("event_whenflagclicked", { next: "bubble", topLevel: true }),
            bubble: block(opcode, {
              inputs: {
                MESSAGE: [1, "nameReporter"],
                ...(opcode.endsWith("forsecs") ? { SECS: lit(2) } : {}),
              },
            }),
            nameReporter: block(reporterOpcode, { fields: { NUMBER_NAME: ["name", null] } }),
          },
        },
      ],
    };
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped).toEqual([]);
    const statement = program.scripts[0]!.statements[0]!;
    expect(statement).toMatchObject({
      type: opcode.includes("say") ? "say" : "think",
      text: "",
      append: { type: "actorProperty", property },
    });
    const creative = creativeForStudio(program, "forest", "es");
    const result = runMultiActorProgram(program, creative);
    const bubble = result.trace.find((entry) => entry.statementType === statement.type)?.worldAfter
      .sprite.bubble;
    expect(bubble?.text.length).toBeGreaterThan(0);
    expect(bubble?.text).toBe(bubble?.text.trim());
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[0]).toEqual(statement);
    expect(() =>
      validateStudioProgram({
        ...program,
        scripts: [{ ...program.scripts[0]!, statements: [{ type: "say", text: "" }] }],
      }),
    ).toThrow();
  });
});

describe("Scratch direct data reporters in bubbles", () => {
  it.each([
    ["looks_say", "score", 7, "variable"],
    ["looks_thinkforsecs", "word", "Hola", "textVariable"],
  ] as const)("imports %s from %s", async (opcode, name, value, type) => {
    const scratch = {
      targets: [
        { isStage: true, name: "Stage", variables: { v: [name, value] }, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            hat: block("event_whenflagclicked", { next: "bubble", topLevel: true }),
            bubble: block(opcode, {
              inputs: {
                MESSAGE: [3, [12, name, "v"], [10, ""]],
                ...(opcode.endsWith("forsecs") ? { SECS: lit(2) } : {}),
              },
            }),
          },
        },
      ],
    };
    const { program, report } = convertScratchProject(scratch);
    expect(report.dropped).toEqual([]);
    const statement = program.scripts[0]!.statements[0]!;
    expect(statement).toMatchObject({
      type: opcode.includes("say") ? "say" : "think",
      text: "",
      append: { type },
    });
    const creative = creativeForStudio(program, "forest", "es");
    const result = runMultiActorProgram(program, creative);
    const bubble = result.trace.find((entry) => entry.statementType === statement.type)?.worldAfter
      .sprite.bubble;
    expect(bubble?.text).toBe(String(value));
    const { bytes } = exportScratchProject(program, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements[0]).toEqual(statement);
  });

  it("drops an unsupported direct reporter and keeps a literal message", () => {
    const scratch = {
      targets: [
        { isStage: true, name: "Stage", variables: {}, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks: {
            hat: block("event_whenflagclicked", { next: "bad", topLevel: true }),
            bad: block("looks_say", { next: "good", inputs: { MESSAGE: [1, "unsupported"] } }),
            unsupported: block("unknown_reporter"),
            good: block("looks_say", { inputs: { MESSAGE: lit("Hola", 10) } }),
          },
        },
      ],
    };
    const { program, report } = convertScratchProject(scratch);
    expect(program.scripts[0]!.statements).toEqual([{ type: "say", text: "Hola" }]);
    expect(report.dropped.some((item) => item.what.includes("looks_say"))).toBe(true);
  });
});

describe("Scratch pen, timer and value hats", () => {
  function sprite(blocks: Record<string, unknown>) {
    return {
      targets: [
        { isStage: true, name: "Stage", variables: {}, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          blocks,
        },
      ],
    };
  }
  const chain = (...opcodes: [string, Record<string, unknown>?][]) => {
    const blocks: Record<string, unknown> = {
      hat: block("event_whenflagclicked", { next: "b0", topLevel: true }),
    };
    opcodes.forEach(([opcode, extra], index) => {
      blocks[`b${index}`] = block(opcode, {
        ...(index + 1 < opcodes.length ? { next: `b${index + 1}` } : {}),
        ...(extra ?? {}),
      });
    });
    return blocks;
  };

  it("maps pen size, colour, transparency and shade to the pen's closed lists", () => {
    const { program } = convertScratchProject(
      sprite({
        m: block("pen_menu_colorParam", { fields: { colorParam: ["transparency", null] } }),
        ...chain(
          ["pen_penDown"],
          ["pen_setPenSizeTo", { inputs: { SIZE: lit(2) } }],
          ["pen_setPenColorToColor", { inputs: { COLOR: [1, [9, "#ff0000"]] } }],
          [
            "pen_setPenColorParamTo",
            {
              inputs: { COLOR_PARAM: [1, "m"], VALUE: lit(60) },
            },
          ],
          ["pen_setPenShadeToNumber", { inputs: { SHADE: lit(90) } }],
        ),
      }),
    );
    const types = program.scripts[0]!.statements.map((statement) => statement.type);
    expect(types).toContain("setPenSize");
    expect(types).toContain("setPenColor");
    expect(types).toContain("setPenShade");
    expect(types).toContain("setPenTransparency");
    expect(program.extensions).toContain("pen");
    expect(
      program.scripts[0]!.statements.find((item) => item.type === "setPenShade"),
    ).toMatchObject({ shade: "lighter" });
  });

  it("reads reset timer", () => {
    const { program } = convertScratchProject(sprite(chain(["sensing_resettimer"])));
    expect(program.scripts[0]!.statements.map((statement) => statement.type)).toEqual([
      "resetTimer",
    ]);
  });

  it("turns 'when timer > N' and 'when loudness > N' into the nearest hat the scene offers", () => {
    const hat = (menu: string, value: number) =>
      convertScratchProject(
        sprite({
          hat: block("event_whengreaterthan", {
            fields: { WHENGREATERTHANMENU: [menu, null] },
            inputs: { VALUE: lit(value) },
            next: "step",
            topLevel: true,
          }),
          step: block("motion_movesteps", { inputs: { STEPS: lit(10) } }),
        }),
      ).program.scripts[0]!.trigger;
    expect(hat("TIMER", 4)).toEqual({ type: "onTimerOver", seconds: 3 });
    expect(hat("LOUDNESS", 45)).toEqual({ type: "onLoudnessOver", level: 50 });
  });

  it("maps effects and volume to the scene's lists, and leaves other effects out", () => {
    const { program, report } = convertScratchProject(
      sprite({
        ...chain(
          [
            "looks_seteffectto",
            { fields: { EFFECT: ["GHOST", null] }, inputs: { VALUE: lit(40) } },
          ],
          [
            "looks_changeeffectby",
            { fields: { EFFECT: ["COLOR", null] }, inputs: { CHANGE: lit(20) } },
          ],
          [
            "looks_seteffectto",
            { fields: { EFFECT: ["FISHEYE", null] }, inputs: { VALUE: lit(40) } },
          ],
          ["looks_cleargraphiceffects"],
          ["sound_setvolumeto", { inputs: { VOLUME: lit(150) } }],
          ["sound_changevolumeby", { inputs: { VOLUME: lit(-20) } }],
        ),
      }),
    );
    const statements = program.scripts[0]!.statements;
    expect(statements.map((statement) => statement.type)).toEqual([
      "setEffect",
      "changeEffect",
      "clearEffects",
      "setVolume",
      "changeVolume",
    ]);
    expect(statements[3]).toMatchObject({ volume: 100 });
    expect(report.dropped.some((item) => item.what.includes("fisheye"))).toBe(true);
  });

  it("maps the Music blocks to the scene's notes, beats, drums, tempo and instruments", () => {
    const { program } = convertScratchProject(
      sprite({
        d: block("music_menu_DRUM", { fields: { DRUM: ["1", null] }, shadow: true }),
        i: block("music_menu_INSTRUMENT", { fields: { INSTRUMENT: ["4", null] }, shadow: true }),
        ...chain(
          ["music_setTempo", { inputs: { TEMPO: lit(100) } }],
          ["music_playNoteForBeats", { inputs: { NOTE: lit(60), BEATS: lit(0.6) } }],
          ["music_playDrumForBeats", { inputs: { BEATS: lit(1), DRUM: [1, "d"] } }],
          ["music_setInstrument", { inputs: { INSTRUMENT: [1, "i"] } }],
        ),
      }),
    );
    expect(program.extensions).toContain("music");
    expect(program.scripts[0]!.statements.map((statement) => statement.type)).toEqual([
      "setTempo",
      "playNote",
      "playDrum",
      "setInstrument",
    ]);
  });

  it("reads 'point in direction' the way the sprite faces: Scratch 90 is right, which is 0 here", () => {
    const point = (direction: number) =>
      convertScratchProject(
        sprite(chain(["motion_pointindirection", { inputs: { DIRECTION: lit(direction) } }])),
      ).program.scripts[0]!.statements[0];
    expect(point(90)).toMatchObject({ type: "pointInDirection", degrees: 0 });
    expect(point(0)).toMatchObject({ type: "pointInDirection", degrees: -90 });
    expect(point(-90)).toMatchObject({ type: "pointInDirection", degrees: 180 });
    expect(point(180)).toMatchObject({ type: "pointInDirection", degrees: 90 });
  });
});

describe("Scratch lists, which hold numbers or words (design: word lists)", () => {
  function listProject(
    blocks: Record<string, unknown>,
    lists: Record<string, [string, unknown[]]> = { L1: ["Compras", []] },
    variables: Record<string, [string, unknown]> = {},
  ) {
    return {
      targets: [
        { isStage: true, name: "Stage", variables, lists, blocks: {} },
        {
          isStage: false,
          name: "Cat",
          x: 0,
          y: 0,
          direction: 90,
          size: 100,
          variables: {},
          lists: {},
          blocks,
        },
      ],
    };
  }
  const flag = (next: string) => block("event_whenflagclicked", { next, topLevel: true });
  const onList = { fields: { LIST: ["Compras", "L1"] } };

  it.each([
    { opcode: "operator_join", input: "STRING1", other: "STRING2", slot: "say" },
    { opcode: "operator_letter_of", input: "STRING", other: "LETTER", slot: "say" },
    { opcode: "operator_length", input: "STRING", other: "", slot: "number" },
    { opcode: "operator_contains", input: "STRING1", other: "STRING2", slot: "condition" },
    { opcode: "operator_equals", input: "OPERAND1", other: "OPERAND2", slot: "condition" },
  ])(
    "imports a list item in $opcode and preserves it through Scratch exchange",
    async ({ opcode, input, other, slot }) => {
      const source = (index: number) =>
        block("data_itemoflist", {
          fields: { LIST: ["Items", "L1"] },
          inputs: { INDEX: lit(index) },
        });
      const inputs: Record<string, unknown> = { [input]: [3, "item", [10, ""]] };
      if (other)
        inputs[other] =
          opcode === "operator_letter_of"
            ? lit(2)
            : opcode === "operator_join"
              ? lit("!", 10)
              : opcode === "operator_equals"
                ? lit("Hola", 10)
                : lit("OL", 10);
      const blocks: Record<string, unknown> = {
        hat: flag(slot === "condition" ? "if" : slot === "number" ? "set" : "say"),
        item: source(opcode === "operator_letter_of" ? 2 : 1),
        reporter: block(opcode, { inputs }),
        say: block("looks_say", { inputs: { MESSAGE: [3, "reporter", [10, ""]] } }),
        set: block("data_setvariableto", {
          fields: { VARIABLE: ["score", "v1"] },
          inputs: { VALUE: [3, "reporter", [4, "0"]] },
        }),
        if: block("control_if", { inputs: { CONDITION: [2, "reporter"], SUBSTACK: [2, "found"] } }),
        found: block("looks_say", { inputs: { MESSAGE: lit("Sí", 10) } }),
      };
      const { program, report } = convertScratchProject(
        listProject(blocks, { L1: ["Items", ["Hola", 12]] }, { v1: ["score", 0] }),
      );
      expect(report.dropped).toEqual([]);
      expect(JSON.stringify(program.scripts[0]!.statements[0])).toContain('"type":"listItem"');
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      if (slot === "number")
        expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(4);
      else
        expect(
          run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
        ).toBe(opcode === "operator_join" ? "Hola!" : opcode === "operator_letter_of" ? "2" : "Sí");
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements).toEqual(program.scripts[0]!.statements);
    },
  );

  it("reports an out-of-range list item in a text operator", () => {
    const { program, report } = convertScratchProject(
      listProject(
        {
          hat: flag("say"),
          say: block("looks_say", { inputs: { MESSAGE: [3, "reporter", [10, ""]] } }),
          reporter: block("operator_join", {
            inputs: {
              STRING1: [3, "item", [10, ""]],
              STRING2: lit("!", 10),
            },
          }),
          item: block("data_itemoflist", {
            fields: { LIST: ["Items", "L1"] },
            inputs: { INDEX: lit(11) },
          }),
        },
        { L1: ["Items", ["Hola"]] },
      ),
    );
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("data_itemoflist"))).toBe(true);
    expect(report.dropped.some((item) => item.what.startsWith("operator_join"))).toBe(true);
  });

  it.each([
    { opcode: "operator_join", input: "STRING1", other: "STRING2", slot: "say", expected: "2!" },
    { opcode: "operator_letter_of", input: "STRING", other: "LETTER", slot: "say", expected: "2" },
    { opcode: "operator_length", input: "STRING", other: "", slot: "number", expected: 1 },
    {
      opcode: "operator_contains",
      input: "STRING1",
      other: "STRING2",
      slot: "condition",
      expected: "Sí",
    },
    {
      opcode: "operator_equals",
      input: "OPERAND1",
      other: "OPERAND2",
      slot: "condition",
      expected: "Sí",
    },
  ])(
    "keeps Scratch list length numeric in $opcode through round-trip",
    async ({ opcode, input, other, slot, expected }) => {
      const inputs: Record<string, unknown> = { [input]: [3, "listLength", [4, "0"]] };
      if (other)
        inputs[other] =
          opcode === "operator_letter_of"
            ? lit(1)
            : opcode === "operator_join"
              ? lit("!", 10)
              : lit(2);
      const { program, report } = convertScratchProject(
        listProject(
          {
            hat: flag(slot === "condition" ? "if" : slot === "number" ? "set" : "say"),
            listLength: block("data_lengthoflist", { fields: { LIST: ["Items", "L1"] } }),
            reporter: block(opcode, { inputs }),
            say: block("looks_say", { inputs: { MESSAGE: [3, "reporter", [10, ""]] } }),
            set: block("data_setvariableto", {
              fields: { VARIABLE: ["score", "v1"] },
              inputs: { VALUE: [3, "reporter", [4, "0"]] },
            }),
            if: block("control_if", {
              inputs: { CONDITION: [2, "reporter"], SUBSTACK: [2, "found"] },
            }),
            found: block("looks_say", { inputs: { MESSAGE: lit("Sí", 10) } }),
          },
          { L1: ["Items", ["Hola", 12]] },
          { v1: ["score", 0] },
        ),
      );
      expect(report.dropped).toEqual([]);
      expect(JSON.stringify(program.scripts[0]!.statements[0])).toContain('"type":"listLength"');
      expect(validateStudioProgram(program)).toEqual(program);
      const run = runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));
      if (slot === "number")
        expect(run.actors[0]!.world.variables?.["studio-var-1"]?.value).toBe(expected);
      else
        expect(
          run.trace.find((entry) => entry.statementType === "say")?.worldAfter.sprite.bubble?.text,
        ).toBe(expected);
      const { bytes } = exportScratchProject(program, "forest", "es");
      const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
      expect(back.program.scripts[0]!.statements).toEqual(program.scripts[0]!.statements);
    },
  );

  it("reports an unknown list length in a Scratch text operator", () => {
    const { program, report } = convertScratchProject(
      listProject(
        {
          hat: flag("say"),
          say: block("looks_say", { inputs: { MESSAGE: [3, "reporter", [10, ""]] } }),
          reporter: block("operator_join", {
            inputs: { STRING1: [3, "listLength", [4, "0"]], STRING2: lit("!", 10) },
          }),
          listLength: block("data_lengthoflist", { fields: { LIST: ["Missing", "missing"] } }),
        },
        { L1: ["Items", ["Hola"]] },
      ),
    );
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("data_lengthoflist"))).toBe(true);
    expect(report.dropped.some((item) => item.what.startsWith("operator_join"))).toBe(true);
  });

  it("keeps a list, adds a word and a number, inserts, replaces, and removes", () => {
    const { program, report } = convertScratchProject(
      listProject({
        hat: flag("a"),
        a: block("data_addtolist", {
          ...onList,
          next: "b",
          inputs: { ITEM: lit("manzana", 10) },
        }),
        b: block("data_addtolist", { ...onList, next: "c", inputs: { ITEM: lit("3", 10) } }),
        c: block("data_insertatlist", {
          ...onList,
          next: "d",
          inputs: { INDEX: lit(1), ITEM: lit("pera", 10) },
        }),
        d: block("data_replaceitemoflist", {
          ...onList,
          next: "e",
          inputs: { INDEX: lit(2), ITEM: lit("uva", 10) },
        }),
        e: block("data_deleteoflist", { ...onList, inputs: { INDEX: lit(1) } }),
      }),
    );
    expect(program.lists).toEqual([
      { id: "studio-list-1", name: "Compras", initialItems: [], visible: true, scope: "stage" },
    ]);
    const types = program.scripts[0]!.statements.map((statement) => statement.type);
    expect(types).toEqual(["listAdd", "listAdd", "listInsertAt", "listReplaceAt", "listRemoveAt"]);
    expect(program.scripts[0]!.statements[0]).toMatchObject({
      value: { type: "textLiteral", value: "manzana" },
    });
    // "3" typed into a list is a number, as in Scratch.
    expect(program.scripts[0]!.statements[1]).toMatchObject({
      value: { type: "numericLiteral", value: 3 },
    });
    expect(report.dropped).toEqual([]);
  });

  it("bounds Stage starting items and reports discarded entries", () => {
    const { program, report } = convertScratchProject(
      listProject(
        {},
        {
          L1: ["Compras", ["abcdefghijklmnopqrstuvw", 101.26, ...Array(9).fill("x")]],
        },
      ),
    );
    expect(program.lists?.[0]).toMatchObject({
      scope: "stage",
      initialItems: ["abcdefghijklmnopqrst", 100, ...Array(8).fill("x")],
    });
    expect(report.blocksAdjusted).toBeGreaterThan(0);
    expect(report.dropped.some((item) => item.what.includes("more than ten starting items"))).toBe(
      true,
    );
  });

  it("reads an item and the length, and keeps a variable as what goes into a list", () => {
    const { program } = convertScratchProject(
      listProject(
        {
          hat: flag("a"),
          a: block("data_addtolist", {
            ...onList,
            next: "b",
            inputs: { ITEM: [3, [12, "puntos", "V1"], [10, ""]] },
          }),
          b: block("data_setvariableto", {
            fields: { VARIABLE: ["puntos", "V1"] },
            inputs: { VALUE: [3, "len", [4, "0"]] },
          }),
          len: block("data_lengthoflist", onList),
        },
        { L1: ["Compras", []] },
        { V1: ["puntos", 0] },
      ),
    );
    const [add, set] = program.scripts[0]!.statements;
    expect(add).toMatchObject({ type: "listAdd", value: { type: "variable" } });
    expect(set).toMatchObject({ type: "setVariable", value: { type: "listLength" } });
  });

  it("leaves starting items, a fourth list, a position out of range and 'delete all' behind, and says so", () => {
    const { program, report } = convertScratchProject(
      listProject(
        {
          hat: flag("a"),
          a: block("data_insertatlist", {
            ...onList,
            next: "b",
            inputs: { INDEX: lit(50), ITEM: lit("x", 10) },
          }),
          b: block("data_deletealloflist", onList),
        },
        {
          L1: ["Compras", ["leche", "pan"]],
          L2: ["Dos", []],
          L3: ["Tres", []],
          L4: ["Cuatro", []],
        },
      ),
    );
    expect(program.lists).toHaveLength(3);
    expect(program.lists![0]!.initialItems).toEqual(["leche", "pan"]);
    const reasons = report.dropped.map((item) => item.what);
    expect(reasons.some((what) => what.includes("starting items"))).toBe(false);
    expect(reasons.some((what) => what.includes("more than three"))).toBe(true);
    expect(reasons.some((what) => what.startsWith("data_insertatlist"))).toBe(true);
    expect(reasons).toContain("data_deletealloflist");
  });

  it("does not keep a word longer than 20 letters", () => {
    const { program, report } = convertScratchProject(
      listProject({
        hat: flag("a"),
        a: block("data_addtolist", { ...onList, inputs: { ITEM: lit("x".repeat(30), 10) } }),
      }),
    );
    expect(program.scripts[0]!.statements).toEqual([]);
    expect(report.dropped.some((item) => item.what.startsWith("data_addtolist"))).toBe(true);
  });
});
