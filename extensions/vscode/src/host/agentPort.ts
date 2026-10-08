import {
  MAX_AGENT_EVENTS,
  taskForId,
  type AgentEvent,
  type AgentTask,
  type AgentTaskId,
} from "@agorix/agent-workflow";
import { programToWorkspace } from "@agorix/block-editor";
import { getLocalizedFirstMission, normalizeLocale } from "@agorix/curriculum";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  ProposalValidationError,
  operationEditable,
  programSemanticHash,
  resolveOperationTargets,
  selectProposalOperations,
  type ProposalOperation,
} from "@agorix/proposals";
import type { SelectionInput } from "@agorix/studio-protocol";
import { touchingGoal, type WorldState } from "@agorix/runtime";
import {
  createDeterministicIntentPlan,
  createIntentPlanRequest,
  type IntentPlanRequest,
  type IntentPlanResponse,
} from "@agorix/tutor-contract";
import {
  assertProposalFresh,
  createProposalSession,
  evidenceForProgram,
  modifyProposalSession,
  suggestFirstStep,
  suggestFirstStepSmall,
  suggestRepeat,
  type StudioProject,
  type StudioProposalSession,
} from "../studioCore.js";
import type { ProviderProposalResult, ProviderProposalTask } from "../studioProposalSource.js";
import type { AgentPort, ProposalView, SelectionPreview } from "./agentHost.js";

export interface AgentPortDeps {
  getProject(): StudioProject | undefined;
  getActiveProposal(): StudioProposalSession | undefined;
  setActiveProposal(session: StudioProposalSession | undefined): void;
  applyActiveProposal(): Promise<void>;
  /** One canonical transaction (one undo step) for a learner-edited subset of a proposal. */
  commitProgram(program: ProjectProgram): Promise<void>;
  rejectActiveProposal(): void;
  runAndGetResult(): { world: WorldState; stepsUsed: number } | undefined;
  events: AgentEvent[];
  /** Asks the decision pipeline and, when allowed, a provider; absent means built-in only. */
  providerProposal?(
    project: StudioProject,
    task: ProviderProposalTask,
  ): Promise<ProviderProposalResult>;
  /** Optional provider-backed planner; absent or unavailable means built-in only. */
  providerIntentPlan?(
    request: IntentPlanRequest,
  ): IntentPlanResponse | undefined | Promise<IntentPlanResponse | undefined>;
}

const TRADEOFFS: Record<string, string> = {
  "first-step": "Moves further in one step.",
  "first-step-small": "Moves a shorter distance, easier to follow one step at a time.",
  "repeat-pattern": "Shorter code that performs the same steps.",
  provider: "AI suggestion. Check it carefully before you accept.",
  "built-in": "Built-in suggestion, no AI involved.",
};

function availableTasksFor(project: StudioProject): AgentTaskId[] {
  const tasks: AgentTaskId[] = [];
  if (suggestFirstStep(project) !== undefined) tasks.push("first-step");
  if (suggestRepeat(project) !== undefined) tasks.push("repeat-pattern");
  return tasks;
}

function planTasksFromIntentResponse(
  response: IntentPlanResponse,
  available: readonly AgentTaskId[],
): AgentTask[] {
  if (response.kind !== "plan") return [];
  const chosen = new Set<AgentTaskId>();
  for (const step of response.plan.steps) {
    if (step.concept === "repetition" && available.includes("repeat-pattern")) {
      chosen.add("repeat-pattern");
    }
    if (
      (step.concept === "movement" || step.concept === "events" || step.concept === "sequence") &&
      available.includes("first-step")
    ) {
      chosen.add("first-step");
    }
  }
  return (chosen.size === 0 ? available : available.filter((id) => chosen.has(id))).map(taskForId);
}

function createRequestForIntent(project: StudioProject, intent: string): IntentPlanRequest {
  const locale = normalizeLocale(project.stored.metadata.locale);
  const mission = getLocalizedFirstMission(locale);
  return createIntentPlanRequest({
    learnerIntent: intent,
    mission: {
      id: mission.id,
      version: mission.version,
      concepts: mission.concepts,
      learningObjective: mission.goal.learnerFacing,
    },
    program: project.stored.program,
    selectedNodeIds: [],
    priorClarifications: [],
    reading: { locale },
  });
}

function resultFromIntentResponse(
  response: IntentPlanResponse,
  available: readonly AgentTaskId[],
  baseHash: string,
) {
  if (response.kind === "clarification") {
    return available.length < 2
      ? {
          kind: "plan" as const,
          tasks: available.map(taskForId),
          baseHash,
        }
      : {
          kind: "clarify" as const,
          options: available.map(taskForId),
          baseHash,
        };
  }
  return {
    kind: "plan" as const,
    tasks: planTasksFromIntentResponse(response, available),
    baseHash: response.plan.baseProgramHash,
  };
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return value !== undefined && typeof (value as { then?: unknown }).then === "function";
}

function describeStatement(statement: Statement): string {
  switch (statement.type) {
    case "move":
      return `move ${statement.steps} steps`;
    case "turn":
      return `turn ${statement.degrees} degrees`;
    case "repeat":
      return `repeat ${statement.count} times`;
    default:
      return statement.type;
  }
}

function describeOperation(operation: ProposalOperation): {
  kind: "add" | "replace" | "remove" | "setField";
  label: string;
} {
  switch (operation.type) {
    case "appendStatement":
      return { kind: "add", label: `Add ${describeStatement(operation.statement)}` };
    case "replaceStatement":
      return { kind: "replace", label: `Replace with ${describeStatement(operation.statement)}` };
    case "removeStatement":
      return { kind: "remove", label: "Remove a block" };
    case "replaceStatementField":
      return { kind: "setField", label: `Set ${operation.field} to ${operation.value}` };
  }
}

function viewOf(
  project: StudioProject,
  session: StudioProposalSession,
  alternatives: readonly { session: StudioProposalSession; tradeoff: string }[],
  extra: { origin?: "provider" | "built-in"; notice?: string } = {},
): ProposalView {
  const { mapping } = programToWorkspace(project.stored.program);
  const blockFor = new Map(mapping.map((entry) => [entry.nodeId, entry.blockId]));
  const proposal = session.review.proposal;
  const targets = resolveOperationTargets(project.stored.program, proposal);
  return {
    proposalId: proposal.id,
    purpose: session.purpose.slice(0, 300),
    rationale: session.rationale.slice(0, 300),
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
    changes: session.diff.changes.slice(0, 50).map((change) => {
      const blockId = blockFor.get(change.nodeId);
      return {
        kind: change.kind,
        ...(blockId === undefined ? {} : { blockId }),
        ...(change.afterText === undefined ? {} : { afterText: change.afterText.slice(0, 200) }),
      };
    }),
    operations: proposal.operations.slice(0, 50).map((operation, index) => {
      const target = targets[index];
      const blockId = target === undefined ? undefined : blockFor.get(target);
      const editable = operationEditable(operation);
      return {
        index,
        ...describeOperation(operation),
        ...(blockId === undefined ? {} : { blockId }),
        ...(editable === undefined ? {} : { editable }),
      };
    }),
    evidence: evidenceForProgram(project, session.review.candidateProgram),
    ...(extra.origin === undefined ? {} : { origin: extra.origin }),
    ...(extra.notice === undefined ? {} : { notice: extra.notice.slice(0, 300) }),
    ...(alternatives.length === 0
      ? {}
      : {
          alternatives: alternatives.map(({ session: alt, tradeoff }) => ({
            proposalId: alt.review.proposal.id,
            purpose: alt.purpose.slice(0, 300),
            tradeoff,
            evidence: evidenceForProgram(project, alt.review.candidateProgram),
          })),
        }),
  };
}

/** Adapter over the session, proposals and runtime. Imports nothing from vscode. */
export function createAgentPort(deps: AgentPortDeps): AgentPort {
  // Every proposal offered for the current task, so a learner can switch between them.
  let offered: {
    session: StudioProposalSession;
    tradeoff: string;
    origin: "provider" | "built-in";
  }[] = [];
  let offeredNotice: string | undefined;

  function viewFor(project: StudioProject, session: StudioProposalSession): ProposalView {
    const others = offered.filter((entry) => entry.session !== session);
    const current = offered.find((entry) => entry.session === session);
    return viewOf(project, session, others, {
      ...(current === undefined ? {} : { origin: current.origin }),
      ...(offeredNotice === undefined ? {} : { notice: offeredNotice }),
    });
  }

  function deriveSession(
    project: StudioProject,
    selection: SelectionInput,
  ):
    | { ok: true; session: StudioProposalSession }
    | { ok: false; reason: "EMPTY" | "INVALID" | "STALE" } {
    const active = deps.getActiveProposal();
    if (active === undefined) return { ok: false, reason: "STALE" };
    try {
      const derived = selectProposalOperations(active.review.proposal, selection);
      if (derived === undefined) return { ok: false, reason: "EMPTY" };
      return { ok: true, session: createProposalSession(project, derived) };
    } catch (error) {
      if (error instanceof ProposalValidationError && error.code === "STALE_PROPOSAL") {
        return { ok: false, reason: "STALE" };
      }
      return { ok: false, reason: "INVALID" };
    }
  }

  return {
    availableTasks(): AgentTaskId[] {
      const project = deps.getProject();
      if (project === undefined) return [];
      return availableTasksFor(project);
    },
    planIntent(intent) {
      const project = deps.getProject();
      if (project === undefined) return undefined;
      const available = availableTasksFor(project);
      const baseHash = programSemanticHash(project.stored.program);
      if (available.length === 0) {
        return { kind: "plan", tasks: [], baseHash };
      }
      const request = createRequestForIntent(project, intent);
      const deterministic = () =>
        resultFromIntentResponse(createDeterministicIntentPlan(request), available, baseHash);
      if (deps.providerIntentPlan === undefined) {
        return deterministic();
      }
      const maybeProvided = deps.providerIntentPlan(request);
      if (!isPromiseLike(maybeProvided)) {
        if (maybeProvided === undefined) {
          return deterministic();
        }
        if (maybeProvided.kind === "plan" && maybeProvided.plan.baseProgramHash !== baseHash) {
          return deterministic();
        }
        return resultFromIntentResponse(maybeProvided, available, baseHash);
      }
      return (async () => {
        const provided = await maybeProvided;
        const current = deps.getProject();
        if (provided === undefined || current === undefined) {
          return deterministic();
        }
        const currentHash = programSemanticHash(current.stored.program);
        if (currentHash !== baseHash) {
          return undefined;
        }
        if (provided.kind === "plan" && provided.plan.baseProgramHash !== currentHash) {
          return deterministic();
        }
        return resultFromIntentResponse(provided, available, currentHash);
      })();
    },
    async proposeFor(task) {
      const first = deps.getProject();
      if (first === undefined) return undefined;
      const asked =
        deps.providerProposal === undefined ? undefined : await deps.providerProposal(first, task);
      // The program may have changed while a provider was thinking: always build from now.
      const project = deps.getProject();
      if (project === undefined) return undefined;
      const suggestion = task === "first-step" ? suggestFirstStep(project) : suggestRepeat(project);
      if (suggestion === undefined) return undefined;
      const builtIn = suggestion.session;
      const small = task === "first-step" ? suggestFirstStepSmall(project) : undefined;
      const entries: typeof offered = [
        {
          session: builtIn,
          tradeoff: TRADEOFFS[builtIn.review.proposal.id] ?? TRADEOFFS["built-in"] ?? "",
          origin: "built-in",
        },
        ...(small === undefined
          ? []
          : [
              {
                session: small.session,
                tradeoff: TRADEOFFS["first-step-small"] ?? "",
                origin: "built-in" as const,
              },
            ]),
      ];
      const provided =
        asked?.origin === "provider" &&
        asked.session.baseProgramHash === programSemanticHash(project.stored.program) &&
        !entries.some(
          (entry) => entry.session.review.proposal.id === asked.session.review.proposal.id,
        )
          ? asked.session
          : undefined;
      offeredNotice = asked?.origin === "built-in" ? asked.notice : undefined;
      offered =
        provided === undefined
          ? entries
          : [
              { session: provided, tradeoff: TRADEOFFS["provider"] ?? "", origin: "provider" },
              ...entries.map((entry) =>
                entry.session === builtIn
                  ? { ...entry, tradeoff: TRADEOFFS["built-in"] ?? "" }
                  : entry,
              ),
            ];
      const primary = offered[0]!.session;
      deps.setActiveProposal(primary);
      return viewFor(project, primary);
    },
    chooseAlternative(proposalId) {
      const project = deps.getProject();
      const entry = offered.find((item) => item.session.review.proposal.id === proposalId);
      if (project === undefined || entry === undefined) return undefined;
      deps.setActiveProposal(entry.session);
      return viewFor(project, entry.session);
    },
    previewSelection(selection): SelectionPreview {
      const project = deps.getProject();
      if (project === undefined) return { ok: false, reason: "STALE" };
      const derived = deriveSession(project, selection);
      return derived.ok
        ? {
            ok: true,
            evidence: evidenceForProgram(project, derived.session.review.candidateProgram),
          }
        : derived;
    },
    async applySelection(selection) {
      const project = deps.getProject();
      if (project === undefined) return "stale";
      const derived = deriveSession(project, selection);
      if (!derived.ok) {
        if (derived.reason === "STALE") deps.setActiveProposal(undefined);
        return derived.reason === "EMPTY"
          ? "empty"
          : derived.reason === "STALE"
            ? "stale"
            : "invalid";
      }
      const decision = modifyProposalSession(
        project.stored.program,
        derived.session,
        derived.session.review.candidateProgram,
      );
      await deps.commitProgram(decision.program);
      deps.setActiveProposal(undefined);
      return "applied";
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
