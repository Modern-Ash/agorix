import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Script } from "@agorix/program-model";
import { runMultiActorProgram } from "@agorix/runtime";
import { exportScratchProject } from "./kidsScratchExport.js";
import { convertScratchProject } from "./kidsScratchImport.js";
import { readScratchProject } from "./kidsScratchZip.js";
import { md5Hex } from "./kidsScratchPack.js";
import { creativeForStudio, validateStudioProgram } from "./kidsStudioModel.js";

const flag = { type: "greenFlag" } as const;

function program(scripts: Script[], extra: Partial<ProjectProgram> = {}): ProjectProgram {
  return validateStudioProgram({ schema: SCHEMA_VERSION, scripts, ...extra });
}

const nova = (statements: Script["statements"], trigger: Script["trigger"] = flag): Script => ({
  id: "studio-actor-1-nova",
  trigger,
  statements,
});

async function open(bytes: Uint8Array) {
  const project = (await readScratchProject(bytes.buffer as ArrayBuffer)) as {
    targets: {
      isStage: boolean;
      blocks: Record<string, Record<string, unknown>>;
      costumes: { md5ext: string; assetId: string }[];
      name: string;
    }[];
  };
  return project;
}

describe("exporting a scene to a Scratch .sb3 (#1312)", () => {
  const sample = program(
    [
      nova([
        { type: "move", steps: 40 },
        { type: "turn", degrees: 90 },
        { type: "say", text: "Hola", seconds: 2 },
        { type: "repeat", count: 3, body: [{ type: "changeX", dx: 20 }] },
        { type: "wait", seconds: 1 },
        { type: "setSize", size: 150 },
      ]),
      {
        id: "studio-actor-1-nova-s2",
        trigger: { type: "onKeyPressed", key: "ArrowRight" },
        statements: [{ type: "move", steps: 20 }],
      },
    ],
    {},
  );

  it("writes a zip with project.json and a picture for every costume and backdrop", async () => {
    const { bytes } = exportScratchProject(sample, "forest", "es");
    const project = await open(bytes);
    expect(project.targets[0]!.isStage).toBe(true);
    expect(project.targets).toHaveLength(2);
    for (const target of project.targets)
      for (const costume of target.costumes) {
        expect(costume.md5ext).toBe(`${costume.assetId}.svg`);
        expect(costume.assetId).toMatch(/^[0-9a-f]{32}$/);
      }
    // The file names are the MD5 of the bytes inside, as Scratch expects.
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(md5Hex(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("is deterministic: the same scene gives the same bytes", () => {
    expect(exportScratchProject(sample, "forest", "es").bytes).toEqual(
      exportScratchProject(sample, "forest", "es").bytes,
    );
  });

  it("writes well-formed blocks: unique ids, parents and next pointers that agree", async () => {
    const project = await open(exportScratchProject(sample, "forest", "es").bytes);
    const blocks = project.targets[1]!.blocks;
    for (const [id, block] of Object.entries(blocks)) {
      const next = block["next"] as string | null;
      if (next !== null) expect(blocks[next]!["parent"]).toBe(id);
      if (block["topLevel"] === true) expect(block["parent"]).toBeNull();
      else expect(blocks[block["parent"] as string], id).toBeDefined();
    }
    expect(Object.values(blocks).filter((block) => block["topLevel"] === true)).toHaveLength(2);
  });

  it("round-trips through the importer: the same blocks come back", async () => {
    const { bytes } = exportScratchProject(sample, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    const [main, second] = back.program.scripts;
    expect(main!.trigger).toEqual({ type: "greenFlag" });
    expect(main!.statements).toEqual(sample.scripts[0]!.statements);
    expect(second!.trigger).toEqual({ type: "onKeyPressed", key: "ArrowRight" });
    expect(second!.statements).toEqual(sample.scripts[1]!.statements);
    expect(back.report.dropped).toEqual([]);
    const creative = creativeForStudio(back.program, back.backdropId, "es", back.positions);
    expect(runMultiActorProgram(back.program, creative).trace.length).toBeGreaterThan(0);
  });

  it("says what Scratch cannot hold instead of guessing", () => {
    const withSound = program([
      nova([
        { type: "move", steps: 40 },
        { type: "playSound", soundId: "kids:pop" },
      ]),
    ]);
    const { report } = exportScratchProject(withSound, "forest", "es");
    expect(report.blocksExported).toBe(1);
    expect(report.left.map((item) => item.what)).toContain("playSound");
  });
});

describe("a wide scene round-trips through the importer (#1312)", () => {
  const wide = program(
    [
      nova([
        { type: "goTo", x: 100, y: 40 },
        { type: "pointInDirection", degrees: 90 },
        { type: "bounceOnEdge" },
        { type: "goToTarget", target: "random" },
        { type: "show" },
        { type: "hide" },
        { type: "changeSize", delta: 25 },
        { type: "goToLayer", layer: "back" },
        { type: "setEffect", effect: "ghost", value: 50 },
        { type: "changeEffect", effect: "color", delta: 25 },
        { type: "clearEffects" },
        { type: "setVolume", volume: 60 },
        { type: "resetTimer" },
        { type: "penDown" },
        { type: "setPenColor", color: "red" },
        { type: "setPenSize", size: 8 },
        { type: "setPenTransparency", percent: 50 },
        { type: "setPenShade", shade: "darker" },
        { type: "stamp" },
        { type: "penUp" },
        { type: "clearPen" },
        { type: "playNote", note: 60, beats: 0.5 },
        { type: "playDrum", drum: "kick", beats: 1 },
        { type: "setTempo", bpm: 120 },
        { type: "setInstrument", instrument: "bell" },
        {
          type: "if",
          condition: { type: "keyDown", key: "Space" },
          then: [{ type: "move", steps: 20 }],
          else: [{ type: "turn", degrees: -90 }],
        },
        { type: "forever", body: [{ type: "wait", seconds: 1 }] },
      ]),
    ],
    { extensions: ["pen", "music"] },
  );

  it("brings every block back with the same values, and reports nothing left behind", async () => {
    const { bytes, report } = exportScratchProject(wide, "forest", "es");
    expect(report.left).toEqual([]);
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements).toEqual(wide.scripts[0]!.statements);
    expect(back.program.extensions).toEqual(["pen", "music"]);
  });
});

describe("a scene with a list that holds numbers or words round-trips (design: word lists)", () => {
  const at = (index: number) =>
    ({
      type: "listItem",
      listId: "studio-list-1",
      index: { type: "numericLiteral", value: index },
    }) as const;
  const withList = program(
    [
      nova([
        // Scratch variables have no type: a word variable comes back as one when it is set to a word.
        {
          type: "setText",
          variableId: "studio-text-1",
          value: { type: "textLiteral", value: "kiwi" },
        },
        { type: "listAdd", listId: "studio-list-1", value: { type: "textLiteral", value: "pera" } },
        { type: "listAdd", listId: "studio-list-1", value: { type: "numericLiteral", value: 3 } },
        {
          type: "listInsertAt",
          listId: "studio-list-1",
          index: { type: "numericLiteral", value: 1 },
          value: { type: "textLiteral", value: "uva" },
        },
        {
          type: "listReplaceAt",
          listId: "studio-list-1",
          index: { type: "numericLiteral", value: 2 },
          value: { type: "textVariable", variableId: "studio-text-1" },
        },
        {
          type: "listRemoveAt",
          listId: "studio-list-1",
          index: { type: "numericLiteral", value: 3 },
        },
        { type: "setText", variableId: "studio-text-1", value: at(1) },
        {
          type: "setVariable",
          variableId: "studio-var-1",
          value: { type: "listLength", listId: "studio-list-1" },
        },
        { type: "setVariable", variableId: "studio-var-1", value: at(2) },
      ]),
    ],
    {
      variables: [{ id: "studio-var-1", name: "Cuantas", initialValue: 0, visible: true }],
      textVariables: [{ id: "studio-text-1", name: "Fruta", initialValue: "", visible: true }],
      lists: [{ id: "studio-list-1", name: "Compras", initialItems: [], visible: true }],
    },
  );

  it("writes the list on the stage, empty, and every list block with its list named", async () => {
    const { bytes, report } = exportScratchProject(withList, "forest", "es");
    expect(report.left).toEqual([]);
    const project = (await readScratchProject(bytes.buffer as ArrayBuffer)) as {
      targets: {
        isStage: boolean;
        lists: Record<string, [string, unknown[]]>;
        blocks: Record<string, { opcode: string; fields: Record<string, unknown[]> }>;
      }[];
    };
    expect(project.targets[0]!.lists).toEqual({ "studio-list-1": ["Compras", []] });
    const opcodes = Object.values(project.targets[1]!.blocks).map((block) => block.opcode);
    for (const wanted of [
      "data_addtolist",
      "data_insertatlist",
      "data_replaceitemoflist",
      "data_deleteoflist",
      "data_itemoflist",
      "data_lengthoflist",
    ])
      expect(opcodes).toContain(wanted);
    const add = Object.values(project.targets[1]!.blocks).find(
      (block) => block.opcode === "data_addtolist",
    )!;
    expect(add.fields["LIST"]).toEqual(["Compras", "studio-list-1"]);
  });

  it("comes back through the importer as the same blocks, words and numbers alike", async () => {
    const { bytes } = exportScratchProject(withList, "forest", "es");
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.report.dropped).toEqual([]);
    expect(back.program.lists).toEqual(withList.lists);
    expect(back.program.scripts[0]!.statements).toEqual(withList.scripts[0]!.statements);
  });
});

describe("going to another character round-trips (Scratch go to / glide to sprite)", () => {
  const two = program([
    nova([
      { type: "goToTarget", target: "actor", actorId: "actor:studio-2-mika" },
      { type: "goToTarget", target: "actor", actorId: "actor:studio-2-mika", seconds: 1 },
      { type: "goToTarget", target: "mouse", seconds: 2 },
    ]),
    { id: "studio-actor-2-mika", trigger: flag, statements: [] },
  ]);

  it("names the other sprite in the menu and brings the same blocks back", async () => {
    const { bytes, report } = exportScratchProject(two, "forest", "es");
    expect(report.left).toEqual([]);
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    const creative = creativeForStudio(back.program, back.backdropId, "es", back.positions);
    const second = creative.actors![1]!.id;
    expect(back.program.scripts[0]!.statements).toEqual([
      { type: "goToTarget", target: "actor", actorId: second },
      { type: "goToTarget", target: "actor", actorId: second, seconds: 1 },
      { type: "goToTarget", target: "mouse", seconds: 2 },
    ]);
  });
});

describe("math functions round-trip through Scratch's operators", () => {
  const names = [
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
  ] as const;
  const withMath = program(
    [
      nova(
        names.map((name) => ({
          type: "setVariable" as const,
          variableId: "studio-var-1",
          value: {
            type: "mathFunction" as const,
            function: name,
            value: { type: "numericLiteral" as const, value: 9 },
          },
        })),
      ),
    ],
    { variables: [{ id: "studio-var-1", name: "n", initialValue: 0, visible: true }] },
  );

  it("brings every function back, and reports nothing left behind", async () => {
    const { bytes, report } = exportScratchProject(withMath, "forest", "es");
    expect(report.left).toEqual([]);
    const back = convertScratchProject(await readScratchProject(bytes.buffer as ArrayBuffer));
    expect(back.program.scripts[0]!.statements).toEqual(withMath.scripts[0]!.statements);
  });
});
