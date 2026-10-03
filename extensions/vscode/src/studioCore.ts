import { projectProgram, type ProjectionResult, type TextRange } from "@agorix/code-generator";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import type { StoredProject } from "@agorix/persistence";
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

export type { ProgramProposal, ProposalReview } from "@agorix/proposals";

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
