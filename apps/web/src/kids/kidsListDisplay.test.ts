import { describe, expect, it } from "vitest";
import { listDisplay } from "./kidsListDisplay.js";

describe("a list in the Data panel", () => {
  it("shows an empty list as a dash and a short list in full, numbers and words alike", () => {
    expect(listDisplay([], "es")).toBe("—");
    expect(listDisplay([1, "hola", 2.5], "es")).toBe("1, hola, 2.5");
  });

  it("shortens by characters and says how many more, in both languages", () => {
    const words = Array.from({ length: 30 }, (_value, at) => `palabra${at}`);
    const es = listDisplay(words, "es");
    expect(es.length).toBeLessThan(160);
    expect(es).toMatch(/ … y \d+ más$/);
    expect(listDisplay(words, "en")).toMatch(/ … and \d+ more$/);
    // Everything shown plus the count adds up to the whole list.
    const shown = es.replace(/ … y \d+ más$/, "").split(", ").length;
    expect(shown + Number(/y (\d+) más/.exec(es)![1])).toBe(30);
  });

  it("always shows the first item, even one longer than the limit", () => {
    expect(listDisplay(["x".repeat(40), "y"], "en", 10)).toBe(`${"x".repeat(40)} … and 1 more`);
  });

  it("keeps a word as plain text: markup stays as the letters the child typed", () => {
    expect(listDisplay(["<b>hola</b>"], "es")).toBe("<b>hola</b>");
  });
});
