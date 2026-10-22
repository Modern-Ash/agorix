import { describe, expect, it } from "vitest";
import { recordKidsReflection } from "./kidsEvidence.js";

describe("Kids reflection evidence (issue #376)", () => {
  it("stores only schema-validated, text-free events in session storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const first = recordKidsReflection("decision", storage);
    const second = recordKidsReflection("verification", storage);
    expect(first.kind).toBe("reflectionRecorded");
    expect(second.sequence).toBe(2);
    const raw = [...values.values()][0] ?? "";
    expect(raw).toContain('"contentRetained":false');
    expect(raw).not.toContain("face");
    expect(raw).not.toContain("freeText");
    expect(raw).not.toContain("timestamp");
  });
});
