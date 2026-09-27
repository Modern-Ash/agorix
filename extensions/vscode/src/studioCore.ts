import { projectProgram, type ProjectionResult, type TextRange } from "@agorix/code-generator";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import type { StoredProject } from "@agorix/persistence";
import { validateProgram, type ProjectProgram } from "@agorix/program-model";
import {
  createWorldState,
  runProgram,
  type ExecutionTraceEntry,
  type RunResult,
} from "@agorix/runtime";
import { framesFromRuntimeObservations, type ObservationFrame } from "@agorix/stage";

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
  readonly inspectorRows: readonly InspectorRow[];
}

export interface ProgramProposal {
  readonly id: string;
  readonly summary: string;
  readonly proposedProgram: ProjectProgram;
  readonly affectedNodeIds: readonly string[];
}

export interface ProposalReview {
  readonly proposal: ProgramProposal;
  readonly acceptedProjection: ProjectionResult;
  readonly proposedProjection: ProjectionResult;
  readonly affectedRanges: readonly TextRange[];
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
  const accepted = validateProgram(acceptedProgram);
  const proposed = validateProgram(proposal.proposedProgram);
  const proposedProjection = projectProgram(proposed);

  return {
    proposal: { ...proposal, proposedProgram: proposed },
    acceptedProjection: projectProgram(accepted),
    proposedProjection,
    affectedRanges: proposal.affectedNodeIds.map((nodeId) => {
      const range = proposedProjection.mapping[nodeId];
      if (range === undefined) {
        throw new RangeError(`Proposal references unmapped canonical node ${nodeId}`);
      }
      return range;
    }),
  };
}

export function rejectProposal(
  acceptedProgram: ProjectProgram,
  _review: ProposalReview,
): ProjectProgram {
  return validateProgram(acceptedProgram);
}

export function applyProposal(
  _acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProjectProgram {
  return validateProgram(review.proposal.proposedProgram);
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
