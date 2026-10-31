import { describe, expect, it } from "vitest";
import { CHOICE_CATALOG, CHOICE_PROMPT_IDS, isChoicePromptId } from "./choiceCatalog.js";

describe("bundled choice catalog", () => {
  it("keeps every prompt closed, localized and within the child-facing answer limit", () => {
    expect(CHOICE_PROMPT_IDS).toEqual(["path", "shape", "count"]);
    expect(
      new Set(
        CHOICE_PROMPT_IDS.flatMap((id) => CHOICE_CATALOG[id].options.map((option) => option.kind)),
      ),
    ).toEqual(new Set(["text", "picture", "number"]));
    for (const id of CHOICE_PROMPT_IDS) {
      const prompt = CHOICE_CATALOG[id];
      expect(prompt.options.length).toBeGreaterThanOrEqual(2);
      expect(prompt.options.length).toBeLessThanOrEqual(4);
      for (const locale of ["es", "en"] as const) {
        expect(prompt.prompt[locale].length).toBeGreaterThan(0);
        expect(prompt.options.every((option) => option[locale].length > 0)).toBe(true);
      }
    }
    expect(isChoicePromptId("child-written-text")).toBe(false);
  });
});
