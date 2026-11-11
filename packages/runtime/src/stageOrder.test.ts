import { describe, expect, it } from "vitest";
import { reorderActors } from "./stageOrder.js";

// Last in the order is in front.
const order = ["a", "b", "c", "d"];

describe("stage order", () => {
  it("front and back put a character at either end", () => {
    expect(reorderActors(order, "b", { type: "goToLayer", layer: "front" })).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(reorderActors(order, "c", { type: "goToLayer", layer: "back" })).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("forward and backward move a character that many places, and stop at the ends", () => {
    expect(reorderActors(order, "a", { type: "goToLayer", layer: "forward", steps: 2 })).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(reorderActors(order, "d", { type: "goToLayer", layer: "backward", steps: 1 })).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(reorderActors(order, "c", { type: "goToLayer", layer: "forward", steps: 10 })).toEqual([
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(reorderActors(order, "b", { type: "goToLayer", layer: "backward", steps: 10 })).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("leaves the order alone for a character that is not on the stage", () => {
    expect(reorderActors(order, "z", { type: "goToLayer", layer: "forward", steps: 1 })).toEqual(
      order,
    );
  });
});
