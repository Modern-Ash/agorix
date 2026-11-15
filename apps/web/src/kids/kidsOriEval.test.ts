import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EVAL_INTENTS, evalMarkdown, evalTotals, evaluateOri } from "./kidsOriEval.js";

const REPORT = fileURLToPath(new URL("../../../../docs/product/ORI_EVAL.md", import.meta.url));
const START = "<!-- eval:start -->";
const END = "<!-- eval:end -->";

describe("Ori's ideas measured on a fixed set of scenes", () => {
  it("never offers an idea that is invalid or that stops the program", () => {
    const rows = evaluateOri();
    const total = evalTotals(rows);
    expect(total.offered).toBeGreaterThan(EVAL_INTENTS.length);
    expect(rows.filter((row) => row.invalid > 0).map((row) => row.intent)).toEqual([]);
    expect(rows.filter((row) => row.stops > 0).map((row) => row.intent)).toEqual([]);
  });

  it("gives the same numbers in Spanish and in English", () => {
    expect(evaluateOri("en")).toEqual(evaluateOri("es"));
  });

  it("publishes the same numbers in docs/product/ORI_EVAL.md", () => {
    const block = `${START}\n\n${evalMarkdown(evaluateOri())}\n\n${END}`;
    const plain = (text: string) =>
      text
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .replace(/-{3,}/g, "---");
    expect(
      plain(readFileSync(REPORT, "utf8")).includes(plain(block)),
      `ORI_EVAL.md is out of date. Replace what is between the markers with:\n${block}`,
    ).toBe(true);
  });
});
