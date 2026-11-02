import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectStore, type BrowserStorageAdapter } from "@agorix/persistence";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import {
  advancedEntryUnlocked,
  advancedStageCompleted,
  advancedStageUnlocked,
  completeAdvancedStage,
  ensureAdvancedProject,
} from "./kidsAdvancedProgress.js";

function store(values = new Map<string, string>()): ProjectStore {
  const storage: BrowserStorageAdapter = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => void values.set(key, value),
    remove: (key) => void values.delete(key),
    has: (key) => values.has(key),
  };
  return new ProjectStore({ storage });
}

/** The mission scenes finished in three worlds, as the creative studio saves them. */
function completeKidsMissions(projects: ProjectStore): void {
  const scenes: Record<string, string> = {};
  for (const [index, world] of ["space", "ocean", "robots"].entries()) {
    const missionId = KIDS_MISSION_IDS[index]!;
    const sceneId = `studio-${index + 1}`;
    projects.save(sceneId, getKidsMission(missionId, "es").starterProject, {
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z",
      missionProgress: 1,
      hintLevel: 0,
    });
    scenes[`kids.${world}.${missionId}`] = sceneId;
  }
  const saved = new Map([["agorix.kids.missionScenes.v1", JSON.stringify(scenes)]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("Kids advanced progression", () => {
  it("requires three different authored mission indexes, across worlds", () => {
    const projects = store();
    expect(advancedEntryUnlocked(projects)).toBe(false);
    expect(ensureAdvancedProject("scene", "es", projects)).toBeUndefined();
    completeKidsMissions(projects);
    expect(advancedEntryUnlocked(projects)).toBe(true);
  });

  it("gates stages in order and requires a successful canonical runtime run", () => {
    const values = new Map<string, string>();
    const projects = store(values);
    completeKidsMissions(projects);
    expect(ensureAdvancedProject("react", "es", projects)).toBeUndefined();
    const initial = ensureAdvancedProject("scene", "es", projects)!;
    expect(initial.metadata.advancedProgress).toMatchObject({ stage: "scene", completed: false });
    expect(completeAdvancedStage("scene", projects)).toBe(false);
    projects.save(
      "kids.advanced.scene",
      {
        ...initial.program,
        scripts: [
          {
            ...initial.program.scripts[0]!,
            statements: [
              { type: "switchCostume", costumeId: "asset:costume.spark" },
              { type: "playSound", soundId: "asset:sound.beacon" },
            ],
          },
        ],
      },
      initial.metadata,
    );
    expect(completeAdvancedStage("scene", projects)).toBe(true);
    expect(completeAdvancedStage("scene", projects)).toBe(true);
    expect(advancedStageCompleted("scene", projects)).toBe(true);
    expect(advancedStageUnlocked("react", projects)).toBe(true);
    expect(advancedStageUnlocked("score", projects)).toBe(false);
    const reloaded = store(values);
    expect(advancedStageCompleted("scene", reloaded)).toBe(true);
    const react = ensureAdvancedProject("react", "es", reloaded)!;
    reloaded.save(
      "kids.advanced.react",
      {
        ...react.program,
        scripts: [{ ...react.program.scripts[0]!, statements: [{ type: "turn", degrees: 90 }] }],
      },
      react.metadata,
    );
    expect(completeAdvancedStage("react", reloaded)).toBe(false);
    expect(
      completeAdvancedStage("react", reloaded, { type: "actorClicked", actorId: "actor:ori" }),
    ).toBe(true);
    expect(advancedStageUnlocked("score", reloaded)).toBe(true);
    const score = ensureAdvancedProject("score", "es", reloaded)!;
    reloaded.save(
      "kids.advanced.score",
      {
        ...score.program,
        scripts: [
          {
            ...score.program.scripts[0]!,
            statements: [
              {
                type: "changeVariable",
                variableId: "score",
                delta: { type: "numericLiteral", value: 1 },
              },
            ],
          },
        ],
      },
      score.metadata,
    );
    expect(completeAdvancedStage("score", reloaded)).toBe(true);
    expect(advancedStageCompleted("score", store(values))).toBe(true);
    expect(advancedStageUnlocked("control", reloaded)).toBe(true);
    expect(advancedStageUnlocked("message", reloaded)).toBe(false);
    const control = ensureAdvancedProject("control", "es", reloaded)!;
    reloaded.save(
      "kids.advanced.control",
      {
        ...control.program,
        scripts: [
          {
            ...control.program.scripts[0]!,
            statements: [
              {
                type: "if",
                condition: {
                  type: "greaterOrEqual",
                  left: { type: "variable", variableId: "score" },
                  right: { type: "numericLiteral", value: 0 },
                },
                then: [
                  {
                    type: "setVariable",
                    variableId: "score",
                    value: { type: "numericLiteral", value: 1 },
                  },
                ],
                else: [
                  {
                    type: "setVariable",
                    variableId: "score",
                    value: { type: "numericLiteral", value: 2 },
                  },
                ],
              },
              { type: "wait", seconds: 1 },
            ],
          },
        ],
      },
      control.metadata,
    );
    expect(completeAdvancedStage("control", reloaded)).toBe(true);
    expect(advancedStageUnlocked("message", store(values))).toBe(true);
    const message = ensureAdvancedProject("message", "es", reloaded)!;
    reloaded.save(
      "kids.advanced.message",
      {
        ...message.program,
        scripts: message.program.scripts.map((script, index) => ({
          ...script,
          statements:
            index === 0
              ? [{ type: "broadcast" as const, message: "go" }]
              : [{ type: "move" as const, steps: 1 }],
        })),
      },
      message.metadata,
    );
    expect(completeAdvancedStage("message", reloaded)).toBe(true);
    expect(advancedStageCompleted("message", store(values))).toBe(true);
  });

  it("fails closed on invalid stored progress and preserves the original project", () => {
    const projects = store();
    completeKidsMissions(projects);
    const original = ensureAdvancedProject("scene", "es", projects)!;
    projects.save("kids.advanced.scene", original.program, {
      ...original.metadata,
      advancedProgress: { schema: "bad", stage: "scene", completed: true } as never,
      missionProgress: 1,
    });
    expect(advancedStageUnlocked("react", projects)).toBe(false);
    expect(completeAdvancedStage("scene", projects)).toBe(false);
    expect(projects.load("kids.advanced.scene").metadata.missionProgress).toBe(1);
  });
});
