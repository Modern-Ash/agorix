import { describe, expect, it } from "vitest";
import { paramIdentifiers } from "./procedures.js";

describe("paramIdentifiers (#538 numbers for custom blocks)", () => {
  it("makes ASCII n_ identifiers: accents and symbols removed, lower case", () => {
    expect(
      paramIdentifiers([
        { id: "p1", name: "Ángulo" },
        { id: "p2", name: "tamaño grande" },
        { id: "p3", name: "lado-2" },
      ]),
    ).toEqual(["n_angulo", "n_tamano_grande", "n_lado_2"]);
  });

  it("never yields a keyword, a digit start or a repeat", () => {
    const ids = paramIdentifiers([
      { id: "p1", name: "if" },
      { id: "p2", name: "a b" },
      { id: "p3", name: "a_b" },
    ]);
    expect(ids).toEqual(["n_if", "n_a_b", "n_a_b_2"]);
    for (const id of ids) expect(id).toMatch(/^n_[a-z0-9_]+$/);
    expect(new Set(ids).size).toBe(3);
  });

  it("falls back to a numbered name when the title has no letters or digits", () => {
    expect(
      paramIdentifiers([
        { id: "p1", name: "___" },
        { id: "p2", name: "---" },
      ]),
    ).toEqual(["n_1", "n_2"]);
  });
});
