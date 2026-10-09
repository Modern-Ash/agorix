import { describe, expect, it } from "vitest";
import { FULL_COVERAGE_PROGRAM } from "./fixtures.js";
import { ProgramValidationError } from "./validate.js";
import { validateProjectCreativeState } from "./creative.js";

describe("validateProjectCreativeState", () => {
  it("accepts actors, assets and stage references for the shared creative core", () => {
    const creative = validateProjectCreativeState(
      {
        assets: [
          {
            id: "asset:costume.default",
            kind: "costume",
            name: "Default Costume",
            source: "builtin:costume.default",
          },
          {
            id: "asset:space.trailhead",
            kind: "backdrop",
            name: "Space Trailhead",
            source: "builtin:space.trailhead",
          },
          { id: "costume:rocket", kind: "costume", name: "Rocket", source: "builtin:rocket" },
          { id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" },
          {
            id: "asset:sound.beacon",
            kind: "sound",
            name: "Beacon",
            source: "builtin:sound.beacon",
          },
          { id: "sound:ping", kind: "sound", name: "Ping", source: "builtin:ping" },
        ],
        actors: [
          {
            id: "actor:hero",
            name: "Hero",
            x: 12,
            y: 4,
            direction: 90,
            size: 100,
            visible: true,
            costumeId: "costume:rocket",
            scripts: ["full-coverage"],
          },
        ],
        stage: {
          backdropId: "backdrop:space",
          width: 480,
          height: 320,
          actorOrder: ["actor:hero"],
        },
      },
      FULL_COVERAGE_PROGRAM,
    );

    expect(creative.actors?.[0]?.id).toBe("actor:hero");
    expect(creative.stage?.backdropId).toBe("backdrop:space");
    expect(creative.assets?.map((asset) => asset.kind)).toEqual([
      "costume",
      "backdrop",
      "costume",
      "backdrop",
      "sound",
      "sound",
    ]);
  });

  it("rejects duplicate actor ids deterministically", () => {
    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
            },
            {
              id: "actor:hero",
              name: "Other Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(ProgramValidationError);
  });

  it("rejects unstable actor and asset id tokens", () => {
    expect(() =>
      validateProjectCreativeState(
        {
          assets: [
            {
              id: "../asset",
              kind: "costume",
              name: "Bad",
              source: "builtin:bad",
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              scripts: ["bad script"],
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);
  });

  it("rejects unknown creative, actor, asset and stage fields", () => {
    expect(() =>
      validateProjectCreativeState({ selectedPanel: "stage" }, FULL_COVERAGE_PROGRAM),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          assets: [
            {
              id: "costume:rocket",
              kind: "costume",
              name: "Rocket",
              source: "builtin:rocket",
              blocklyId: "ui-only",
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              selectedNodeId: "ui-only",
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          stage: {
            width: 480,
            height: 320,
            editorSplitSize: 0.5,
          },
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);
  });

  it("rejects non-positive or extreme render dimensions", () => {
    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 0,
              visible: true,
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          stage: {
            width: -1,
            height: 320,
          },
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);

    expect(() =>
      validateProjectCreativeState(
        {
          stage: {
            width: 480,
            height: 4097,
          },
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_CREATIVE_STATE/);
  });

  it("rejects broken costume, backdrop, actor and script references", () => {
    expect(() =>
      validateProjectCreativeState(
        {
          assets: [{ id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin" }],
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              costumeId: "costume:missing",
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_REFERENCE/);

    expect(() =>
      validateProjectCreativeState(
        {
          actors: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              scripts: ["missing-script"],
            },
          ],
        },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_REFERENCE/);

    expect(() =>
      validateProjectCreativeState(
        { actors: [], stage: { backdropId: "backdrop:missing", actorOrder: ["actor:missing"] } },
        FULL_COVERAGE_PROGRAM,
      ),
    ).toThrow(/INVALID_REFERENCE/);
  });

  it("validates sound references from canonical statements", () => {
    const program = {
      ...FULL_COVERAGE_PROGRAM,
      scripts: [
        {
          id: "sound-script",
          trigger: { type: "onStart" as const },
          statements: [
            { type: "playSound" as const, soundId: "sound:ping" },
            { type: "stopSounds" as const },
          ],
        },
      ],
    };

    expect(() =>
      validateProjectCreativeState(
        { assets: [{ id: "sound:ping", kind: "sound", name: "Ping", source: "builtin:ping" }] },
        program,
      ),
    ).not.toThrow();
    expect(() => validateProjectCreativeState({ assets: [] }, program)).toThrow(
      /INVALID_REFERENCE/,
    );
  });
});
