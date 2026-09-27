import { projectProgram, type ProjectionResult, type TextRange } from "@agorix/code-generator";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import type { StoredProject } from "@agorix/persistence";
import {
  acceptProposal as acceptSharedProposal,
  createProposalReview as createSharedProposalReview,
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
  type ExecutionStep,
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

  return {
    result,
    previewFrames: framesFromRuntimeObservations(result.observations),
    stepSequence: executionStepsFromRuntimeObservations(result.observations),
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
