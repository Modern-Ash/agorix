import { describe, expect, it } from "vitest";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import { bringScratchPictures } from "./kidsScratchPictureImport.js";
import { convertScratchProject } from "./kidsScratchImport.js";
import { md5Hex, zipStored } from "./kidsScratchPack.js";
import { importScratchStudioProject } from "./kidsStudioProjects.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";

function memory() {
  const data = new Map<string, string>();
  const adapter: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    has: (key) => data.has(key),
  };
  const index = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { store: new ProjectStore({ storage: adapter }), index };
}

const bytes = (...values: number[]) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...values]);
const catPng = bytes(1, 2, 3);
const dogPng = bytes(4, 5, 6);
const skyPng = bytes(7, 8, 9);
const nameOf = (data: Uint8Array) => `${md5Hex(data)}.png`;

function sprite(name: string, file: string | undefined) {
  return {
    isStage: false,
    name,
    x: 0,
    y: 0,
    direction: 90,
    size: 100,
    variables: {},
    blocks: {},
    currentCostume: 0,
    costumes: file === undefined ? [] : [{ name: "a", md5ext: file }],
  };
}

const project = (sprites: ReturnType<typeof sprite>[], backdrop?: string) => ({
  targets: [
    {
      isStage: true,
      name: "Stage",
      variables: {},
      blocks: {},
      currentCostume: 0,
      costumes: backdrop === undefined ? [] : [{ name: "b", md5ext: backdrop }],
    },
    ...sprites,
  ],
});

describe("bringing a Scratch project's pictures across", () => {
  it("names the picture each character and the stage were wearing", () => {
    const converted = convertScratchProject(
      project(
        [sprite("Cat", nameOf(catPng)), sprite("Dog", nameOf(dogPng)), sprite("Bare", undefined)],
        nameOf(skyPng),
      ),
    );
    expect(Object.values(converted.pictures.costumes)).toEqual([nameOf(catPng), nameOf(dogPng)]);
    expect(converted.pictures.backdrop).toBe(nameOf(skyPng));
  });

  it("ignores a file name that is not a Scratch picture name", () => {
    const converted = convertScratchProject(
      project([sprite("Cat", "../../etc/passwd.png"), sprite("Dog", "abc.png")], "x.svg"),
    );
    expect(converted.pictures.costumes).toEqual({});
    expect(converted.pictures.backdrop).toBeUndefined();
  });

  it("gives each character and the stage their picture, keeping one asset for a shared file", async () => {
    const { store, index } = memory();
    const raw = project(
      [
        sprite("Cat", nameOf(catPng)),
        sprite("Twin", nameOf(catPng)),
        sprite("Dog", nameOf(dogPng)),
      ],
      nameOf(skyPng),
    );
    const imported = convertScratchProject(raw);
    const scene = importScratchStudioProject(imported, "es", store, index);
    const buffer = zipStored([
      { name: "project.json", bytes: new TextEncoder().encode(JSON.stringify(raw)) },
      { name: nameOf(catPng), bytes: catPng },
      { name: nameOf(dogPng), bytes: dogPng },
      { name: nameOf(skyPng), bytes: skyPng },
    ]).buffer as ArrayBuffer;
    const done = await bringScratchPictures({
      buffer,
      imported,
      sceneId: scene.id,
      locale: "es",
      store,
      storage: index,
      toDataUrl: async () => png,
    });
    expect(done).toEqual({ brought: 4, left: 0 });
    const saved = store.load(scene.id).metadata;
    const art = (saved.assets ?? []).filter((asset) => asset.source.startsWith("data:image"));
    // cat and twin share one costume asset; the dog has one; the sky is the backdrop.
    expect(art.filter((asset) => asset.kind === "costume")).toHaveLength(2);
    expect(art.filter((asset) => asset.kind === "backdrop")).toHaveLength(1);
    const worn = (saved.actors?.items ?? []).map((actor) => actor.costumeId);
    expect(new Set(worn.slice(0, 2)).size).toBe(1);
  });

  it("leaves the gallery character when a picture is missing, too big or unreadable", async () => {
    const { store, index } = memory();
    const raw = project([sprite("Cat", nameOf(catPng)), sprite("Dog", nameOf(dogPng))]);
    const imported = convertScratchProject(raw);
    const scene = importScratchStudioProject(imported, "es", store, index);
    const buffer = zipStored([
      { name: "project.json", bytes: new TextEncoder().encode(JSON.stringify(raw)) },
      { name: nameOf(catPng), bytes: catPng },
    ]).buffer as ArrayBuffer;
    const done = await bringScratchPictures({
      buffer,
      imported,
      sceneId: scene.id,
      locale: "es",
      store,
      storage: index,
      toDataUrl: async () => {
        throw new Error("cannot read");
      },
    });
    expect(done).toEqual({ brought: 0, left: 2 });
    const saved = store.load(scene.id).metadata;
    expect((saved.assets ?? []).some((asset) => asset.source.startsWith("data:image"))).toBe(false);
  });
});
