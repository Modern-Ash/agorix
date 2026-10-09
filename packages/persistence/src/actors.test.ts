import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import {
  parseAgorixProject,
  semanticProjectHash,
  serializeAgorixProject,
  validateProjectActors,
  type ProjectActors,
  type StoredProject,
} from "./index.js";

const actors: ProjectActors = {
  activeId: "sprite",
  items: [{ id: "sprite", name: "Cat", x: 12, y: -4, direction: 90, size: 150, visible: false }],
};

const base: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  program: {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
  },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
  },
};

describe("project actors", () => {
  it("round-trips through .agorix and leaves the semantic hash untouched", () => {
    const withActors = { ...base, metadata: { ...base.metadata, actors } };
    const json = serializeAgorixProject(withActors, { exportedAt: "2026-01-02T03:04:05.000Z" });
    expect(parseAgorixProject(json).project.metadata.actors).toEqual(actors);
    expect(semanticProjectHash(parseAgorixProject(json).project)).toBe(
      semanticProjectHash(withActors),
    );
  });

  it("keeps projects without actors loading", () => {
    const json = serializeAgorixProject(base, { exportedAt: "2026-01-02T03:04:05.000Z" });
    expect(parseAgorixProject(json).project.metadata.actors).toBeUndefined();
  });

  it.each([
    ["unknown actor field", { ...actors, items: [{ ...actors.items[0], costume: "x" }] }],
    ["empty name", { ...actors, items: [{ ...actors.items[0], name: "  " }] }],
    ["long name", { ...actors, items: [{ ...actors.items[0], name: "a".repeat(41) }] }],
    ["control characters", { ...actors, items: [{ ...actors.items[0], name: "a\nb" }] }],
    ["direction 360", { ...actors, items: [{ ...actors.items[0], direction: 360 }] }],
    ["size 0", { ...actors, items: [{ ...actors.items[0], size: 0 }] }],
    ["position out of range", { ...actors, items: [{ ...actors.items[0], x: 1e9 }] }],
    ["visible not boolean", { ...actors, items: [{ ...actors.items[0], visible: 1 }] }],
    ["missing active actor", { ...actors, activeId: "other" }],
    ["no actors", { activeId: "sprite", items: [] }],
    ["unknown set field", { ...actors, extra: true }],
  ])("rejects %s", (_label, value) => {
    expect(() => validateProjectActors(value)).toThrow();
  });
});
