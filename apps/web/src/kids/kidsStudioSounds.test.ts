import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import {
  addStudioSound,
  createStudioProject,
  exportStudioProject,
  importStudioProject,
  listStudioProjects,
  saveStudioProject,
  addStudioArt,
} from "./kidsStudioProjects.js";
import { appendStudioStatement, isStudioRecordedSoundId } from "./kidsStudioModel.js";
import { playKidsSound } from "./kidsSoundPlayer.js";

function wav(samples = 1600, rate = 22050): string {
  const size = samples * 2;
  const bytes = new Uint8Array(44 + size);
  const view = new DataView(bytes.buffer);
  const put = (at: number, text: string) =>
    [...text].forEach((char, index) => (bytes[at + index] = char.charCodeAt(0)));
  put(0, "RIFF");
  view.setUint32(4, 36 + size, true);
  put(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  put(36, "data");
  view.setUint32(40, size, true);
  return `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`;
}

function memory() {
  const data = new Map<string, string>();
  const storage: BrowserStorageAdapter = {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
    has: (key) => data.has(key),
  };
  const index = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { store: new ProjectStore({ storage }), index };
}

describe("recordings kept in a studio project", () => {
  it("keeps a recording as a sound a block can play, up to eight", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const first = addStudioSound(project.id, wav(), "es", store);
    expect(first).toBe("sound:recorded-1");
    expect(isStudioRecordedSoundId(first)).toBe(true);
    const saved = store.load(project.id);
    expect(saved.metadata.assets?.find((asset) => asset.id === first)?.name).toBe("Mi sonido 1");
    for (let n = 2; n <= 8; n += 1) addStudioSound(project.id, wav(), "es", store);
    expect(() => addStudioSound(project.id, wav(), "es", store)).toThrow(/limit/);
  });

  it("rejects anything that is not a bounded WAV recording", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    expect(() => addStudioSound(project.id, "data:audio/mpeg;base64,AAAA", "es", store)).toThrow();
    expect(() => addStudioSound(project.id, wav(1600, 44100), "es", store)).toThrow();
  });

  it("lets a block play the recording and leaves pictures numbered on their own", () => {
    const { store, index } = memory();
    const project = createStudioProject("nova", "forest", "es", store, index);
    const sound = addStudioSound(project.id, wav(), "es", store);
    const history = appendStudioStatement(
      createEditorHistory(store.load(project.id).program),
      "actor:studio-1-nova",
      { type: "playSound", soundId: sound },
    );
    saveStudioProject(project.id, history.current, "forest", "actor:studio-1-nova", "es", store);
    expect(listStudioProjects(index).length).toBe(1);
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==";
    const art = addStudioArt(project.id, "costume", "actor:studio-1-nova", png, "es", store, index);
    expect(art).toBe("costume:studio-art-1");
    // A recording leaves the device only with the adult's choice, like a picture.
    expect(() => exportStudioProject(project.id, store)).toThrow(/opt-in/);
    const exported = exportStudioProject(project.id, store, true);
    const copy = importStudioProject(exported, "es", store, index);
    expect(store.load(copy.id).metadata.assets?.some((asset) => asset.id === sound)).toBe(true);
  });

  it("plays a project recording from its data, and stays quiet when it will not decode", async () => {
    const started: string[] = [];
    const context = (decode: () => Promise<unknown>) =>
      ({
        currentTime: 0,
        destination: {},
        decodeAudioData: decode,
        createBufferSource: () => ({
          connect: (x: unknown) => x,
          start: () => started.push("start"),
          addEventListener: () => undefined,
          set onended(_value: unknown) {},
        }),
        createGain: () => ({
          gain: { setValueAtTime: () => undefined },
          connect: (x: unknown) => x,
        }),
        close: async () => undefined,
      }) as unknown as AudioContext;
    const source = wav();
    await playKidsSound("sound:recorded-1", { kind: "gallery", id: "fox" } as never, {
      createContext: () => context(async () => ({})),
      recorded: () => source,
    });
    expect(started).toEqual(["start"]);
    await playKidsSound("sound:recorded-1", { kind: "gallery", id: "fox" } as never, {
      createContext: () => context(async () => Promise.reject(new Error("bad"))),
      recorded: () => source,
    });
    await playKidsSound("sound:recorded-1", { kind: "gallery", id: "fox" } as never, {
      createContext: () => context(async () => ({})),
      recorded: () => undefined,
    });
    expect(started).toEqual(["start"]);
  });
});
