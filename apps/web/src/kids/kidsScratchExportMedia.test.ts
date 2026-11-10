import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectAsset, type ProjectProgram } from "@agorix/program-model";
import { bytesOfDataUrl, exportScratchProject, type ScratchPicture } from "./kidsScratchExport.js";
import { scratchPictureOf } from "./kidsScratchPictures.js";
import { readScratchProject } from "./kidsScratchZip.js";
import { validateStudioProgram } from "./kidsStudioModel.js";

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** A valid bounded WAV (mono, 16-bit, 16 kHz) of `samples` samples of silence, as a data URL. */
function wavUrl(samples: number): string {
  const data = samples * 2;
  const bytes = new Uint8Array(44 + data);
  const view = new DataView(bytes.buffer);
  const put = (at: number, text: string) =>
    [...text].forEach((char, index) => (bytes[at + index] = char.charCodeAt(0)));
  put(0, "RIFF");
  view.setUint32(4, 36 + data, true);
  put(8, "WAVE");
  put(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  put(36, "data");
  view.setUint32(40, data, true);
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

const assets: ProjectAsset[] = [
  { id: "costume:studio-art-1", kind: "costume", name: "Mi disfraz", source: ONE_PIXEL_PNG },
  { id: "backdrop:studio-art-2", kind: "backdrop", name: "Mi fondo", source: ONE_PIXEL_PNG },
  { id: "sound:recorded-1", kind: "sound", name: "Mi sonido 1", source: wavUrl(800) },
];

const program = (): ProjectProgram =>
  validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "studio-actor-1-nova",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "switchCostume", costumeId: "costume:nova" },
          { type: "playSound", soundId: "sound:recorded-1" },
          { type: "playSound", soundId: "kids:pop" },
          { type: "switchBackdrop", backdropId: "backdrop:garden" },
          { type: "move", steps: 20 },
        ],
      },
    ],
  });

async function pictures(): Promise<Map<string, ScratchPicture>> {
  const map = new Map<string, ScratchPicture>();
  for (const asset of assets) {
    if (asset.kind === "sound") continue;
    map.set(asset.id, (await scratchPictureOf(asset.source))!);
  }
  return map;
}

async function open(bytes: Uint8Array) {
  return (await readScratchProject(bytes.buffer as ArrayBuffer)) as {
    targets: {
      isStage: boolean;
      currentCostume: number;
      costumes: { name: string; dataFormat: string; md5ext: string }[];
      sounds: { name: string; rate: number; sampleCount: number; md5ext: string }[];
      blocks: Record<string, { opcode: string }>;
    }[];
  };
}

/** The names of the files in the zip, from its central directory. */
function entries(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: string[] = [];
  let eocd = bytes.length - 22;
  while (view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  let at = view.getUint32(eocd + 16, true);
  for (let n = 0; n < view.getUint16(eocd + 10, true); n += 1) {
    const length = view.getUint16(at + 28, true);
    out.push(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + length)));
    at += 46 + length + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return out;
}

describe("the child's own pictures and recordings in the .sb3 (#1312)", () => {
  it("reads a PNG's size without drawing it, and leaves anything else to the decoder", async () => {
    expect(await scratchPictureOf(ONE_PIXEL_PNG)).toMatchObject({ width: 1, height: 1 });
    expect(await scratchPictureOf("data:image/webp;base64,AAAA", async () => null)).toBeNull();
    expect(
      await scratchPictureOf("data:image/webp;base64,AAAA", async () => ({
        png: new Uint8Array([1]),
        width: 7,
        height: 5,
      })),
    ).toEqual({ png: new Uint8Array([1]), width: 7, height: 5 });
    expect(bytesOfDataUrl("not a url")).toBeNull();
  });

  it("puts the child's costume after the character's, and their backdrop after the scene's", async () => {
    const { bytes, report } = exportScratchProject(
      program(),
      "forest",
      "es",
      {},
      {
        assets,
        pictures: await pictures(),
        actorCostumes: { "actor:studio-1-nova": "costume:studio-art-1" },
        stageBackdropId: "backdrop:studio-art-2",
      },
    );
    const project = await open(bytes);
    const stage = project.targets[0]!;
    const sprite = project.targets[1]!;
    expect(sprite.costumes.map((item) => [item.name, item.dataFormat])).toEqual([
      ["Nova", "svg"],
      ["Mi disfraz", "png"],
    ]);
    expect(sprite.currentCostume).toBe(1);
    expect(stage.costumes.map((item) => [item.name, item.dataFormat])).toEqual([
      ["Bosque", "svg"],
      ["Jardín", "svg"],
      ["Mi fondo", "png"],
    ]);
    // The backdrop a block switches to is in the project too; the child's is the one showing.
    expect(stage.currentCostume).toBe(2);
    // Every file the project names is in the zip.
    const files = entries(bytes);
    for (const target of project.targets)
      for (const item of [...target.costumes, ...target.sounds])
        expect(files, item.md5ext).toContain(item.md5ext);
    expect(report.left.map((item) => item.what)).not.toContain(
      "a picture that could not be converted",
    );
  });

  it("writes the recording as a real sound, with its rate and length, playable by a block", async () => {
    const { bytes, report } = exportScratchProject(
      program(),
      "forest",
      "es",
      {},
      {
        assets,
        pictures: await pictures(),
      },
    );
    const sprite = (await open(bytes)).targets[1]!;
    expect(sprite.sounds).toHaveLength(1);
    expect(sprite.sounds[0]).toMatchObject({ name: "Mi sonido 1", rate: 16000, sampleCount: 800 });
    const opcodes = Object.values(sprite.blocks).map((block) => block.opcode);
    expect(opcodes).toContain("sound_play");
    expect(opcodes).toContain("looks_switchcostumeto");
    expect(opcodes).toContain("looks_switchbackdropto");
    // The scene's own built-in sound is not an audio file, so it is still reported, once.
    expect(report.left.find((item) => item.what === "playSound")?.count).toBe(1);
  });

  it("says so when a picture could not be made into a PNG, instead of dropping it silently", () => {
    const { report } = exportScratchProject(program(), "forest", "es", {}, { assets });
    expect(report.left.map((item) => item.what)).toContain("a picture that could not be converted");
  });
});
