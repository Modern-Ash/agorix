import { agorixCodeProjection } from "@agorix/agorix-code";
import {
  projectProgram,
  typescriptProjection,
  type ProjectionResult,
  type TextRange,
} from "@agorix/code-generator";
import { getLocalizedFirstMission, worldCopy, worldsForMission } from "@agorix/curriculum";
import {
  firstRangeMapping,
  type LanguageProjection,
  type LanguageProjectionDescriptor,
} from "@agorix/language-projection";
import {
  projectLearningRequirements,
  roleCanUseDeterministicFixture,
  stateFromLearningCompanionRequest,
  type LearningRequirements,
} from "@agorix/learning-decision-plane";
import {
  parseAgorixProject,
  semanticProjectHash,
  serializeAgorixProject,
  type StoredProject,
} from "@agorix/persistence";
import { pythonProjection } from "@agorix/python-projection";
import {
  acceptProposal as acceptSharedProposal,
  createFirstStepProposal,
  createProposalReview as createSharedProposalReview,
  createRepeatPatternProposal,
  createStudioProposalDiffView,
  programSemanticHash,
  type StudioProposalDiffView,
  rejectProposal as rejectSharedProposal,
  type ProposalAuditEvent,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  createWorldState,
  runProgram,
  type ExecutionTraceEntry,
  type RunResult,
} from "@agorix/runtime";
import {
  executionStepsFromRuntimeObservations,
  framesFromRuntimeObservations,
  learnerTraceFromExecutionSteps,
  type ExecutionStep,
  type LearnerTraceItem,
  type ObservationFrame,
} from "@agorix/stage";
import {
  createDeterministicLearningCompanionResponse,
  createLearningCompanionRequest,
  validateLearningCompanionSafety,
  type LearningCompanionCapability,
  type LearningCompanionRequest,
  type LearningCompanionResponse,
  type LearningCompanionRuntimeFact,
  type LearningCompanionScaffoldLevel,
} from "@agorix/tutor-contract";

export interface StudioProject {
  readonly stored: StoredProject;
  readonly projection: ProjectionResult;
}

export type StudioProjectionId = "typescript" | "agorix-code" | "python";
export type StudioProjectPersistenceKind = "stored-json" | "portable-agorix";

export interface StudioProjectionDocument {
  readonly id: StudioProjectionId;
  readonly label: string;
  readonly languageId: string;
  readonly text: string;
  readonly mapping: Readonly<Record<string, TextRange>>;
  readonly diagnostics: readonly string[];
  readonly semanticHash: string;
  readonly readOnlyReason: string;
}

export interface StudioNavigationSection {
  readonly id: "projects" | "missions" | "progress" | "worlds" | "companion" | "developer";
  readonly label: string;
  readonly items: readonly StudioNavigationItem[];
}

export interface StudioNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly command?: string;
  readonly contextValue?: string;
}

export interface InspectorRow {
  readonly step: number;
  readonly nodeId: string;
  readonly statementType: ExecutionTraceEntry["statementType"];
  readonly worldBefore: ExecutionTraceEntry["worldBefore"];
  readonly worldAfter: ExecutionTraceEntry["worldAfter"];
}

export interface StudioExecutionEvidence {
  readonly result: RunResult;
  readonly previewFrames: readonly ObservationFrame[];
  readonly stepSequence: readonly ExecutionStep[];
  readonly learnerTrace: readonly LearnerTraceItem[];
  readonly inspectorRows: readonly InspectorRow[];
}

export type StudioExecutionStatus = "idle" | "running" | "stopped" | "completed";

export interface StudioInspectorStep {
  readonly index: number;
  readonly frameIndex: number;
  readonly runtimeStep: number;
  readonly nodeId?: string;
  readonly statementType?: ExecutionTraceEntry["statementType"];
  readonly timing: ExecutionStep["timing"];
  readonly before: LearnerTraceItem["before"];
  readonly after: LearnerTraceItem["after"];
  readonly summary: string;
  readonly outcome?: StudioExecutionEvidence["result"]["outcome"];
  readonly provenance: "runtime fact";
}

export interface StudioExecutionViewState {
  readonly status: StudioExecutionStatus;
  readonly selectedFrameIndex: number;
  readonly currentFrame?: ObservationFrame;
  readonly outcome: StudioExecutionEvidence["result"]["outcome"];
  readonly stepsUsed: number;
  readonly previewFrames: readonly ObservationFrame[];
  readonly inspectorSteps: readonly StudioInspectorStep[];
}

export type StudioCompanionAction = "explain" | "challenge" | "debug" | "reflect" | "build";

export interface StudioCompanionDiagnostics {
  readonly providerSelection: "bypassed" | "not-configured";
  readonly decisionSource: "system0" | "system1" | "fallback";
  readonly reasoningTier: LearningRequirements["reasoningTier"];
  readonly contextNeed: LearningRequirements["contextNeed"];
  readonly generativeNeeded: LearningRequirements["generativeNeeded"];
  readonly runtimeFactCount: number;
}

export interface StudioCompanionTurn {
  readonly action: StudioCompanionAction;
  readonly request: LearningCompanionRequest;
  readonly requirements: LearningRequirements;
  readonly response: LearningCompanionResponse;
  readonly message: string;
  readonly selectedNodeIds: readonly string[];
  readonly diagnostics: StudioCompanionDiagnostics;
  readonly proposal?: StudioProposalSession;
}

export interface StudioProposalSession {
  readonly review: ProposalReview;
  readonly diff: StudioProposalDiffView;
  readonly baseProgramHash: string;
  readonly purpose: string;
  readonly rationale: string;
  readonly source: ProgramProposal["source"];
  readonly affectedNodeIds: readonly string[];
}

export interface StudioProposalDecision {
  readonly program: ProjectProgram;
  readonly audit: ProposalAuditEvent;
}

export interface StudioProjectSnapshot {
  readonly schema: "agorix/studio-project-snapshot/v1";
  readonly semanticHash: string;
  readonly statementCount: number;
  readonly missionProgress: number;
  readonly locale: string;
  readonly revision?: string;
}

export interface StudioValidationReport {
  readonly schema: "agorix/studio-validation-report/v1";
  readonly semanticHash: string;
  readonly outcome: RunResult["outcome"];
  readonly stepsUsed: number;
  readonly statementCount: number;
  readonly diagnostics: readonly string[];
}

export interface StudioDeveloperContext {
  readonly schema: "agorix/studio-developer-context/v1";
  readonly project: StudioProjectSnapshot;
  readonly validationCommand: "agorixStudio.validateProject";
  readonly checkCommand: "agorixStudio.runChecks";
  readonly scmCommand: "vscode.scm";
  readonly evidenceCommand: "agorixStudio.showEvidence";
  readonly authority: "canonical-project";
}

export interface StudioRemoteProjectReference {
  readonly id: string;
  readonly title: string;
  readonly revision: string;
  readonly updatedAt?: string;
}

export interface StudioRemoteProjectPayload {
  readonly id: string;
  readonly title: string;
  readonly revision: string;
  readonly project: StoredProject;
}

export interface StudioRemoteSaveRequest {
  readonly id: string;
  readonly expectedRevision: string;
  readonly project: StoredProject;
}

export interface StudioRemoteSaveSuccess {
  readonly status: "saved";
  readonly revision: string;
  readonly project: StoredProject;
}

export interface StudioRemoteConflict {
  readonly status: "conflict";
  readonly expectedRevision: string;
  readonly actualRevision: string;
  readonly latest?: StoredProject;
}

export type StudioRemoteSaveResult = StudioRemoteSaveSuccess | StudioRemoteConflict;

export type { ProgramProposal, ProposalReview } from "@agorix/proposals";

const PROJECTIONS: Record<
  StudioProjectionId,
  {
    readonly projection: LanguageProjection;
    readonly languageId: string;
    readonly readOnlyReason: string;
  }
> = {
  typescript: {
    projection: typescriptProjection,
    languageId: "typescript",
    readOnlyReason:
      "Read-only projection. The canonical .agorix program remains the source of truth.",
  },
  "agorix-code": {
    projection: agorixCodeProjection,
    languageId: "agorix-code",
    readOnlyReason:
      "Read-only educational projection. Text parsing will use a future safe parser boundary.",
  },
  python: {
    projection: pythonProjection,
    languageId: "python",
    readOnlyReason:
      "Read-only Python projection. Generated code is inspectable evidence, not execution authority.",
  },
};

export function listStudioProjections(): readonly LanguageProjectionDescriptor[] {
  return Object.values(PROJECTIONS).map(({ projection }) => projection.descriptor);
}

export function openStoredProject(stored: StoredProject): StudioProject {
  const program = validateProgram(stored.program);
  return {
    stored: { ...stored, program },
    projection: projectProgram(program),
  };
}

export function parseStoredProject(raw: string): StudioProject {
  return openStoredProject(JSON.parse(raw) as StoredProject);
}

export function parseProjectFile(raw: string | Uint8Array, filename = ""): StudioProject {
  if (filename.toLowerCase().endsWith(".agorix")) {
    return openStoredProject(parseAgorixProject(raw).project);
  }
  return parseStoredProject(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
}

export function serializeProjectFile(
  stored: StoredProject,
  filename = "",
  options: { readonly exportedAt?: string } = {},
): string {
  if (filename.toLowerCase().endsWith(".agorix")) {
    return serializeAgorixProject(stored, options);
  }
  return serializeStoredProject(stored);
}

export function rangeForNode(project: StudioProject, nodeId: string): TextRange {
  const range = project.projection.mapping[nodeId];
  if (range === undefined) {
    throw new RangeError(`No projection range for canonical node ${nodeId}`);
  }
  return range;
}

export function openProjectionDocument(
  project: StudioProject,
  id: StudioProjectionId,
): StudioProjectionDocument {
  const config = PROJECTIONS[id];
  const result = config.projection.project(project.stored.program);
  return {
    id,
    label: result.projection.label,
    languageId: config.languageId,
    text: result.text,
    mapping: firstRangeMapping(result.mapping),
    diagnostics: result.diagnostics.map((diagnostic) => diagnostic.message),
    semanticHash: semanticHash(project.stored.program),
    readOnlyReason: config.readOnlyReason,
  };
}

export function projectionRangeForNode(
  document: StudioProjectionDocument,
  nodeId: string,
): TextRange {
  const range = document.mapping[nodeId];
  if (range === undefined) {
    throw new RangeError(`No ${document.id} projection range for canonical node ${nodeId}`);
  }
  return range;
}

export function semanticHash(program: ProjectProgram): string {
  return JSON.stringify(validateProgram(program));
}

export function isStudioProjectionId(value: string): value is StudioProjectionId {
  return Object.hasOwn(PROJECTIONS, value);
}

export function createNavigationSections(
  project: StudioProject | undefined,
): readonly StudioNavigationSection[] {
  if (project === undefined) {
    return [
      {
        id: "projects",
        label: "Projects",
        items: [
          { id: "open", label: "Open local .agorix project", command: "agorixStudio.openProject" },
        ],
      },
      { id: "missions", label: "Missions", items: [] },
      { id: "progress", label: "Progress", items: [] },
      { id: "worlds", label: "Worlds", items: [] },
      { id: "companion", label: "Learning Companion", items: [] },
      {
        id: "developer",
        label: "Developer",
        items: [
          {
            id: "open-scm",
            label: "Open VS Code Source Control",
            command: "agorixStudio.openScm",
          },
        ],
      },
    ];
  }
  const mission = getLocalizedFirstMission(project.stored.metadata.locale);
  const statementCount = project.stored.program.scripts.reduce(
    (count, script) => count + script.statements.length,
    0,
  );
  return [
    {
      id: "projects",
      label: "Projects",
      items: [
        {
          id: "current-project",
          label: "Current local project",
          description: `saved locally · ${statementCount} blocks`,
          command: "agorixStudio.openProject",
          contextValue: "agorixProject",
        },
      ],
    },
    {
      id: "missions",
      label: "Missions",
      items: [
        {
          id: mission.id,
          label: mission.title,
          description: mission.goal.learnerFacing,
          contextValue: "agorixMission",
        },
      ],
    },
    {
      id: "progress",
      label: "Progress",
      items: [
        {
          id: "mission-progress",
          label: `${project.stored.metadata.missionProgress} blocks in canonical project`,
          description: `hints used: ${project.stored.metadata.hintLevel}`,
          command: "agorixStudio.showEvidence",
          contextValue: "agorixProgress",
        },
      ],
    },
    {
      id: "worlds",
      label: "Worlds",
      items: worldsForMission(mission.id, mission.version).map((world) => {
        const copy = worldCopy(world, project.stored.metadata.locale);
        return {
          id: world.id,
          label: copy.title,
          description: copy.narrative,
          contextValue: "agorixWorld",
        };
      }),
    },
    {
      id: "companion",
      label: "Learning Companion",
      items: [
        {
          id: "repeat-suggestion",
          label: "Suggest repeat when a pattern is proven",
          description: "Deterministic ProgramProposal only",
          command: "agorixStudio.suggestRepeat",
          contextValue: "agorixCompanion",
        },
        {
          id: "explain-selection",
          label: "Explain current selection",
          description: "Bounded code and evidence context",
          command: "agorixStudio.companionExplain",
          contextValue: "agorixCompanion",
        },
        {
          id: "debug-evidence",
          label: "Debug with runtime facts",
          description: "Runtime facts only",
          command: "agorixStudio.companionDebug",
          contextValue: "agorixCompanion",
        },
        {
          id: "reflect-run",
          label: "Reflect on the run",
          description: "Evidence-grounded prompt",
          command: "agorixStudio.companionReflect",
          contextValue: "agorixCompanion",
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      items: [
        {
          id: "validate-project",
          label: "Validate current Agorix project",
          description: "Shared runtime and mission checks",
          command: "agorixStudio.validateProject",
          contextValue: "agorixDeveloperTask",
        },
        {
          id: "run-checks",
          label: "Run Agorix workspace checks",
          description: "Native VS Code task entry point",
          command: "agorixStudio.runChecks",
          contextValue: "agorixDeveloperTask",
        },
        {
          id: "open-scm",
          label: "Open VS Code Source Control",
          description: "Uses VS Code SCM and Git extensions",
          command: "agorixStudio.openScm",
          contextValue: "agorixDeveloperTask",
        },
        {
          id: "developer-context",
          label: "Show task context",
          description: currentProgramHash(project.stored.program),
          command: "agorixStudio.showDeveloperContext",
          contextValue: "agorixDeveloperTask",
        },
      ],
    },
  ];
}

export function createExecutionEvidence(
  stored: StoredProject,
  options: { stopAfterSteps?: number } = {},
): StudioExecutionEvidence {
  const program = validateProgram(stored.program);
  const mission = getLocalizedFirstMission(stored.metadata.locale);
  const result = runProgram(program, createWorldState(mission.starterStage), {
    collectObservations: true,
    ...(options.stopAfterSteps === undefined ? {} : { stopAfterSteps: options.stopAfterSteps }),
  });

  const stepSequence = executionStepsFromRuntimeObservations(result.observations);

  return {
    result,
    previewFrames: framesFromRuntimeObservations(result.observations),
    stepSequence,
    learnerTrace: learnerTraceFromExecutionSteps(stepSequence, "studio"),
    inspectorRows: result.trace.map((entry) => ({
      step: entry.step,
      nodeId: entry.nodeId,
      statementType: entry.statementType,
      worldBefore: entry.worldBefore,
      worldAfter: entry.worldAfter,
    })),
  };
}

export function createExecutionViewState(
  evidence: StudioExecutionEvidence,
  selectedFrameIndex: number,
  status: StudioExecutionStatus,
): StudioExecutionViewState {
  const clampedFrameIndex = Math.max(
    0,
    Math.min(selectedFrameIndex, Math.max(0, evidence.previewFrames.length - 1)),
  );
  return {
    status,
    selectedFrameIndex: clampedFrameIndex,
    ...(evidence.previewFrames[clampedFrameIndex] === undefined
      ? {}
      : { currentFrame: evidence.previewFrames[clampedFrameIndex] }),
    outcome: evidence.result.outcome,
    stepsUsed: evidence.result.stepsUsed,
    previewFrames: evidence.previewFrames,
    inspectorSteps: evidence.stepSequence.map((step, index) => {
      const trace = evidence.learnerTrace[index];
      const before = trace?.before ?? {
        x: step.frame.state.sprite.x,
        y: step.frame.state.sprite.y,
        heading: step.frame.state.sprite.heading,
      };
      const after = trace?.after ?? before;
      return {
        index,
        frameIndex: index,
        runtimeStep: step.runtimeStep,
        ...(step.nodeId === undefined ? {} : { nodeId: step.nodeId }),
        ...(step.statementType === undefined ? {} : { statementType: step.statementType }),
        timing: step.timing,
        before,
        after,
        summary: trace?.summary ?? "Runtime observation",
        ...(trace?.outcome === undefined ? {} : { outcome: trace.outcome }),
        provenance: "runtime fact",
      };
    }),
  };
}

export function createCompanionTurn(
  project: StudioProject,
  action: StudioCompanionAction,
  options: {
    readonly selectedNodeIds?: readonly string[];
    readonly learnerIntent?: string;
    readonly evidence?: StudioExecutionEvidence;
  } = {},
): StudioCompanionTurn {
  const capability = companionCapability(action);
  const mission = getLocalizedFirstMission(project.stored.metadata.locale);
  const evidence = options.evidence ?? createExecutionEvidence(project.stored);
  const runtimeFacts = runtimeFactsFromEvidence(evidence);
  const request = createLearningCompanionRequest({
    capability,
    mission: {
      id: mission.id,
      version: mission.version,
      concepts: mission.concepts,
      learningObjective: mission.goal.learnerFacing,
    },
    program: project.stored.program,
    selectedNodeIds: options.selectedNodeIds ?? selectedNodeIdsFromEvidence(evidence),
    runtime: {
      outcome: evidence.result.outcome,
      stepsUsed: evidence.result.stepsUsed,
      finalWorld: evidence.result.world,
      observations: evidence.result.observations,
    },
    runtimeFacts,
    scaffoldHistory: [
      {
        capability,
        level: Math.min(project.stored.metadata.hintLevel, 5) as LearningCompanionScaffoldLevel,
      },
    ],
    ...(options.learnerIntent === undefined || options.learnerIntent.trim().length === 0
      ? {}
      : { learnerIntent: options.learnerIntent }),
    reading: { locale: project.stored.metadata.locale ?? "en" },
  });
  const state = stateFromLearningCompanionRequest(request, {
    offline: true,
    explicitStrongerHelpRequested: action === "build",
  });
  const requirements = projectLearningRequirements(state);
  const deterministic =
    requirements.generativeNeeded === "no" || roleCanUseDeterministicFixture(request);
  const response = validateLearningCompanionSafety(
    request,
    createDeterministicLearningCompanionResponse(request),
  );
  const proposal =
    response.capability === "builder" && response.payload.validation.status === "valid"
      ? createProposalSession(project, response.payload.proposal)
      : undefined;
  return {
    action,
    request,
    requirements,
    response,
    message: response.message,
    selectedNodeIds: request.selectedNodeIds,
    diagnostics: {
      providerSelection: deterministic ? "bypassed" : "not-configured",
      decisionSource: requirements.provenance.generativeNeeded,
      reasoningTier: requirements.reasoningTier,
      contextNeed: requirements.contextNeed,
      generativeNeeded: requirements.generativeNeeded,
      runtimeFactCount: runtimeFacts.length,
    },
    ...(proposal === undefined ? {} : { proposal }),
  };
}

export function createProposalReview(
  acceptedProgram: ProjectProgram,
  proposal: ProgramProposal,
): ProposalReview {
  return createSharedProposalReview(acceptedProgram, proposal);
}

export function createProposalSession(
  project: StudioProject,
  proposal: ProgramProposal,
): StudioProposalSession {
  const review = createProposalReview(project.stored.program, proposal);
  return {
    review,
    diff: createStudioProposalDiffView(review),
    baseProgramHash: proposal.baseProgramHash,
    purpose: proposal.purpose,
    rationale: proposal.rationale,
    source: proposal.source,
    affectedNodeIds: proposal.affectedNodeIds,
  };
}

export function assertProposalFresh(program: ProjectProgram, session: StudioProposalSession): void {
  createProposalReview(program, session.review.proposal);
}

export function rejectProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProjectProgram {
  return rejectSharedProposal(acceptedProgram, review).program;
}

export function rejectProposalSession(
  acceptedProgram: ProjectProgram,
  session: StudioProposalSession,
): StudioProposalDecision {
  return rejectSharedProposal(acceptedProgram, session.review);
}

export function applyProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProjectProgram {
  return acceptSharedProposal(acceptedProgram, review).program;
}

export function applyProposalSession(
  acceptedProgram: ProjectProgram,
  session: StudioProposalSession,
): StudioProposalDecision {
  return acceptSharedProposal(acceptedProgram, session.review);
}

export function currentProgramHash(program: ProjectProgram): string {
  return programSemanticHash(program);
}

export function createStoredProjectWithProgram(
  stored: StoredProject,
  program: ProjectProgram,
): StoredProject {
  return {
    ...stored,
    program: validateProgram(program),
    metadata: {
      ...stored.metadata,
      missionProgress: program.scripts.reduce(
        (count, script) => count + script.statements.length,
        0,
      ),
    },
  };
}

export function createProjectSnapshot(
  stored: StoredProject,
  options: { readonly revision?: string } = {},
): StudioProjectSnapshot {
  const program = validateProgram(stored.program);
  return {
    schema: "agorix/studio-project-snapshot/v1",
    semanticHash: semanticProjectHash(stored),
    statementCount: program.scripts.reduce((count, script) => count + script.statements.length, 0),
    missionProgress: stored.metadata.missionProgress,
    locale: stored.metadata.locale ?? "en",
    ...(options.revision === undefined ? {} : { revision: options.revision }),
  };
}

export function createValidationReport(stored: StoredProject): StudioValidationReport {
  const project = openStoredProject(stored);
  const projectionDiagnostics = listStudioProjections().flatMap(
    (descriptor) =>
      openProjectionDocument(project, descriptor.id as StudioProjectionId).diagnostics,
  );
  const evidence = createExecutionEvidence(stored);
  return {
    schema: "agorix/studio-validation-report/v1",
    semanticHash: semanticProjectHash(stored),
    outcome: evidence.result.outcome,
    stepsUsed: evidence.result.stepsUsed,
    statementCount: project.stored.program.scripts.reduce(
      (count, script) => count + script.statements.length,
      0,
    ),
    diagnostics: projectionDiagnostics,
  };
}

export function createDeveloperContext(
  stored: StoredProject,
  options: { readonly revision?: string } = {},
): StudioDeveloperContext {
  return {
    schema: "agorix/studio-developer-context/v1",
    project: createProjectSnapshot(stored, options),
    validationCommand: "agorixStudio.validateProject",
    checkCommand: "agorixStudio.runChecks",
    scmCommand: "vscode.scm",
    evidenceCommand: "agorixStudio.showEvidence",
    authority: "canonical-project",
  };
}

export interface StudioSuggestion {
  readonly session: StudioProposalSession;
  readonly review: ProposalReview;
  readonly diff: StudioProposalDiffView;
}

/**
 * Same deterministic repeat suggestion as Web. Nothing changes until the
 * learner applies it; rejecting leaves the stored project untouched.
 */
export function suggestRepeat(project: StudioProject): StudioSuggestion | undefined {
  const proposal = createRepeatPatternProposal({
    id: "repeat-pattern",
    baseProgram: project.stored.program,
    purpose: "Write the repeated steps once with repeat",
    rationale:
      "The same steps appear several times in a row. A repeat does the same with less code.",
  });
  if (proposal === undefined) {
    return undefined;
  }
  const session = createProposalSession(project, proposal);
  return { session, review: session.review, diff: session.diff };
}

export function suggestFirstStep(project: StudioProject): StudioSuggestion | undefined {
  const proposal = createFirstStepProposal({
    id: "first-step",
    baseProgram: project.stored.program,
    purpose: "Try one visible movement step",
    rationale: "A single Move block is a safe first proposal to inspect before changing the file.",
  });
  if (proposal === undefined) {
    return undefined;
  }
  const session = createProposalSession(project, proposal);
  return { session, review: session.review, diff: session.diff };
}

export function formatInspectorReport(evidence: StudioExecutionEvidence): string {
  const point = (world: InspectorRow["worldBefore"]) =>
    `(${world.sprite.x}, ${world.sprite.y}) heading ${world.sprite.heading}`;
  const rows = evidence.inspectorRows.map(
    (row) =>
      `Step ${row.step}  ${row.nodeId}  ${row.statementType}: ${point(row.worldBefore)} -> ${point(row.worldAfter)}`,
  );
  return [
    `Outcome: ${evidence.result.outcome} after ${evidence.result.stepsUsed} steps`,
    ...rows,
  ].join("\n");
}

export function serializeStoredProject(stored: StoredProject): string {
  return `${JSON.stringify(stored, null, 2)}\n`;
}

function companionCapability(action: StudioCompanionAction): LearningCompanionCapability {
  switch (action) {
    case "explain":
      return "explainer";
    case "challenge":
      return "challenger";
    case "debug":
      return "debugger";
    case "reflect":
      return "reflector";
    case "build":
      return "builder";
  }
}

function selectedNodeIdsFromEvidence(evidence: StudioExecutionEvidence): readonly string[] {
  const node = evidence.stepSequence.find((step) => step.nodeId !== undefined)?.nodeId;
  return node === undefined ? [] : [node];
}

function runtimeFactsFromEvidence(
  evidence: StudioExecutionEvidence,
): readonly LearningCompanionRuntimeFact[] {
  return evidence.inspectorRows.map((row, index) => ({
    id: `runtime-step-${row.step}`,
    observationIndex: index,
    nodeId: row.nodeId,
    fact: `${row.statementType} moved from (${row.worldBefore.sprite.x}, ${row.worldBefore.sprite.y}) heading ${row.worldBefore.sprite.heading} to (${row.worldAfter.sprite.x}, ${row.worldAfter.sprite.y}) heading ${row.worldAfter.sprite.heading}`,
  }));
}
