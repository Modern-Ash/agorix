import { describe, expect, it } from "vitest";
import {
  DRAG_DISTANCE,
  dropIndex,
  insertIndex,
  isAddButton,
  isAddControl,
  movedFar,
} from "./kidsDrag.js";

describe("drag rules", () => {
  it("tells a tap from a drag by distance", () => {
    expect(movedFar(2, 3)).toBe(false);
    expect(movedFar(DRAG_DISTANCE, 0)).toBe(false);
    expect(movedFar(6, 6)).toBe(true);
    expect(movedFar(0, -20)).toBe(true);
  });

  it("finds the place under the pointer", () => {
    const rows = [
      { top: 0, height: 40 },
      { top: 40, height: 40 },
      { top: 80, height: 40 },
    ];
    expect(dropIndex(rows, 5)).toBe(0);
    expect(dropIndex(rows, 25)).toBe(1);
    expect(dropIndex(rows, 59)).toBe(1);
    expect(dropIndex(rows, 61)).toBe(2);
    expect(dropIndex(rows, 500)).toBe(2);
    expect(dropIndex(rows, -50)).toBe(0);
    expect(dropIndex([], 10)).toBe(0);
  });

  it("recognises add buttons by their plus", () => {
    expect(isAddButton("+ Mover")).toBe(true);
    expect(isAddButton("  + Girar a la derecha")).toBe(true);
    expect(isAddButton("Jugar")).toBe(false);
    expect(isAddButton("Deshacer")).toBe(false);
    expect(isAddButton(null)).toBe(false);
  });

  it("recognises snap-together blocks that keep the plus only in the accessible name", () => {
    expect(isAddControl({ textContent: "Mover", dataset: { kidsAdd: "true" } })).toBe(true);
    expect(isAddControl({ textContent: "Mover", dataset: {} })).toBe(false);
    expect(isAddControl({ textContent: "Mover" })).toBe(false);
    // Preview and group tools share a block's values but never start a drag.
    expect(isAddControl({ textContent: "▶ Sonar", dataset: {} })).toBe(false);
    expect(isAddControl({ textContent: "Repetir estos bloques", dataset: {} })).toBe(false);
    // Legacy palette buttons keep working without the opt-in attribute.
    expect(isAddControl({ textContent: "+ Mover", dataset: {} })).toBe(true);
    expect(isAddControl({ textContent: "Agregar personaje" })).toBe(false);
    expect(isAddControl({ textContent: null })).toBe(false);
  });

  it("finds where a block would be inserted, including at the end and in an empty list", () => {
    const rows = [
      { top: 0, height: 40 },
      { top: 40, height: 40 },
    ];
    expect(insertIndex(rows, 10)).toBe(0);
    expect(insertIndex(rows, 30)).toBe(1);
    expect(insertIndex(rows, 79)).toBe(2);
    expect(insertIndex(rows, 900)).toBe(2);
    expect(insertIndex([], 5)).toBe(0);
  });
});
