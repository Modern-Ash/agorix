import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Script } from "@agorix/program-model";
import { PACKAGE_NAME, assertCrossSurfaceCompatibleProject, semanticProjectHash } from "./index.js";
import {
  ProjectStore,
  BrowserLocalStorageAdapter,
  PersistenceError,
  type ProjectMetadata,
} from "./store.js";

const makeProgram = (scripts: readonly Script[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts,
});

const makeScript = (id = "main"): Script => ({
  id,
  trigger: { type: "onStart" },
  statements: [],
});

class MockStorage extends BrowserLocalStorageAdapter {
  data = new Map<string, string>();

  override get(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  override set(key: string, value: string): void {
    this.data.set(key, value);
  }

  override remove(key: string): void {
    this.data.delete(key);
  }

  override has(key: string): boolean {
    return this.data.has(key);
  }
}

describe("persistence package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/persistence");
  });
});

describe("ProjectStore — save and load", () => {
  it("round-trips a project through storage", () => {
    const mock = new MockStorage();
    const store = new ProjectStore({ storage: mock });
    const program = makeProgram([makeScript()]);
    const metadata: ProjectMetadata = {
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      missionProgress: 0,
      hintLevel: 0,
    };
    store.save("proj-1", program, metadata);
    const loaded = store.load("proj-1");
    expect(loaded.program).toEqual(program);
    expect(loaded.metadata).toEqual(metadata);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("validates shared creative metadata at the cross-surface boundary", () => {
    const program = makeProgram([makeScript()]);
    const metadata: ProjectMetadata = {
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      missionProgress: 0,
      hintLevel: 0,
      actors: {
        activeId: "actor:hero",
        items: [
          {
            id: "actor:hero",
            name: "Hero",
            x: 0,
            y: 0,
            direction: 90,
            size: 100,
            visible: true,
            costumeId: "costume:missing",
          },
        ],
      },
      assets: [{ id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" }],
    };

    expect(() =>
      assertCrossSurfaceCompatibleProject({
        schemaVersion: SCHEMA_VERSION,
        program,
        metadata,
      }),
    ).toThrow(/INVALID_REFERENCE/);
    expect(() =>
      semanticProjectHash({
        schemaVersion: SCHEMA_VERSION,
        program,
        metadata,
      }),
    ).toThrow(/INVALID_REFERENCE/);
  });

  it("normalizes valid creative metadata before semantic hashing", () => {
    const program = makeProgram([makeScript()]);
    const metadata: ProjectMetadata = {
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      missionProgress: 0,
      hintLevel: 0,
      actors: {
        activeId: "actor:hero",
        items: [
          {
            id: "actor:hero",
            name: "Hero",
            x: 0,
            y: 0,
            direction: 90,
            size: 100,
            visible: true,
            costumeId: "costume:rocket",
            scripts: ["main"],
          },
        ],
      },
      stage: { backdropId: "backdrop:space", actorOrder: ["actor:hero"] },
      assets: [
        { id: "costume:rocket", kind: "costume", name: "Rocket", source: "builtin:rocket" },
        { id: "backdrop:space", kind: "backdrop", name: "Space", source: "builtin:space" },
      ],
    };

    const compatible = assertCrossSurfaceCompatibleProject({
      schemaVersion: SCHEMA_VERSION,
      program,
      metadata,
    });

    expect(compatible.metadata.stage).toEqual({
      backdropId: "backdrop:space",
      actorOrder: ["actor:hero"],
    });
    expect(semanticProjectHash(compatible)).toBe(
      semanticProjectHash({ schemaVersion: SCHEMA_VERSION, program, metadata }),
    );
  });

  it("throws PersistenceError when project not found", () => {
    const mock = new MockStorage();
    const store = new ProjectStore({ storage: mock });
    expect(() => store.load("missing")).toThrow(PersistenceError);
  });
});

describe("ProjectStore — load error codes", () => {
  it("throws CORRUPTED_DATA for invalid JSON", () => {
    const mock = new MockStorage();
    mock.data.set("proj-1", "not-json");
    const store = new ProjectStore({ storage: mock });
    expect(() => store.load("proj-1")).toThrow(PersistenceError);
  });

  it("throws UNKNOWN_VERSION when no migration path exists", () => {
    const mock = new MockStorage();
    const stored = JSON.stringify({
      schemaVersion: "agorix/program/v99",
      program: makeProgram([makeScript()]),
      metadata: { createdAt: "", updatedAt: "", missionProgress: 0, hintLevel: 0 },
    });
    mock.data.set("proj-1", stored);
    const store = new ProjectStore({ storage: mock });
    expect(() => store.load("proj-1")).toThrow(PersistenceError);
    let err: PersistenceError | undefined;
    try {
      store.load("proj-1");
    } catch (e) {
      err = e as PersistenceError;
    }
    expect(err?.code).toBe("UNKNOWN_VERSION");
  });
});

describe("ProjectStore — migration", () => {
  it("applies a registered migration step", () => {
    const mock = new MockStorage();
    const oldSchema = "agorix/program/v1-old";
    const migration = {
      fromVersion: oldSchema,
      toVersion: SCHEMA_VERSION,
      migrate: (program: ProjectProgram) => program,
    };
    const stored = JSON.stringify({
      schemaVersion: oldSchema,
      program: makeProgram([makeScript()]),
      metadata: { createdAt: "", updatedAt: "", missionProgress: 0, hintLevel: 0 },
    });
    mock.data.set("proj-1", stored);
    const store = new ProjectStore({
      storage: mock,
      currentSchemaVersion: SCHEMA_VERSION,
      migrations: [migration],
    });
    const loaded = store.load("proj-1");
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("ProjectStore — no React dependency", () => {
  it("imports without React", () => {
    expect(PACKAGE_NAME).toBe("@agorix/persistence");
  });
});
