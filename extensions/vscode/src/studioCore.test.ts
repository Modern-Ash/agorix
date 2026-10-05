import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { ProjectStore, type BrowserStorageAdapter, type StoredProject } from "@agorix/persistence";
import { createProgramProposal } from "@agorix/proposals";
import {
  applyProposal,
  applyProposalSession,
  createCompanionRequest,
  createCompanionTurn,
  createDeveloperContext,
  createExecutionEvidence,
  createExecutionViewState,
  createProposalReview,
  createStudioStarterProject,
  createStoredProjectWithProgram,
  createValidationReport,
  formatInspectorReport,
  defaultStudioProjectFilename,
  createNavigationSections,
  listStudioProjections,
  openStoredProject,
  evidenceForProgram,
  nodeIdForProjectionLine,
  suggestFirstStepSmall,
  openProjectionDocument,
  parseProjectFile,
  parseStoredProject,
  projectionRangeForNode,
  rangeForNode,
  rejectProposal,
  serializeProjectFile,
  serializeStoredProject,
  semanticHash,
  suggestFirstStep,
  suggestRepeat,
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

  it("round-trips portable .agorix files without identity, revision or history state", () => {
    const raw = serializeProjectFile(webCreatedProject, "first-mission.agorix", {
      exportedAt: "2026-01-02T00:00:00.000Z",
    });
    const envelope = JSON.parse(raw);
    const reopened = parseProjectFile(raw, "first-mission.agorix");

    expect(envelope.format).toBe("agorix-project");
    expect(reopened.stored.program).toEqual(webCreatedProject.program);
    expect(JSON.stringify(envelope)).not.toMatch(
      /account|token|password|revision|undoStack|redoStack|history/i,
    );
  });

  it("creates blank and First Mission starters as canonical stored projects", () => {
    const blank = createStudioStarterProject({
      starter: "blank",
      locale: "es-AR",
      now: "2026-10-03T12:00:00.000Z",
    });
    const firstMission = createStudioStarterProject({
      starter: "first-mission",
      locale: "en-US",
      now: "2026-10-03T12:00:00.000Z",
    });

    expect(blank.schemaVersion).toBe(SCHEMA_VERSION);
    expect(blank.metadata).toMatchObject({
      createdAt: "2026-10-03T12:00:00.000Z",
      updatedAt: "2026-10-03T12:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
      locale: "es",
    });
    expect(blank.program.scripts[0]?.statements).toEqual([]);
    expect(firstMission.metadata.locale).toBe("en");
    expect(openStoredProject(firstMission).projection.code).toContain("whenStarted");
    expect(createExecutionEvidence(firstMission).previewFrames.length).toBeGreaterThan(0);
  });

  it("sanitizes project names and round-trips Studio-created .agorix files", () => {
    const filename = defaultStudioProjectFilename("  My First Mission!!!.agorix ");
    const created = createStudioStarterProject({
      starter: "first-mission",
      locale: "en",
      now: "2026-10-03T12:00:00.000Z",
    });
    const raw = serializeProjectFile(created, filename, {
      exportedAt: "2026-10-03T12:00:00.000Z",
    });
    const reopened = parseProjectFile(raw, filename);

    expect(filename).toBe("my-first-mission.agorix");
    expect(reopened.stored).toEqual(created);
    expect(semanticHash(reopened.stored.program)).toBe(semanticHash(created.program));
  });

  it("maps an active canonical node to the editor projection range", () => {
    const project = openStoredProject(webCreatedProject);
    const range = rangeForNode(project, "scripts[0]/statements[0]");

    expect(project.projection.code.slice(range.start, range.end)).toBe("  sprite.move(160);\n");
  });

  it("opens TypeScript, Agorix Code and Python as read-only semantic projections", () => {
    const project = openStoredProject(webCreatedProject);
    const beforeHash = semanticHash(project.stored.program);
    const descriptors = listStudioProjections().map((projection) => projection.id);
    const projectionIds = ["typescript", "agorix-code", "python"] as const;

    expect(descriptors).toEqual(projectionIds);
    for (const id of projectionIds) {
      const document = openProjectionDocument(project, id);
      const range = projectionRangeForNode(document, "scripts[0]/statements[0]");
      expect(document.semanticHash).toBe(beforeHash);
      expect(document.readOnlyReason).toMatch(/Read-only/i);
      expect(document.text.slice(range.start, range.end)).toMatch(/160/);
    }

    expect(openProjectionDocument(project, "typescript").text).toContain("sprite.move(160);");
    expect(openProjectionDocument(project, "agorix-code").text).toContain("move 160");
    expect(openProjectionDocument(project, "python").text).toContain("move(160)");
    expect(project.stored.program).toEqual(webCreatedProject.program);
  });

  it("derives native Studio navigation from the canonical project without a duplicate model", () => {
    const sections = createNavigationSections(openStoredProject(webCreatedProject));

    expect(sections.map((section) => section.id)).toEqual([
      "projects",
      "missions",
      "progress",
      "worlds",
      "companion",
      "developer",
    ]);
    expect(sections.find((section) => section.id === "projects")?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Create New Project",
          command: "agorixStudio.createProject",
          contextValue: "agorixProject",
        }),
        expect.objectContaining({
          label: "Current local project",
          command: "agorixStudio.openProject",
          contextValue: "agorixProject",
        }),
      ]),
    );
    expect(sections.find((section) => section.id === "projects")?.items[1]).toMatchObject({
      label: "Current local project",
      command: "agorixStudio.openProject",
      contextValue: "agorixProject",
    });
    expect(sections.find((section) => section.id === "missions")?.items[0]?.id).toBe(
      "first-mission.reach-goal",
    );
    expect(
      sections.find((section) => section.id === "worlds")?.items.map((item) => item.id),
    ).toEqual(["space.trailhead", "ocean.reef", "robots.workshop", "city.crossing"]);
    expect(sections.find((section) => section.id === "progress")?.items[0]?.command).toBe(
      "agorixStudio.showEvidence",
    );
    expect(
      sections.find((section) => section.id === "developer")?.items.map((item) => item.command),
    ).toEqual([
      "agorixStudio.validateProject",
      "agorixStudio.runChecks",
      "agorixStudio.openScm",
      "agorixStudio.showDeveloperContext",
    ]);
  });

  it("creates validation and developer context from the canonical project authority", () => {
    const report = createValidationReport(webCreatedProject);
    const context = createDeveloperContext(webCreatedProject, { revision: "server-r3" });

    expect(report).toMatchObject({
      schema: "agorix/studio-validation-report/v1",
      outcome: "completed",
      statementCount: 1,
    });
    expect(context).toMatchObject({
      schema: "agorix/studio-developer-context/v1",
      validationCommand: "agorixStudio.validateProject",
      checkCommand: "agorixStudio.runChecks",
      scmCommand: "vscode.scm",
      authority: "canonical-project",
      project: { revision: "server-r3", statementCount: 1 },
    });
  });

  it("keeps Step evidence, Mundo Agorix frames and inspector rows in sync", () => {
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
    expect(evidence.stepSequence[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(evidence.stepSequence[0]?.timing).toBe("before-statement");
    expect(evidence.stepSequence[1]?.timing).toBe("after-statement");
    expect(evidence.stepSequence.map((step) => step.nodeId ?? "$")).toEqual(
      evidence.previewFrames.map((frame) => frame.highlightedNodeId ?? "$"),
    );
    expect(evidence.learnerTrace[1]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(evidence.learnerTrace[1]?.summary).toContain("before: x=52 y=128 heading=0");
    expect(evidence.inspectorRows[0]?.nodeId).toBe("scripts[0]/statements[0]");
    expect(evidence.inspectorRows[0]?.worldAfter.sprite.x).toBe(212);
  });

  it("creates one shared execution view state for preview frames and inspector rows", () => {
    const evidence = createExecutionEvidence({
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
    });

    const view = createExecutionViewState(evidence, 1, "running");

    expect(view.status).toBe("running");
    expect(view.currentFrame).toBe(view.previewFrames[1]);
    expect(view.inspectorSteps[1]).toMatchObject({
      frameIndex: 1,
      nodeId: "scripts[0]/statements[0]",
      provenance: "runtime fact",
    });
    expect(view.inspectorSteps.every((step) => step.provenance === "runtime fact")).toBe(true);
    expect(view.inspectorSteps[1]?.summary).toContain("before:");
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

  it("creates contextual Companion turns from selected code and runtime evidence without provider authority", () => {
    const project = openStoredProject(webCreatedProject);
    const evidence = createExecutionEvidence(webCreatedProject);
    const turn = createCompanionTurn(project, "debug", {
      selectedNodeIds: ["scripts[0]/statements[0]"],
      evidence,
    });

    expect(turn.request.capability).toBe("debugger");
    expect(turn.request.selectedNodeIds).toEqual(["scripts[0]/statements[0]"]);
    expect(turn.diagnostics.providerSelection).toBe("bypassed");
    expect(turn.diagnostics.runtimeFactCount).toBeGreaterThan(0);
    expect(turn.response.capability).toBe("debugger");
    if (turn.response.capability !== "debugger") throw new Error("expected debugger response");
    expect(turn.response.payload.facts[0]?.fact).toContain("moved from");
    expect(project.stored.program).toEqual(webCreatedProject.program);
  });

  it("uses a generic proposal session for first-step and fails stale proposals closed", () => {
    const emptyProject = openStoredProject({
      ...webCreatedProject,
      metadata: { ...webCreatedProject.metadata, missionProgress: 0 },
      program: {
        ...webCreatedProject.program,
        scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
      },
    });
    const suggestion = suggestFirstStep(emptyProject);

    expect(suggestion?.session.purpose).toContain("visible movement");
    expect(suggestion?.session.diff.proposedCode).toContain("sprite.move(10);");

    const accepted = applyProposalSession(emptyProject.stored.program, suggestion!.session);
    expect(accepted.program.scripts[0]?.statements).toEqual([{ type: "move", steps: 10 }]);

    const staleProgram: ProjectProgram = {
      ...emptyProject.stored.program,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "turn", degrees: 90 }],
        },
      ],
    };
    expect(() => applyProposalSession(staleProgram, suggestion!.session)).toThrow(/STALE_PROPOSAL/);
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

  it("suggests repeat for a repeated program and leaves the stored project unchanged", () => {
    const repeated: StoredProject = {
      ...webCreatedProject,
      program: {
        ...webCreatedProject.program,
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [1, 2, 3].flatMap(() => [
              { type: "move" as const, steps: 20 },
              { type: "turn" as const, degrees: 90 },
            ]),
          },
        ],
      },
    };
    const project = openStoredProject(repeated);
    const suggestion = suggestRepeat(project);

    expect(suggestion?.diff.proposedCode).toContain("repeat");
    expect(suggestion?.diff.acceptedCode).toBe(project.projection.code);
    expect(rejectProposal(repeated.program, suggestion!.review)).toEqual(repeated.program);

    const applied = applyProposal(repeated.program, suggestion!.review);
    const reopened = parseStoredProject(
      serializeStoredProject(createStoredProjectWithProgram(repeated, applied)),
    );
    expect(reopened.stored.program.scripts[0]?.statements).toEqual([
      {
        type: "repeat",
        count: 3,
        body: [
          { type: "move", steps: 20 },
          { type: "turn", degrees: 90 },
        ],
      },
    ]);
  });

  it("makes no suggestion when nothing repeats", () => {
    expect(suggestRepeat(openStoredProject(webCreatedProject))).toBeUndefined();
  });

  it("formats the execution inspector as learner-readable lines", () => {
    const report = formatInspectorReport(createExecutionEvidence(webCreatedProject));
    expect(report).toContain("Outcome:");
    expect(report).toContain("Step 1  scripts[0]/statements[0]  move");
  });
});

describe("nodeIdForProjectionLine", () => {
  it("picks the narrowest node covering a line", () => {
    const document = {
      text: "a\nb\nc\n",
      mapping: { outer: { start: 0, end: 6 }, inner: { start: 2, end: 3 } },
    } as never;
    expect(nodeIdForProjectionLine(document, 1)).toBe("inner");
    expect(nodeIdForProjectionLine(document, 0)).toBe("outer");
    expect(nodeIdForProjectionLine({ text: "a", mapping: {} } as never, 0)).toBeUndefined();
  });
});

describe("proposal evidence and alternatives", () => {
  it("offers a shorter first step whose evidence is measured by the runtime", () => {
    const empty = openStoredProject(
      createStudioStarterProject({ starter: "blank", locale: "en-US" }),
    );
    const small = suggestFirstStepSmall(empty);
    expect(small?.session.review.proposal.id).toBe("first-step-small");
    const evidence = evidenceForProgram(empty, small!.review.candidateProgram);
    expect(evidence.outcome).toBe("completed");
    expect(evidence.stepsUsed).toBeGreaterThan(0);
    expect(typeof evidence.reachedGoal).toBe("boolean");
    const none = evidenceForProgram(empty, empty.stored.program);
    expect(none.stepsUsed).toBe(0);
    expect(none.reachedGoal).toBe(false);
  });
});

describe("provider-backed companion turns", () => {
  it("uses a validated provider response and marks the turn as provider-backed", () => {
    const project = openStoredProject(
      createStudioStarterProject({ starter: "blank", locale: "en-US" }),
    );
    const request = createCompanionRequest(project, "build");
    expect(request.capability).toBe("builder");
    const deterministic = createCompanionTurn(project, "build");
    const turn = createCompanionTurn(project, "build", {
      providerResponse: deterministic.response,
    });
    expect(turn.diagnostics.providerSelection).toBe("provider");
    expect(turn.proposal?.review.proposal.id).toBe(deterministic.proposal?.review.proposal.id);
    expect(deterministic.diagnostics.providerSelection).not.toBe("provider");
  });

  it("rejects a provider response that fails the safety contract", () => {
    const project = openStoredProject(
      createStudioStarterProject({ starter: "blank", locale: "en-US" }),
    );
    const good = createCompanionTurn(project, "build").response;
    const bad = { ...good, capability: "coach" } as never;
    expect(() => createCompanionTurn(project, "build", { providerResponse: bad })).toThrow();
  });
});
