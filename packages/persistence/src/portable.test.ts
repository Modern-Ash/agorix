import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  AGORIX_PROJECT_FORMAT,
  AGORIX_PROJECT_FORMAT_VERSION,
  AGORIX_PROJECT_MEDIA_TYPE,
  parseAgorixProject,
  sanitizeAgorixFilename,
  serializeAgorixProject,
} from "./index.js";
import { semanticProjectHash } from "./compatibility.js";
import { PersistenceError, type StoredProject } from "./store.js";

const exportedAt = "2026-01-02T03:04:05.000Z";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
};

const storedProject: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  program,
  metadata: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    missionProgress: 0.5,
    hintLevel: 1,
    locale: "es-AR",
    actors: {
      activeId: "actor:hero",
      items: [
        {
          id: "actor:hero",
          name: "Hero",
          x: 12,
          y: 4,
          direction: 90,
          size: 100,
          visible: true,
          costumeId: "costume:rocket",
          scripts: ["main"],
        },
      ],
    },
    stage: {
      backdropId: "backdrop:space",
      width: 480,
      height: 320,
      actorOrder: ["actor:hero"],
    },
    assets: [
      { id: "costume:rocket", kind: "costume", name: "Rocket", source: "builtin:rocket" },
      { id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" },
      { id: "sound:ping", kind: "sound", name: "Ping", source: "builtin:ping" },
    ],
  },
};

function cloneProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    ...structuredClone(storedProject),
    ...overrides,
  };
}

describe(".agorix portable project v1", () => {
  it("parses the committed v1 compatibility fixture", () => {
    const fixture = readFileSync(new URL("../fixtures/v1/minimal.agorix.json", import.meta.url), {
      encoding: "utf8",
    });
    const parsed = parseAgorixProject(fixture);

    expect(parsed.formatVersion).toBe(AGORIX_PROJECT_FORMAT_VERSION);
    expect(parsed.project.program.scripts[0]?.id).toBe("main");
  });

  it("exports human-inspectable JSON with stable format identity and media type", () => {
    const serialized = serializeAgorixProject(storedProject, { exportedAt });
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(AGORIX_PROJECT_MEDIA_TYPE).toBe("application/vnd.agorix.project+json");
    expect(parsed).toMatchObject({
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt,
    });
    expect(serialized).toContain('\n  "project": {');
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("round-trips StoredProject while preserving semantic hash across Web and Studio adapters", () => {
    const webExport = serializeAgorixProject(storedProject, { exportedAt });
    const studioImport = parseAgorixProject(webExport).project;
    const studioExport = serializeAgorixProject(studioImport, { exportedAt });
    const webImport = parseAgorixProject(studioExport).project;

    expect(semanticProjectHash(studioImport)).toBe(semanticProjectHash(storedProject));
    expect(semanticProjectHash(webImport)).toBe(semanticProjectHash(storedProject));
    expect(webImport).toEqual(storedProject);
  });

  it("rejects malformed actor metadata", () => {
    const bad = cloneProject({
      metadata: {
        ...storedProject.metadata,
        actors: {
          activeId: "actor:hero",
          items: [{ id: "actor:hero", name: "Hero", x: 0, y: 0, direction: 0, size: 100 }],
        } as never,
      },
    });
    expect(() => serializeAgorixProject(bad, { exportedAt })).toThrow(/visible/);

    const badScriptRef = cloneProject({
      metadata: {
        ...storedProject.metadata,
        actors: {
          activeId: "actor:hero",
          items: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              scripts: ["main", 7],
            },
          ],
        } as never,
      },
    });
    expect(() => serializeAgorixProject(badScriptRef, { exportedAt })).toThrow(
      /actors\.items\[0\]\.scripts/,
    );
  });

  it("rejects malformed stage ordering metadata", () => {
    const badActorOrder = cloneProject({
      metadata: {
        ...storedProject.metadata,
        stage: {
          ...storedProject.metadata.stage,
          actorOrder: ["actor:hero", 7],
        } as never,
      },
    });
    expect(() => serializeAgorixProject(badActorOrder, { exportedAt })).toThrow(
      /stage\.actorOrder/,
    );
  });

  it("rejects malformed asset metadata before creative reference validation", () => {
    const badKind = cloneProject({
      metadata: {
        ...storedProject.metadata,
        assets: [
          {
            id: "asset:bad",
            kind: "sprite",
            name: "Bad",
            source: "builtin:bad",
          },
        ] as never,
      },
    });
    expect(() => serializeAgorixProject(badKind, { exportedAt })).toThrow(/assets\[0\]\.kind/);

    const badTag = cloneProject({
      metadata: {
        ...storedProject.metadata,
        assets: [
          {
            id: "costume:rocket",
            kind: "costume",
            name: "Rocket",
            source: "builtin:rocket",
            tags: ["starter", ""],
          },
          { id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" },
        ],
      },
    });
    expect(() => serializeAgorixProject(badTag, { exportedAt })).toThrow(/assets\[0\]\.tags/);
  });

  it("normalizes legacy actor appearanceId to canonical costumeId", () => {
    const legacy = cloneProject({
      metadata: {
        ...storedProject.metadata,
        actors: {
          activeId: "actor:hero",
          items: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 12,
              y: 4,
              direction: 90,
              size: 100,
              visible: true,
              appearanceId: "costume:rocket",
              scripts: ["main"],
            },
          ],
        },
      },
    });

    const parsed = parseAgorixProject(serializeAgorixProject(legacy, { exportedAt })).project;

    expect(parsed.metadata.actors?.items[0]).toMatchObject({ costumeId: "costume:rocket" });
    expect(parsed.metadata.actors?.items[0]).not.toHaveProperty("appearanceId");
  });

  it("rejects broken creative references in actors, stage and assets", () => {
    const bad = cloneProject({
      metadata: {
        ...storedProject.metadata,
        actors: {
          activeId: "actor:hero",
          items: [
            {
              id: "actor:hero",
              name: "Hero",
              x: 12,
              y: 4,
              direction: 90,
              size: 100,
              visible: true,
              costumeId: "costume:missing",
            },
          ],
        },
      },
    });

    expect(() => serializeAgorixProject(bad, { exportedAt })).toThrow(/INVALID_REFERENCE/);
  });

  it("does not call network APIs while exporting an anonymous project", () => {
    const previousFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("network must not be used");
    }) as typeof fetch;

    try {
      serializeAgorixProject(storedProject, { exportedAt });
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(calls).toBe(0);
  });

  it("fails safely for corrupt JSON", () => {
    expect(() => parseAgorixProject("{not-json")).toThrow(PersistenceError);
    try {
      parseAgorixProject("{not-json");
    } catch (error) {
      expect((error as PersistenceError).code).toBe("CORRUPTED_DATA");
    }
  });

  it("rejects the wrong format", () => {
    const json = JSON.stringify({
      format: "other-format",
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt,
      project: storedProject,
    });

    expect(() => parseAgorixProject(json)).toThrow(/FORMAT_MISMATCH/);
  });

  it("rejects unsupported future format versions without coercion", () => {
    const json = JSON.stringify({
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: "2",
      exportedAt,
      project: storedProject,
    });

    expect(() => parseAgorixProject(json)).toThrow(/UNSUPPORTED_FORMAT/);
  });

  it("rejects unsupported project schema versions", () => {
    const project = cloneProject({ schemaVersion: "agorix/program/v99" });
    const json = JSON.stringify({
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt,
      project,
    });

    expect(() => parseAgorixProject(json)).toThrow(/UNKNOWN_VERSION/);
  });

  it("checks the size limit before parsing", () => {
    const oversized = `${" ".repeat(20)}{}`;

    expect(() => parseAgorixProject(oversized, { maxBytes: 10 })).toThrow(/FILE_TOO_LARGE/);
  });

  it("rejects account, session, revision, history and telemetry fields", () => {
    const json = JSON.stringify({
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt,
      project: {
        ...storedProject,
        ownerAccountId: "acct-1",
      },
    });

    expect(() => parseAgorixProject(json)).toThrow(/FORBIDDEN_FIELD/);
  });

  it("rejects UI-only state before program validation can strip extra fields", () => {
    const json = JSON.stringify({
      format: AGORIX_PROJECT_FORMAT,
      formatVersion: AGORIX_PROJECT_FORMAT_VERSION,
      exportedAt,
      project: {
        ...storedProject,
        program: {
          ...storedProject.program,
          scripts: [
            {
              ...storedProject.program.scripts[0],
              blocklyId: "surface-only",
            },
          ],
        },
      },
    });

    expect(() => parseAgorixProject(json)).toThrow(/UI-specific field/);
  });

  it("sanitizes friendly download names and prevents path traversal", () => {
    expect(sanitizeAgorixFilename("../My Space Project!!.agorix")).toBe("my-space-project.agorix");
    expect(sanitizeAgorixFilename("  My Space Project.agorix  ")).toBe("my-space-project.agorix");
    expect(sanitizeAgorixFilename("")).toBe("agorix-project.agorix");
  });
});
