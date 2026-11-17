import { describe, expect, it } from "vitest";
import { selectProjectActor } from "./actorSelection.js";

describe("project actor selection", () => {
  const actors = [{ id: "actor:main" }, { id: "actor:helper" }];

  it("preserves an imported active actor", () => {
    expect(selectProjectActor(actors, "actor:helper")).toBe("actor:helper");
  });

  it("falls back to an available actor for a stale or absent id", () => {
    expect(selectProjectActor(actors, "actor:removed")).toBe("actor:main");
    expect(selectProjectActor([], "actor:helper")).toBe("actor:main");
  });
});
