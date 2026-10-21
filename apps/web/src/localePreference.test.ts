import { describe, expect, it } from "vitest";
import {
  APP_DEFAULT_LOCALE,
  LOCALE_PREFERENCE_KEY,
  initialLocale,
  loadLocalePreference,
  saveLocalePreference,
} from "./localePreference.js";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
} as unknown as Storage;

describe("locale preference (issue #351)", () => {
  it("opens in Spanish when nothing is stored and the project has no locale", () => {
    expect(APP_DEFAULT_LOCALE).toBe("es");
    expect(initialLocale(undefined, memoryStorage())).toBe("es");
  });

  it("remembers the learner's choice", () => {
    const storage = memoryStorage();
    saveLocalePreference("en", storage);
    expect(storage.getItem(LOCALE_PREFERENCE_KEY)).toBe("en");
    expect(loadLocalePreference(storage)).toBe("en");
    expect(initialLocale(undefined, storage)).toBe("en");
  });

  it("prefers the project's saved locale over the remembered preference", () => {
    const storage = memoryStorage({ [LOCALE_PREFERENCE_KEY]: "es" });
    expect(initialLocale("en", storage)).toBe("en");
  });

  it("ignores unsupported stored values", () => {
    expect(initialLocale(undefined, memoryStorage({ [LOCALE_PREFERENCE_KEY]: "fr" }))).toBe("es");
  });

  it("falls back to Spanish and does not throw when storage is blocked", () => {
    expect(initialLocale(undefined, throwingStorage)).toBe("es");
    expect(() => saveLocalePreference("en", throwingStorage)).not.toThrow();
  });
});
