import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_PREFS,
  PRESENTATION_PREFS_KEY,
  loadPresentationPrefs,
  savePresentationPrefs,
} from "./presentationPrefs.js";

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(PRESENTATION_PREFS_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage;
}

describe("presentation prefs", () => {
  it("defaults when nothing is stored or storage is missing", () => {
    expect(loadPresentationPrefs(memoryStorage())).toEqual(DEFAULT_PRESENTATION_PREFS);
    expect(loadPresentationPrefs(undefined)).toEqual(DEFAULT_PRESENTATION_PREFS);
  });

  it("round-trips world and declines", () => {
    const storage = memoryStorage();
    savePresentationPrefs({ worldId: "ocean.reef", repeatDeclines: 2 }, storage);
    expect(loadPresentationPrefs(storage)).toEqual({ worldId: "ocean.reef", repeatDeclines: 2 });
  });

  it("ignores unknown worlds, bad numbers and corrupt JSON", () => {
    expect(loadPresentationPrefs(memoryStorage('{"worldId":"mars","repeatDeclines":-4}'))).toEqual(
      DEFAULT_PRESENTATION_PREFS,
    );
    expect(loadPresentationPrefs(memoryStorage('{"repeatDeclines":9999}')).repeatDeclines).toBe(10);
    expect(loadPresentationPrefs(memoryStorage("{nope"))).toEqual(DEFAULT_PRESENTATION_PREFS);
  });

  it("never throws when storage rejects writes", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    } as unknown as Storage;
    expect(() => savePresentationPrefs(DEFAULT_PRESENTATION_PREFS, failing)).not.toThrow();
  });
});
