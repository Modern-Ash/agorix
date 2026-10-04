import { MAX_AGENT_EVENTS, type AgentEvent, type AgentTaskId } from "@agorix/agent-workflow";
import { programToWorkspace } from "@agorix/block-editor";
import { programSemanticHash } from "@agorix/proposals";
import { touchingGoal, type WorldState } from "@agorix/runtime";
import {
  assertProposalFresh,
  suggestFirstStep,
  suggestRepeat,
  type StudioProject,
  type StudioProposalSession,
} from "../studioCore.js";
import type { AgentPort, ProposalView } from "./agentHost.js";

export interface AgentPortDeps {
  getProject(): StudioProject | undefined;
  getActiveProposal(): StudioProposalSession | undefined;
  setActiveProposal(session: StudioProposalSession | undefined): void;
  applyActiveProposal(): Promise<void>;
  rejectActiveProposal(): void;
  runAndGetResult(): { world: WorldState; stepsUsed: number } | undefined;
  events: AgentEvent[];
}

function viewOf(project: StudioProject, session: StudioProposalSession): ProposalView {
  const { mapping } = programToWorkspace(project.stored.program);
  const blockFor = new Map(mapping.map((entry) => [entry.nodeId, entry.blockId]));
  return {
    proposalId: session.review.proposal.id,
    purpose: session.purpose.slice(0, 300),
    rationale: session.rationale.slice(0, 300),
    changes: session.diff.changes.slice(0, 50).map((change) => {
      const blockId = blockFor.get(change.nodeId);
      return {
        kind: change.kind,
        ...(blockId === undefined ? {} : { blockId }),
        ...(change.afterText === undefined ? {} : { afterText: change.afterText.slice(0, 200) }),
      };
    }),
  };
}

/** Adapter over the session, proposals and runtime. Imports nothing from vscode. */
export function createAgentPort(deps: AgentPortDeps): AgentPort {
  return {
    availableTasks(): AgentTaskId[] {
      const project = deps.getProject();
      if (project === undefined) return [];
      const tasks: AgentTaskId[] = [];
      if (suggestFirstStep(project) !== undefined) tasks.push("first-step");
      if (suggestRepeat(project) !== undefined) tasks.push("repeat-pattern");
      return tasks;
    },
    proposeFor(task) {
      const project = deps.getProject();
      if (project === undefined) return undefined;
      const suggestion = task === "first-step" ? suggestFirstStep(project) : suggestRepeat(project);
      if (suggestion === undefined) return undefined;
      deps.setActiveProposal(suggestion.session);
      return viewOf(project, suggestion.session);
    },
    async applyPending() {
      const project = deps.getProject();
      const session = deps.getActiveProposal();
      if (project === undefined || session === undefined) return "stale";
      try {
        assertProposalFresh(project.stored.program, session);
      } catch {
        deps.setActiveProposal(undefined);
        return "stale";
      }
      await deps.applyActiveProposal();
      return "applied";
    },
    rejectPending() {
      if (deps.getActiveProposal() !== undefined) {
        deps.rejectActiveProposal();
      }
    },
    run() {
      const result = deps.runAndGetResult();
      return result === undefined
        ? undefined
        : { reachedGoal: touchingGoal(result.world), stepsUsed: result.stepsUsed };
    },
    programHash() {
      const project = deps.getProject();
      return project === undefined ? undefined : programSemanticHash(project.stored.program);
    },
    record(event) {
      deps.events.push(event);
      if (deps.events.length > MAX_AGENT_EVENTS) {
        deps.events.splice(0, deps.events.length - MAX_AGENT_EVENTS);
      }
    },
  };
}
