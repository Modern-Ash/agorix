import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { ProjectStore, type BrowserStorageAdapter, type StoredProject } from "@agorix/persistence";
import { createProgramProposal } from "@agorix/proposals";
import {
  applyProposal,
  createExecutionEvidence,
  createProposalReview,
  createStoredProjectWithProgram,
  openStoredProject,
  parseStoredProject,
  rangeForNode,
  rejectProposal,
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

const webCreatedProject: StoredProject = {
  schemaVersion: SCHEMA_VERSION,
  metadata: {
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
    missionProgress: 1,
    hintLevel: 0,
    locale: "en",
  },
  program: {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "move", steps: 160 }],
      },
    ],
  },
};

describe("Agorix Studio first slice", () => {
  it("opens the same stored project semantics as Web", () => {
    const project = parseStoredProject(JSON.stringify(webCreatedProject));

    expect(project.stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(project.projection.code).toContain("sprite.move(160);");
    expect(project.stored.metadata.locale).toBe("en");
  });

  it("maps an active canonical node to the editor projection range", () => {
    const project = openStoredProject(webCreatedProject);
    const range = rangeForNode(project, "scripts[0]/statements[0]");

    expect(project.projection.code.slice(range.start, range.end)).toBe("  sprite.move(160);\n");
  });

  it("keeps Step evidence, World Preview frames and inspector rows in sync", () => {
    const steppedProject: StoredProject = {
      ...webCreatedProject,
      program: {
        ...webCreatedProject.program,
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
      },
    };

    const evidence = createExecutionEvidence(steppedProject, { stopAfterSteps: 1 });

    expect(evidence.result.outcome).toBe("stopped");
    expect(evidence.previewFrames[0]?.highlightedNodeId).toBe("scripts[0]/statements[0]");
    expect(evidence.inspectorRows[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(evidence.inspectorRows[0]?.worldAfter.sprite.x).toBe(212);
  });

  it("requires explicit proposal application and keeps reject non-mutating", () => {
    const proposedProgram: ProjectProgram = {
      ...webCreatedProject.program,
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
    const review = createProposalReview(
      webCreatedProject.program,
      createProgramProposal({
        id: "proposal-turn-after-goal",
        baseProgram: webCreatedProject.program,
        source: { kind: "studio", capability: "diff-review" },
        purpose: "Add a turn after reaching the beacon.",
        rationale: "This suggestion may help the learner inspect direction after movement.",
        affectedNodeIds: ["scripts[0]/statements[1]"],
        operations: [
          {
            type: "appendStatement",
            scriptIndex: 0,
            statement: { type: "turn", degrees: 90 },
          },
        ],
      }),
    );

    const rejected = rejectProposal(webCreatedProject.program, review);
    const applied = applyProposal(webCreatedProject.program, review);

    expect(rejected).toEqual(webCreatedProject.program);
    expect(applied).toEqual(proposedProgram);
    expect(review.acceptedProjection.code).not.toContain("sprite.turn(90);");
    expect(review.proposedProjection.code).toContain("sprite.turn(90);");
  });

  it("produces a Studio-modified fixture that #121 can reopen in Web", () => {
    const storage = new MemoryStorage();
    const store = new ProjectStore({ storage });
    const proposedProgram: ProjectProgram = {
      ...webCreatedProject.program,
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
    const studioModified = createStoredProjectWithProgram(webCreatedProject, proposedProgram);

    store.save("studio-modified-first-mission", studioModified.program, studioModified.metadata);
    const loaded = store.load("studio-modified-first-mission");

    expect(loaded.program).toEqual(proposedProgram);
    expect(openStoredProject(loaded).projection.code).toContain("sprite.turn(90);");
  });
});
