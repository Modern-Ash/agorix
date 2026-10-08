import { agorixCodeProjection } from "@agorix/agorix-code";
import { msg } from "./messages.js";
import {
  projectProgram,
  typescriptProjection,
  type ProjectionResult,
  type TextRange,
} from "@agorix/code-generator";
import {
  getLocalizedFirstMission,
  normalizeLocale,
  worldCopy,
  worldsForMission,
} from "@agorix/curriculum";
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
  sanitizeAgorixFilename,
  semanticProjectHash,
  serializeAgorixProject,
  type ProjectActor,
  type ProjectMetadata,
  type StoredProject,
} from "@agorix/persistence";
import { pythonProjection } from "@agorix/python-projection";
import {
  acceptProposal as acceptSharedProposal,
  bindProposalRuntimeEvidence,
  createFirstStepProposal,
  createProposalComparisonView,
  createProposalReview as createSharedProposalReview,
  createRepeatPatternProposal,
  createStudioProposalDiffView,
  modifyProposal as modifySharedProposal,
  programSemanticHash,
  type StudioProposalDiffView,
  type ProposalComparisonView,
  rejectProposal as rejectSharedProposal,
  type ProposalAuditEvent,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import type { ActorView, AssetView, ExecutionEventTraceView } from "@agorix/studio-protocol";
import {
  createWorldState,
  runMultiActorProgram,
  runProgram,
  touchingGoal,
  type ExecutionTraceEntry,
  type MultiActorRunResult,
  type RuntimeObservation,
  type RuntimeEvent,
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
export type StudioStarterId = "blank" | "first-mission";

export interface StudioStarterOption {
  readonly id: StudioStarterId;
  readonly label: string;
  readonly description: string;
}

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
  /** Codicon id (without `$(...)`). */
  readonly icon: string;
  /** Short count/state shown beside the view title. Never a sentence. */
  readonly summary?: string;
  readonly items: readonly StudioNavigationItem[];
}

/** Visual state of a row. `ai` is the AI-provisional treatment, never success styling. */
export type StudioItemState = "ok" | "warn" | "error" | "info" | "running" | "idle" | "ai";

/**
 * Theme color ids per state. Only VS Code theme tokens are used, so light, dark and
 * high-contrast themes resolve them natively. `ai` uses a distinct purple, never the
 * success color, so provisional AI output is not mistaken for proven behavior.
 */
export const STUDIO_STATE_THEME_COLORS: Readonly<Record<StudioItemState, string | undefined>> = {
  ok: "testing.iconPassed",
  warn: "list.warningForeground",
  error: "list.errorForeground",
  info: "textLink.foreground",
  running: "charts.blue",
  idle: undefined,
  ai: "charts.purple",
};

export interface StudioNavigationItem {
  readonly id: string;
  /** Short noun or verb. Long text belongs in `tooltip` (progressive disclosure). */
  readonly label: string;
  /** Codicon id (without `$(...)`). */
  readonly icon?: string;
  readonly state?: StudioItemState;
  /** Count or state, a few words at most. */
  readonly description?: string;
  /** Detail revealed on hover. */
  readonly tooltip?: string;
  readonly command?: string;
  readonly contextValue?: string;
  /** Collapsed by default; revealed on expand. */
  readonly children?: readonly StudioNavigationItem[];
}

export interface InspectorRow {
  readonly step: number;
  readonly actorId?: string;
  readonly scriptId?: string;
  readonly nodeId: string;
  readonly statementType: ExecutionTraceEntry["statementType"];
  readonly activationId?: string;
  readonly event?: RuntimeEvent;
  readonly activationReason?: string;
  readonly assetIds?: readonly string[];
  readonly variableIds?: readonly string[];
  readonly worldBefore: ExecutionTraceEntry["worldBefore"];
  readonly worldAfter: ExecutionTraceEntry["worldAfter"];
}

export interface StudioExecutionEvidence {
  readonly result: RunResult;
  readonly previewFrames: readonly StudioObservationFrame[];
  readonly stepSequence: readonly ExecutionStep[];
  readonly learnerTrace: readonly LearnerTraceItem[];
  readonly inspectorRows: readonly InspectorRow[];
}

export type StudioObservationFrame = ObservationFrame & {
  readonly actorId?: string;
  readonly scriptId?: string;
  readonly statementType?: ExecutionTraceEntry["statementType"];
  readonly state: ObservationFrame["state"] & {
    readonly actors?: readonly ActorView[];
    readonly backdropId?: string;
  };
};

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
  readonly currentFrame?: StudioObservationFrame;
  readonly finalWorld: RunResult["world"];
  readonly outcome: StudioExecutionEvidence["result"]["outcome"];
  readonly stepsUsed: number;
  readonly previewFrames: readonly StudioObservationFrame[];
  readonly inspectorSteps: readonly StudioInspectorStep[];
  readonly eventTrace: readonly ExecutionEventTraceView[];
}

export type StudioCompanionAction = "explain" | "challenge" | "debug" | "reflect" | "build";

export interface StudioCompanionDiagnostics {
  readonly providerSelection: "bypassed" | "not-configured" | "provider";
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
  readonly affectedActorIds?: ProgramProposal["affectedActorIds"];
  readonly affectedScriptIds?: ProgramProposal["affectedScriptIds"];
  readonly affectedAssetIds?: ProgramProposal["affectedAssetIds"];
  readonly affectedVariableIds?: ProgramProposal["affectedVariableIds"];
  readonly affectedNodeIds: readonly string[];
  readonly expectedRuntimeEvidence?: ProgramProposal["expectedRuntimeEvidence"];
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

export const STUDIO_STARTER_OPTIONS: readonly StudioStarterOption[] = [
  {
    id: "blank",
    label: msg("Blank project"),
    description: msg("Start with an empty canonical program."),
  },
  {
    id: "first-mission",
    label: msg("First Mission"),
    description: msg("Open the shared Reach the Goal starter."),
  },
] as const;

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

export function defaultStudioProjectFilename(projectName: string): string {
  return sanitizeAgorixFilename(projectName);
}

export function createStudioStarterProject(options: {
  readonly starter: StudioStarterId;
  readonly locale?: string;
  readonly now?: string;
}): StoredProject {
  const locale = normalizeLocale(options.locale);
  const createdAt = options.now ?? new Date().toISOString();
  const program =
    options.starter === "first-mission"
      ? getLocalizedFirstMission(locale).starterProject
      : blankProgram();
  const validated = validateProgram(program);
  return {
    schemaVersion: SCHEMA_VERSION,
    program: validated,
    metadata: {
      createdAt,
      updatedAt: createdAt,
      missionProgress: countTopLevelStatements(validated),
      hintLevel: 0,
      locale,
      actors: [defaultProjectActor(locale)],
      stage: defaultProjectStage(),
      assets: defaultProjectAssets(),
    },
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

export function nodeIdsForProjectionLines(
  document: StudioProjectionDocument,
  startLine: number,
  endLine: number,
): readonly string[] {
  const start = Math.min(startLine, endLine);
  const end = Math.max(startLine, endLine);
  return Object.entries(document.mapping)
    .filter(([, range]) => {
      const rangeStart = offsetToLine(document.text, range.start);
      const rangeEnd = offsetToLine(document.text, Math.max(range.start, range.end - 1));
      return rangeStart <= end && rangeEnd >= start;
    })
    .map(([nodeId]) => nodeId);
}

/** The narrowest mapped node covering a zero-based line, or undefined when none does. */
export function nodeIdForProjectionLine(
  document: StudioProjectionDocument,
  line: number,
): string | undefined {
  let best: { id: string; size: number } | undefined;
  for (const [id, range] of Object.entries(document.mapping)) {
    const first = offsetToLine(document.text, range.start);
    const last = offsetToLine(document.text, Math.max(range.start, range.end - 1));
    const size = range.end - range.start;
    if (first <= line && last >= line && (best === undefined || size < best.size)) {
      best = { id, size };
    }
  }
  return best?.id;
}

export function countProgramStatements(program: ProjectProgram): number {
  return countTopLevelStatements(validateProgram(program));
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
  const developer: StudioNavigationSection = {
    id: "developer",
    label: msg("Developer"),
    icon: "tools",
    items:
      project === undefined
        ? [
            {
              id: "open-scm",
              label: msg("Source Control"),
              icon: "source-control",
              tooltip: msg("Open VS Code Source Control"),
              command: "agorixStudio.openScm",
            },
          ]
        : [
            {
              id: "validate-project",
              label: msg("Validate"),
              icon: "check-all",
              description: msg("runtime + mission"),
              tooltip: msg(
                "Validate the current Agorix project with the shared runtime and mission checks",
              ),
              command: "agorixStudio.validateProject",
              contextValue: "agorixDeveloperTask",
            },
            {
              id: "run-checks",
              label: msg("Checks"),
              icon: "checklist",
              description: msg("task"),
              tooltip: msg("Run Agorix workspace checks as a native VS Code task"),
              command: "agorixStudio.runChecks",
              contextValue: "agorixDeveloperTask",
            },
            {
              id: "open-scm",
              label: msg("Source Control"),
              icon: "source-control",
              tooltip: msg("Open VS Code Source Control (uses the Git extension)"),
              command: "agorixStudio.openScm",
              contextValue: "agorixDeveloperTask",
            },
            {
              id: "developer-context",
              label: msg("Task context"),
              icon: "symbol-key",
              description: currentProgramHash(project.stored.program),
              tooltip: msg("Show the developer task context for the canonical program"),
              command: "agorixStudio.showDeveloperContext",
              contextValue: "agorixDeveloperTask",
            },
          ],
  };
  if (project === undefined) {
    return [
      {
        id: "projects",
        label: msg("Projects"),
        icon: "folder",
        summary: "none open",
        items: [
          {
            id: "create",
            label: msg("Create New Project"),
            icon: "new-file",
            description: msg("local"),
            tooltip: msg("Create a local .agorix file"),
            command: "agorixStudio.createProject",
          },
          {
            id: "open",
            label: msg("Open local .agorix project"),
            icon: "folder-opened",
            command: "agorixStudio.openProject",
          },
          {
            id: "open-remote",
            label: msg("Open account project"),
            icon: "cloud-download",
            command: "agorixStudio.openRemoteProject",
          },
        ],
      },
      { id: "missions", label: msg("Missions"), icon: "target", items: [] },
      { id: "progress", label: msg("Progress"), icon: "graph", items: [] },
      { id: "worlds", label: msg("Worlds"), icon: "globe", items: [] },
      { id: "companion", label: msg("Learning Companion"), icon: "sparkle", items: [] },
      developer,
    ];
  }
  const mission = getLocalizedFirstMission(project.stored.metadata.locale);
  const statementCount = project.stored.program.scripts.reduce(
    (count, script) => count + script.statements.length,
    0,
  );
  const worlds = worldsForMission(mission.id, mission.version);
  const hints = project.stored.metadata.hintLevel;
  return [
    {
      id: "projects",
      label: msg("Projects"),
      icon: "folder",
      summary: "1 open",
      items: [
        {
          id: "new-project",
          label: msg("Create New Project"),
          icon: "new-file",
          tooltip: msg("Start another local .agorix file"),
          command: "agorixStudio.createProject",
          contextValue: "agorixProject",
        },
        {
          id: "open-local-project",
          label: "Open local .agorix project",
          icon: "folder-opened",
          tooltip: "Open another local .agorix project",
          command: "agorixStudio.openProject",
          contextValue: "agorixProject",
        },
        {
          id: "current-project",
          label: msg("Current local project"),
          icon: "file-code",
          state: "ok",
          description: `saved · ${statementCount} ${statementCount === 1 ? "block" : "blocks"}`,
          tooltip: "Saved locally.",
          contextValue: "agorixProject",
        },
      ],
    },
    {
      id: "missions",
      label: msg("Missions"),
      icon: "target",
      summary: "1",
      items: [
        {
          id: mission.id,
          label: mission.title,
          icon: "target",
          state: "info",
          tooltip: mission.goal.learnerFacing,
          contextValue: "agorixMission",
        },
      ],
    },
    {
      id: "progress",
      label: msg("Progress"),
      icon: "graph",
      summary: `${statementCount}`,
      items: [
        {
          id: "mission-progress",
          label: `${statementCount} ${statementCount === 1 ? "block" : "blocks"}`,
          icon: "symbol-event",
          state: statementCount > 0 ? "ok" : "idle",
          tooltip: msg("Blocks in the canonical project. Select to show execution evidence."),
          command: "agorixStudio.showEvidence",
          contextValue: "agorixProgress",
          children: [
            {
              id: "hints-used",
              label: msg("Hints"),
              icon: "lightbulb",
              state: hints > 0 ? "warn" : "idle",
              description: `${hints}`,
              tooltip: `Hint level used: ${hints}`,
            },
          ],
        },
      ],
    },
    {
      id: "worlds",
      label: msg("Worlds"),
      icon: "globe",
      summary: `${worlds.length}`,
      items: worlds.map((world) => {
        const copy = worldCopy(world, project.stored.metadata.locale);
        return {
          id: world.id,
          label: copy.title,
          icon: "globe",
          tooltip: copy.narrative,
          contextValue: "agorixWorld",
        };
      }),
    },
    {
      id: "companion",
      label: msg("Learning Companion"),
      icon: "sparkle",
      summary: "ready",
      items: [
        {
          id: "repeat-suggestion",
          label: msg("Suggest repeat"),
          icon: "repeat",
          state: "ai",
          description: msg("proposal"),
          tooltip: msg(
            "Suggest repeat when a pattern is proven. Deterministic ProgramProposal only.",
          ),
          command: "agorixStudio.suggestRepeat",
          contextValue: "agorixCompanion",
        },
        {
          id: "explain-selection",
          label: msg("Explain"),
          icon: "comment-discussion",
          state: "ai",
          description: msg("selection"),
          tooltip: msg("Explain the current selection using bounded code and evidence context."),
          command: "agorixStudio.companionExplain",
          contextValue: "agorixCompanion",
        },
        {
          id: "debug-evidence",
          label: msg("Debug"),
          icon: "bug",
          state: "ai",
          description: msg("runtime facts"),
          tooltip: msg("Debug with runtime facts only."),
          command: "agorixStudio.companionDebug",
          contextValue: "agorixCompanion",
        },
        {
          id: "reflect-run",
          label: msg("Reflect"),
          icon: "mirror",
          state: "ai",
          description: msg("last run"),
          tooltip: msg("Reflect on the run with an evidence-grounded prompt."),
          command: "agorixStudio.companionReflect",
          contextValue: "agorixCompanion",
        },
      ],
    },
    developer,
  ];
}

export function createExecutionEvidence(
  stored: StoredProject,
  options: { stopAfterSteps?: number } = {},
): StudioExecutionEvidence {
  if (options.stopAfterSteps !== undefined) {
    return createSingleActorExecutionEvidence(stored, options);
  }
  const program = validateProgram(stored.program);
  const mission = getLocalizedFirstMission(stored.metadata.locale);
  const creative = creativeStateForExecution(stored);
  const initialWorld = createWorldState(mission.starterStage);
  const result = runMultiActorProgram(program, creative, { goal: initialWorld.goal });
  const observations = observationsFromMultiActorRun(result);
  const stepSequence = executionStepsFromRuntimeObservations(observations);
  const previewFrames = framesFromMultiActorRun(result, observations);
  const primaryWorld = result.actors[0]?.world ?? initialWorld;
  const runResult: RunResult = {
    outcome: result.outcome,
    world: primaryWorld,
    stepsUsed: result.stepsUsed,
    trace: result.trace.map((entry) => ({
      step: entry.step,
      nodeId: entry.nodeId,
      path: entry.path,
      statementType: entry.statementType as ExecutionTraceEntry["statementType"],
      worldBefore: entry.worldBefore,
      worldAfter: entry.worldAfter,
    })),
    observations,
  };
  const activationsById = new Map(
    result.activations.map((activation) => [activation.id, activation]),
  );

  return {
    result: runResult,
    previewFrames,
    stepSequence,
    learnerTrace: learnerTraceFromExecutionSteps(stepSequence, "studio"),
    inspectorRows: result.trace.map((entry) => {
      const activationReason = activationsById.get(entry.activationId)?.reason;
      return {
        step: entry.step,
        nodeId: entry.nodeId,
        actorId: entry.actorId,
        scriptId: entry.scriptId,
        statementType: entry.statementType as ExecutionTraceEntry["statementType"],
        activationId: entry.activationId,
        event: entry.event,
        ...(activationReason === undefined ? {} : { activationReason }),
        ...assetTraceScope(entry.worldBefore, entry.worldAfter),
        ...variableTraceScope(entry.worldBefore, entry.worldAfter),
        worldBefore: entry.worldBefore,
        worldAfter: entry.worldAfter,
      };
    }),
  };
}

function createSingleActorExecutionEvidence(
  stored: StoredProject,
  options: { stopAfterSteps?: number } = {},
): StudioExecutionEvidence {
  const program = validateProgram(stored.program);
  const mission = getLocalizedFirstMission(stored.metadata.locale);
  const actor = actorsForProject(stored)[0];
  const result = runProgram(
    program,
    createWorldState({
      ...mission.starterStage,
      ...(actor === undefined
        ? {}
        : { sprite: { x: actor.x, y: actor.y, heading: actor.direction } }),
    }),
    {
      collectObservations: true,
      ...(options.stopAfterSteps === undefined ? {} : { stopAfterSteps: options.stopAfterSteps }),
    },
  );

  const stepSequence = executionStepsFromRuntimeObservations(result.observations);

  return {
    result,
    previewFrames: framesFromRuntimeObservations(result.observations),
    stepSequence,
    learnerTrace: learnerTraceFromExecutionSteps(stepSequence, "studio"),
    inspectorRows: result.trace.map((entry) => ({
      step: entry.step,
      nodeId: entry.nodeId,
      ...(actor === undefined ? {} : { actorId: actor.id }),
      ...scriptTraceScope(program, entry.nodeId),
      statementType: entry.statementType,
      ...assetTraceScope(entry.worldBefore, entry.worldAfter),
      ...variableTraceScope(entry.worldBefore, entry.worldAfter),
      worldBefore: entry.worldBefore,
      worldAfter: entry.worldAfter,
    })),
  };
}

function scriptTraceScope(program: ProjectProgram, nodeId: string): { readonly scriptId?: string } {
  const match = /^scripts\[(\d+)\]/.exec(nodeId);
  const script = match === null ? undefined : program.scripts[Number(match[1])];
  return script === undefined ? {} : { scriptId: script.id };
}

function assetTraceScope(
  before: ExecutionTraceEntry["worldBefore"],
  after: ExecutionTraceEntry["worldAfter"],
): { readonly assetIds?: readonly string[] } {
  const ids: string[] = [];
  if (before.sprite.costumeId !== after.sprite.costumeId && after.sprite.costumeId !== undefined) {
    ids.push(after.sprite.costumeId);
  }
  if (before.backdropId !== after.backdropId && after.backdropId !== undefined) {
    ids.push(after.backdropId);
  }
  const beforeSounds = new Set(before.sounds?.activeSoundIds ?? []);
  for (const soundId of after.sounds?.activeSoundIds ?? []) {
    if (!beforeSounds.has(soundId)) ids.push(soundId);
  }
  const uniqueIds = uniqueStrings(ids);
  return uniqueIds.length === 0 ? {} : { assetIds: uniqueIds };
}

function variableTraceScope(
  before: ExecutionTraceEntry["worldBefore"],
  after: ExecutionTraceEntry["worldAfter"],
): { readonly variableIds?: readonly string[] } {
  const ids = uniqueStrings([
    ...Object.keys(before.variables ?? {}),
    ...Object.keys(after.variables ?? {}),
  ]).filter((id) => {
    const beforeVariable = before.variables?.[id];
    const afterVariable = after.variables?.[id];
    return (
      beforeVariable?.value !== afterVariable?.value ||
      beforeVariable?.visible !== afterVariable?.visible
    );
  });
  return ids.length === 0 ? {} : { variableIds: ids };
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function creativeStateForExecution(stored: StoredProject): ProjectMetadata {
  const assets = stored.metadata.assets ?? defaultProjectAssets();
  return {
    ...stored.metadata,
    actors: stored.metadata.actors?.length
      ? stored.metadata.actors
      : [defaultProjectActor(stored.metadata.locale)],
    stage: stored.metadata.stage ?? defaultProjectStage(),
    assets,
  };
}

function observationsFromMultiActorRun(result: MultiActorRunResult): readonly RuntimeObservation[] {
  const observations = result.trace.flatMap((entry): RuntimeObservation[] => [
    {
      kind: "statement-start",
      step: entry.step,
      nodeId: entry.nodeId,
      statementType: entry.statementType as ExecutionTraceEntry["statementType"],
      world: entry.worldBefore,
    },
    {
      kind: "statement-end",
      step: entry.step,
      nodeId: entry.nodeId,
      statementType: entry.statementType as ExecutionTraceEntry["statementType"],
      world: entry.worldAfter,
    },
  ]);
  const finalWorld = result.actors[0]?.world ?? createWorldState();
  return [
    ...observations,
    {
      kind: "run-complete",
      step: result.stepsUsed,
      nodeId: "$",
      outcome: result.outcome,
      world: finalWorld,
    },
  ];
}

function actorViewsForFrame(
  actors: MultiActorRunResult["actors"],
  activeActorId: string | undefined,
  activeWorld: MultiActorRunResult["actors"][number]["world"] | undefined,
): readonly ActorView[] {
  return actors.map((actor) => {
    const world =
      activeActorId === actor.id && activeWorld !== undefined ? activeWorld : actor.world;
    return {
      id: actor.id,
      name: actor.name,
      x: world.sprite.x,
      y: world.sprite.y,
      direction: world.sprite.heading,
      size: world.sprite.size,
      visible: world.sprite.visible,
      ...(world.sprite.costumeId === undefined ? {} : { costumeId: world.sprite.costumeId }),
      ...(world.sprite.bubble === undefined ? {} : { bubble: world.sprite.bubble }),
    };
  });
}

function withActors(
  frame: ObservationFrame,
  actors: readonly ActorView[],
  row?: MultiActorRunResult["trace"][number],
): StudioObservationFrame {
  return {
    ...frame,
    ...(row?.actorId === undefined ? {} : { actorId: row.actorId }),
    ...(row?.scriptId === undefined ? {} : { scriptId: row.scriptId }),
    ...(row?.statementType === undefined
      ? {}
      : { statementType: row.statementType as ExecutionTraceEntry["statementType"] }),
    state: {
      ...frame.state,
      actors,
    },
  };
}

function framesFromMultiActorRun(
  result: MultiActorRunResult,
  observations: readonly RuntimeObservation[],
): readonly StudioObservationFrame[] {
  const baseFrames = framesFromRuntimeObservations(observations);
  const actorSnapshots = result.trace.flatMap((entry, index) => {
    const frameActors = result.frames[index]?.actors ?? result.actors;
    return [
      { actors: actorViewsForFrame(frameActors, entry.actorId, entry.worldBefore), row: entry },
      { actors: actorViewsForFrame(frameActors, entry.actorId, entry.worldAfter), row: entry },
    ];
  });
  const finalActors = actorViewsForFrame(result.actors, undefined, undefined);
  return baseFrames.map((frame, index) => {
    const snapshot = actorSnapshots[index];
    return withActors(frame, snapshot?.actors ?? finalActors, snapshot?.row);
  });
}

function eventText(event: RuntimeEvent): string {
  switch (event.type) {
    case "start":
      return "start";
    case "keyPressed":
      return `key:${event.key}`;
    case "actorClicked":
      return `click:${event.actorId}`;
    case "message":
      return event.senderActorId === undefined
        ? `message:${event.message}`
        : `message:${event.message} from ${event.senderActorId}`;
  }
}

function eventTraceFromRows(rows: readonly InspectorRow[]): readonly ExecutionEventTraceView[] {
  const seen = new Set<string>();
  const trace: ExecutionEventTraceView[] = [];
  for (const row of rows) {
    if (
      row.activationId === undefined ||
      row.event === undefined ||
      row.activationReason === undefined ||
      seen.has(row.activationId)
    ) {
      continue;
    }
    seen.add(row.activationId);
    trace.push({
      id: row.activationId,
      step: row.step,
      actorId: row.actorId ?? "actor:main",
      scriptId: row.scriptId ?? row.nodeId.split("/")[0] ?? row.nodeId,
      reason: row.activationReason,
      event: eventText(row.event),
    });
  }
  return trace;
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
    finalWorld: evidence.result.world,
    outcome: evidence.result.outcome,
    stepsUsed: evidence.result.stepsUsed,
    previewFrames: evidence.previewFrames,
    eventTrace: eventTraceFromRows(evidence.inspectorRows),
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

export interface StudioCompanionOptions {
  readonly selectedNodeIds?: readonly string[];
  readonly learnerIntent?: string;
  readonly evidence?: StudioExecutionEvidence;
}

/** The provider-neutral request for a companion action; also what a provider is asked. */
export function createCompanionRequest(
  project: StudioProject,
  action: StudioCompanionAction,
  options: StudioCompanionOptions = {},
): LearningCompanionRequest {
  const capability = companionCapability(action);
  const mission = getLocalizedFirstMission(project.stored.metadata.locale);
  const evidence = options.evidence ?? createExecutionEvidence(project.stored);
  const runtimeFacts = runtimeFactsFromEvidence(evidence);
  return createLearningCompanionRequest({
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
}

export function createCompanionTurn(
  project: StudioProject,
  action: StudioCompanionAction,
  options: StudioCompanionOptions & {
    /** A response already obtained from a provider; validated here before use. */
    readonly providerResponse?: LearningCompanionResponse;
  } = {},
): StudioCompanionTurn {
  const evidence = options.evidence ?? createExecutionEvidence(project.stored);
  const request = createCompanionRequest(project, action, { ...options, evidence });
  const runtimeFacts = runtimeFactsFromEvidence(evidence);
  const state = stateFromLearningCompanionRequest(request, {
    offline: true,
    explicitStrongerHelpRequested: action === "build",
  });
  const requirements = projectLearningRequirements(state);
  const deterministic =
    requirements.generativeNeeded === "no" || roleCanUseDeterministicFixture(request);
  const response = validateLearningCompanionSafety(
    request,
    options.providerResponse ?? createDeterministicLearningCompanionResponse(request),
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
      providerSelection:
        options.providerResponse !== undefined
          ? "provider"
          : deterministic
            ? "bypassed"
            : "not-configured",
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
    ...(proposal.affectedActorIds === undefined
      ? {}
      : { affectedActorIds: proposal.affectedActorIds }),
    ...(proposal.affectedScriptIds === undefined
      ? {}
      : { affectedScriptIds: proposal.affectedScriptIds }),
    ...(proposal.affectedAssetIds === undefined
      ? {}
      : { affectedAssetIds: proposal.affectedAssetIds }),
    ...(proposal.affectedVariableIds === undefined
      ? {}
      : { affectedVariableIds: proposal.affectedVariableIds }),
    affectedNodeIds: proposal.affectedNodeIds,
    ...(proposal.expectedRuntimeEvidence === undefined
      ? {}
      : { expectedRuntimeEvidence: proposal.expectedRuntimeEvidence }),
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

/** A learner-edited subset of a proposal, accepted as one `modify` decision. */
export function modifyProposalSession(
  acceptedProgram: ProjectProgram,
  session: StudioProposalSession,
  learnerReviewedProgram: ProjectProgram,
): StudioProposalDecision {
  return modifySharedProposal(acceptedProgram, session.review, learnerReviewedProgram);
}

export function createProposalEvidenceInspector(input: {
  readonly session: StudioProposalSession;
  readonly runtimeEvidence?: StudioExecutionEvidence;
  readonly learnerModifiedProgram?: ProjectProgram;
}): ProposalComparisonView {
  const runtimeEvidence =
    input.runtimeEvidence === undefined
      ? undefined
      : bindProposalRuntimeEvidence(
          input.session.review.proposal,
          input.runtimeEvidence.inspectorRows.map((row) => ({
            nodeId: row.nodeId,
            ...(row.actorId === undefined ? {} : { actorId: row.actorId }),
            ...(row.scriptId === undefined ? {} : { scriptId: row.scriptId }),
            ...(row.assetIds === undefined ? {} : { assetIds: row.assetIds }),
            ...(row.variableIds === undefined ? {} : { variableIds: row.variableIds }),
          })),
        );
  return createProposalComparisonView(input.session.review, {
    ...(input.learnerModifiedProgram === undefined
      ? {}
      : { learnerModifiedProgram: input.learnerModifiedProgram }),
    ...(runtimeEvidence === undefined ? {} : { runtimeEvidence }),
  });
}

export interface StudioProgramEvidence {
  readonly stepsUsed: number;
  readonly reachedGoal: boolean;
  readonly outcome: RunResult["outcome"];
}

/** Runs a candidate program in the deterministic runtime; the only source of proposal evidence. */
export function evidenceForProgram(
  project: StudioProject,
  program: ProjectProgram,
): StudioProgramEvidence {
  const mission = getLocalizedFirstMission(project.stored.metadata.locale);
  const result = runProgram(validateProgram(program), createWorldState(mission.starterStage));
  return {
    stepsUsed: result.stepsUsed,
    reachedGoal: touchingGoal(result.world),
    outcome: result.outcome,
  };
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

export function createStoredProjectWithMetadata(
  stored: StoredProject,
  metadata: ProjectMetadata,
): StoredProject {
  return {
    ...stored,
    metadata: {
      ...metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function defaultProjectActor(locale = "en"): ProjectActor {
  const mission = getLocalizedFirstMission(locale);
  const sprite = mission.starterStage.sprite ?? {};
  return {
    id: "actor:main",
    name: "Sprite",
    x: sprite.x ?? 0,
    y: sprite.y ?? 0,
    direction: sprite.heading ?? 0,
    size: 100,
    visible: true,
    costumeId: "asset:costume.default",
  };
}

export function actorsForProject(stored: StoredProject): readonly ProjectActor[] {
  return stored.metadata.actors?.length
    ? stored.metadata.actors
    : [defaultProjectActor(stored.metadata.locale)];
}

export function defaultProjectStage(): NonNullable<ProjectMetadata["stage"]> {
  return {
    backdropId: "asset:space.trailhead",
    width: 264,
    height: 192,
    actorOrder: ["actor:main"],
  };
}

export function defaultProjectAssets(): NonNullable<ProjectMetadata["assets"]> {
  return [
    {
      id: "asset:costume.default",
      kind: "costume",
      name: "Default Costume",
      source: "builtin:costume.default",
      tags: ["starter"],
    },
    {
      id: "asset:space.trailhead",
      kind: "backdrop",
      name: "Space Trailhead",
      source: "builtin:space.trailhead",
      tags: ["space", "mission"],
    },
    {
      id: "asset:sound.beacon",
      kind: "sound",
      name: "Beacon Ping",
      source: "builtin:sound.beacon",
      tags: ["starter", "feedback"],
    },
  ];
}

export function studioAssetCatalog(): readonly AssetView[] {
  return [
    {
      id: "asset:space.explorer",
      name: "Explorer",
      kind: "sprite",
      tags: ["starter", "space"],
      width: 64,
      height: 64,
      preview: "triangle",
    },
    {
      id: "asset:ocean.submarine",
      name: "Submarine",
      kind: "sprite",
      tags: ["starter", "ocean"],
      width: 64,
      height: 64,
      preview: "capsule",
    },
    {
      id: "asset:space.trailhead",
      name: "Space Trailhead",
      kind: "backdrop",
      tags: ["space", "mission"],
      width: 264,
      height: 192,
      preview: "grid",
    },
    {
      id: "asset:costume.default",
      name: "Default Costume",
      kind: "costume",
      tags: ["starter"],
      width: 64,
      height: 64,
      preview: "outline",
    },
    {
      id: "asset:sound.beacon",
      name: "Beacon Ping",
      kind: "sound",
      tags: ["starter", "feedback"],
      durationMs: 420,
      preview: "sine",
    },
  ];
}

function blankProgram(): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "greenFlag" },
        statements: [],
      },
    ],
  };
}

function countTopLevelStatements(program: ProjectProgram): number {
  return program.scripts.reduce((count, script) => count + script.statements.length, 0);
}

function offsetToLine(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split("\n").length - 1;
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

/** A real alternative to the default first step: a shorter move. Same safety, different trade-off. */
export function suggestFirstStepSmall(project: StudioProject): StudioSuggestion | undefined {
  const proposal = createFirstStepProposal({
    id: "first-step-small",
    baseProgram: project.stored.program,
    purpose: "Try a shorter movement step",
    rationale: "A shorter Move block is easier to follow one step at a time.",
    steps: 5,
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
  const rows = evidence.inspectorRows.map((row) => {
    const reason = row.activationReason === undefined ? "" : `  reason=${row.activationReason}`;
    return `Step ${row.step}  ${runtimeScopeText(row)}${row.nodeId}  ${row.statementType}: ${runtimeFactText(row)}${reason}`;
  });
  return [
    `Outcome: ${evidence.result.outcome} after ${evidence.result.stepsUsed} steps`,
    ...rows,
  ].join("\n");
}

function runtimeScopeText(row: InspectorRow): string {
  const scope = [row.actorId, row.scriptId].filter((value) => value !== undefined).join(" ");
  return scope.length === 0 ? "" : `${scope}  `;
}

function runtimeFactText(row: InspectorRow): string {
  const before = row.worldBefore;
  const after = row.worldAfter;
  const point = (world: InspectorRow["worldBefore"]) =>
    `(${world.sprite.x}, ${world.sprite.y}) heading ${world.sprite.heading}`;
  const samePoint = point(before) === point(after);
  switch (row.statementType) {
    case "move":
      return `moved from ${point(before)} to ${point(after)}`;
    case "turn":
      return `turned ${before.sprite.heading} -> ${after.sprite.heading}`;
    case "say":
      return `speech bubble "${after.sprite.bubble?.text ?? ""}"`;
    case "think":
      return `thought bubble "${after.sprite.bubble?.text ?? ""}"`;
    case "show":
      return `sprite shown ${before.sprite.visible} -> ${after.sprite.visible}`;
    case "hide":
      return `sprite hidden ${before.sprite.visible} -> ${after.sprite.visible}`;
    case "setSize":
      return `size ${before.sprite.size} -> ${after.sprite.size}`;
    case "switchCostume":
      return `costume ${before.sprite.costumeId ?? "default"} -> ${after.sprite.costumeId ?? "default"}`;
    case "switchBackdrop":
      return `backdrop ${before.backdropId ?? "default"} -> ${after.backdropId ?? "default"}`;
    case "playSound":
      return `sounds ${(after.sounds?.activeSoundIds ?? []).join(", ") || "none"}`;
    case "stopSounds":
      return "sounds stopped";
    case "setVariable":
    case "changeVariable":
      return variableValueFactText(row);
    case "showVariable":
      return variableVisibilityFactText(row, "shown");
    case "hideVariable":
      return variableVisibilityFactText(row, "hidden");
    case "broadcast":
      return "broadcast event queued";
    case "repeat":
      return samePoint ? "repeat completed without direct sprite movement" : "repeat completed";
    case "if":
      return samePoint
        ? "condition checked without direct sprite movement"
        : "condition branch ran";
    default:
      return `world changed from ${point(before)} to ${point(after)}`;
  }
}

function variableValueFactText(row: InspectorRow): string {
  const variableId = row.variableIds?.[0] ?? "variable";
  const before = row.worldBefore.variables?.[variableId]?.value ?? 0;
  const after = row.worldAfter.variables?.[variableId]?.value ?? 0;
  return `variable ${variableId} ${before} -> ${after}`;
}

function variableVisibilityFactText(row: InspectorRow, action: "shown" | "hidden"): string {
  const variableId = row.variableIds?.[0] ?? "variable";
  const before = row.worldBefore.variables?.[variableId]?.visible ?? false;
  const after = row.worldAfter.variables?.[variableId]?.visible ?? false;
  return `variable ${variableId} ${action} ${before} -> ${after}`;
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
    fact: `${runtimeScopeText(row)}${row.statementType} ${runtimeFactText(row)}${row.activationReason === undefined ? "" : ` because ${row.activationReason}`}`,
  }));
}
