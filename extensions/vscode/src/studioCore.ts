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
import type { StoredProject } from "@agorix/persistence";
import { pythonProjection } from "@agorix/python-projection";
import {
  acceptProposal as acceptSharedProposal,
  createProposalReview as createSharedProposalReview,
  createRepeatPatternProposal,
  createStudioProposalDiffView,
  type StudioProposalDiffView,
  rejectProposal as rejectSharedProposal,
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

export interface StudioProject {
  readonly stored: StoredProject;
  readonly projection: ProjectionResult;
}

export type StudioProjectionId = "typescript" | "agorix-code" | "python";

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
  readonly id: "projects" | "missions" | "progress" | "worlds" | "companion";
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

export function createProposalReview(
  acceptedProgram: ProjectProgram,
  proposal: ProgramProposal,
): ProposalReview {
  return createSharedProposalReview(acceptedProgram, proposal);
}

export function rejectProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProjectProgram {
  return rejectSharedProposal(acceptedProgram, review).program;
}

export function applyProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProjectProgram {
  return acceptSharedProposal(acceptedProgram, review).program;
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

export interface StudioSuggestion {
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
  const review = createProposalReview(project.stored.program, proposal);
  return { review, diff: createStudioProposalDiffView(review) };
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
