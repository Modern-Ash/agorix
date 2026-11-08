import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { convertScratchProject } from "./kidsScratchImport.js";
import { creativeForStudio } from "./kidsStudioModel.js";

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
  it("brings the first script of each sprite across, snapped to the scene's lists", () => {
    const { program, report, positions } = convertScratchProject(project());
    expect(program.scripts).toHaveLength(2);
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
    expect(reasons).toContain("motion_glideto");
    expect(reasons).toContain("another script of the sprite");
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
});
