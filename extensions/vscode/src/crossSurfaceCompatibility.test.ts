import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  createOwnedProjectDescriptor,
  createOwnedProjectEnvelope,
} from "@agorix/platform-contract";
import {
  PersistenceError,
  ProjectStore,
  assertNoUiSpecificProgramState,
  assertSemanticallyEquivalentProjects,
  semanticProjectHash,
  semanticProjectSnapshot,
  type BrowserStorageAdapter,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import {
  createStoredProjectWithProgram,
  openStoredProject,
  parseStoredProject,
} from "./studioCore.js";

class MemoryStorage implements BrowserStorageAdapter {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

interface PresentationState {
  readonly selectedPanel?: "mission" | "code" | "preview";
  readonly editorSplitSize?: number;
  readonly theme?: "light" | "dark";
  readonly studioFileFocus?: string;
  readonly tabletOrientation?: "portrait" | "landscape";
  readonly selectedProjection?: "javascript" | "blocks";
  readonly locale?: string;
}

const baseMetadata: ProjectMetadata = {
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  missionProgress: 1,
  hintLevel: 0,
  locale: "en",
};

const webProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 160 }],
    },
  ],
};

const webCreatedProject: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  metadata: baseMetadata,
  program: webProgram,
};

function saveAndLoadFromWebStore(projectId: string, stored: StoredProject): StoredProject {
  const store = new ProjectStore({ storage: new MemoryStorage() });
  store.save(projectId, stored.program, stored.metadata);
  return store.load(projectId);
}

describe("cross-surface project compatibility", () => {
  it("opens a Web-created project in Studio without semantic drift", () => {
    const loadedFromWeb = saveAndLoadFromWebStore("web-created", webCreatedProject);
    const studioProject = openStoredProject(loadedFromWeb);

    expect(studioProject.projection.code).toContain("sprite.move(160);");
    expect(semanticProjectHash(studioProject.stored)).toBe(semanticProjectHash(webCreatedProject));
    expect(semanticProjectSnapshot(studioProject.stored).progress).toEqual({
      missionProgress: 1,
      hintLevel: 0,
    });
  });

  it("reopens a Studio-modified canonical project in Web", () => {
    const studioProgram: ProjectProgram = {
      ...webProgram,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "move", steps: 160 },
            { type: "turn", degrees: 90 },
          ],
        },
      ],
    };
    const studioSaved = createStoredProjectWithProgram(webCreatedProject, studioProgram);

    const reopenedInWeb = saveAndLoadFromWebStore("studio-modified", studioSaved);

    expect(reopenedInWeb.program).toEqual(studioProgram);
    expect(parseStoredProject(JSON.stringify(reopenedInWeb)).projection.code).toContain(
      "sprite.turn(90);",
    );
    expect(semanticProjectHash(reopenedInWeb)).toBe(semanticProjectHash(studioSaved));
  });

  it("preserves semantic equivalence through a Web to Studio to Web round trip", () => {
    const webLoaded = saveAndLoadFromWebStore("round-trip-in", webCreatedProject);
    const studioOpened = openStoredProject(webLoaded);
    const serializedByStudio = JSON.stringify(studioOpened.stored);
    const reopenedInWeb = saveAndLoadFromWebStore(
      "round-trip-out",
      JSON.parse(serializedByStudio) as StoredProject,
    );

    expect(() =>
      assertSemanticallyEquivalentProjects(webCreatedProject, reopenedInWeb),
    ).not.toThrow();
  });

  it("fails explicitly for unsupported newer schema versions", () => {
    const storage = new MemoryStorage();
    const store = new ProjectStore({ storage });
    storage.set(
      "future-project",
      JSON.stringify({
        ...webCreatedProject,
        schemaVersion: "agorix/program/v999",
      }),
    );

    expect(() => store.load("future-project")).toThrow(PersistenceError);
    expect(() => store.load("future-project")).toThrow(/UNKNOWN_VERSION/);
  });

  it("keeps presentation state outside the canonical semantic hash", () => {
    const presentationA: PresentationState = {
      selectedPanel: "code",
      editorSplitSize: 0.42,
      theme: "dark",
      studioFileFocus: "mission.agorix",
      tabletOrientation: "landscape",
      selectedProjection: "javascript",
      locale: "en",
    };
    const presentationB: PresentationState = {
      selectedPanel: "preview",
      editorSplitSize: 0.7,
      theme: "light",
      tabletOrientation: "portrait",
      selectedProjection: "blocks",
      locale: "es",
    };

    expect(presentationA).not.toEqual(presentationB);
    expect(semanticProjectHash(webCreatedProject)).toBe(
      semanticProjectHash({ ...webCreatedProject, metadata: { ...baseMetadata, locale: "es" } }),
    );
  });

  it("keeps Web and Studio ownership envelopes outside semantic equivalence", () => {
    const webEnvelope = createOwnedProjectEnvelope(
      webCreatedProject,
      createOwnedProjectDescriptor({
        projectId: "proj_web_01",
        ownerAccountId: "acct_web",
        title: "Web Maze",
        revision: "rev_web_01",
        createdAt: baseMetadata.createdAt,
        updatedAt: baseMetadata.updatedAt,
      }),
    );
    const studioEnvelope = createOwnedProjectEnvelope(
      openStoredProject(webEnvelope.project).stored,
      createOwnedProjectDescriptor({
        projectId: "proj_studio_01",
        ownerAccountId: "acct_studio",
        title: "Studio Maze",
        revision: "rev_studio_42",
        createdAt: baseMetadata.createdAt,
        updatedAt: "2026-09-27T00:01:00.000Z",
      }),
    );

    expect(webEnvelope.descriptor).not.toEqual(studioEnvelope.descriptor);
    expect(semanticProjectHash(webEnvelope.project)).toBe(
      semanticProjectHash(studioEnvelope.project),
    );
    expect(JSON.stringify(studioEnvelope.project.program)).not.toMatch(
      /accountId|ownerAccountId|projectId|revision|sessionId/,
    );
  });

  it("rejects UI-specific identifiers inside the canonical program", () => {
    const pollutedProgram = {
      ...webProgram,
      scripts: [
        {
          ...webProgram.scripts[0],
          selectedPanel: "code",
        },
      ],
    } as unknown as ProjectProgram;

    expect(() => assertNoUiSpecificProgramState(pollutedProgram)).toThrow(/selectedPanel/);
    expect(JSON.stringify(webProgram)).not.toMatch(/selectedPanel|editorSplitSize|vscodeUri/);
  });

  it("rejects identity and ownership identifiers inside the canonical program", () => {
    const pollutedProgram = {
      ...webProgram,
      scripts: [
        {
          ...webProgram.scripts[0],
          ownerAccountId: "acct_01",
        },
      ],
    } as unknown as ProjectProgram;

    expect(() => assertNoUiSpecificProgramState(pollutedProgram)).toThrow(/ownerAccountId/);
    expect(JSON.stringify(webProgram)).not.toMatch(/accountId|ownerAccountId|sessionId/);
  });
});
