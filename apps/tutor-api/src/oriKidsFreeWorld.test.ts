import { describe, expect, it } from "vitest";
import { createFreeWorldMission } from "@agorix/curriculum";
import type { StoredProject } from "@agorix/persistence";
import { oriKidsFreeWorld } from "./oriKidsFreeWorld.js";

const project = {
  schemaVersion: "agorix/program/v1",
  program: { schema: "agorix/program/v1", scripts: [] },
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    missionProgress: 0,
    hintLevel: 0,
    missionSpec: { goal: "kids.cell.4.2", successCheck: "touches-goal" },
  },
} as StoredProject;

describe("Ori Kids world from persisted project", () => {
  it("uses the verified free-world mission stage", () => {
    expect(oriKidsFreeWorld(project)).toEqual(
      createFreeWorldMission({ cx: 4, cy: 2 }, "es").starterStage,
    );
  });

  it("fails closed for missing or invalid free-world goals", () => {
    expect(
      oriKidsFreeWorld({ ...project, metadata: { ...project.metadata, missionSpec: undefined } }),
    ).toBeNull();
    expect(
      oriKidsFreeWorld({
        ...project,
        metadata: {
          ...project.metadata,
          missionSpec: { goal: "kids.cell.6.2", successCheck: "touches-goal" },
        },
      }),
    ).toBeNull();
  });
});
