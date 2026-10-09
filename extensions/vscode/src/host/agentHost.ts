import {
  CONCEPT_IDS,
  DEFAULT_AGREEMENTS,
  advance,
  checkExplanation,
  comparePrediction,
  createWorkflow,
  effectiveAssistance,
  needsClarification,
  canShowHelp,
  highestHelpKind,
  planTasks,
  relevantConcept,
  taskForId,
  type AgentAgreements,
  type AgentEvent,
  type AgentTask,
  type AgentTaskId,
  type PredictionAnswer,
  type WorkflowEvent,
  type WorkflowState,
} from "@agorix/agent-workflow";
import {
  STUDIO_PROTOCOL_VERSION,
  type AlternativeView,
  type EvidenceView,
  type ExpectedRuntimeEvidenceView,
  type GhostChange,
  type HostMessage,
  type OperationView,
  type SelectionInput,
  type UiMessage,
} from "@agorix/studio-protocol";

export interface ProposalView {
  readonly proposalId: string;
  readonly purpose: string;
  readonly rationale: string;
  readonly affectedActorIds?: readonly string[];
  readonly affectedScriptIds?: readonly string[];
  readonly affectedAssetIds?: readonly string[];
  readonly affectedVariableIds?: readonly string[];
  readonly affectedNodeIds?: readonly string[];
  readonly expectedRuntimeEvidence?: readonly ExpectedRuntimeEvidenceView[];
  readonly changes: GhostChange[];
  readonly operations?: OperationView[];
  readonly evidence?: EvidenceView;
  readonly alternatives?: AlternativeView[];
  readonly origin?: "provider" | "built-in";
  readonly notice?: string;
}

export type SelectionPreview =
  | { readonly ok: true; readonly evidence: EvidenceView }
  | { readonly ok: false; readonly reason: "EMPTY" | "INVALID" | "STALE" };

export type AgentIntentPlanResult =
  | {
      readonly kind: "plan";
      readonly tasks: readonly AgentTask[];
      readonly baseHash?: string;
    }
  | {
      readonly kind: "clarify";
      readonly options: readonly AgentTask[];
      readonly baseHash?: string;
    };

export interface AgentPort {
  availableTasks(): AgentTaskId[];
  /** Block ids to point the learner to for a task, without making a proposal. */
  pointerFor(task: AgentTaskId): string[];
  /** Optional structured intent planner; callers fall back to keyword planning when absent. */
  planIntent?(
    intent: string,
  ): AgentIntentPlanResult | undefined | Promise<AgentIntentPlanResult | undefined>;
  /** Creates and remembers the pending proposal; undefined when the task no longer applies. */
  proposeFor(task: AgentTaskId): Promise<ProposalView | undefined>;
  /** Applies the pending proposal through the canonical path; "stale" when the program changed. */
  applyPending(): Promise<"applied" | "stale">;
  rejectPending(): void;
  /** Makes an offered alternative the pending proposal; undefined when it is unknown. */
  chooseAlternative(proposalId: string): ProposalView | undefined;
  previewSelection(selection: SelectionInput): SelectionPreview;
  /** Applies the chosen operations of the pending proposal as one transaction. */
  applySelection(selection: SelectionInput): Promise<"applied" | "stale" | "invalid" | "empty">;
  run(): { reachedGoal: boolean; stepsUsed: number } | undefined;
  programHash(): string | undefined;
  record(event: AgentEvent): void;
}

export interface AgentHost {
  /** undefined means "not an agent message"; the caller falls back to the workbench host. */
  handle(message: UiMessage): Promise<HostMessage[] | undefined>;
  snapshot(): HostMessage[];
  onProgramChanged(): HostMessage[];
}

const schema = STUDIO_PROTOCOL_VERSION;

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return value !== undefined && typeof (value as { then?: unknown }).then === "function";
}

export function createAgentHost(port: AgentPort): AgentHost {
  let agreements: AgentAgreements = DEFAULT_AGREEMENTS;
  let workflow: WorkflowState = createWorkflow(agreements.mode);
  let tasks: AgentTask[] = [];
  let pending: ProposalView | undefined;
  let answer: PredictionAnswer | undefined;
  let predictedProposalId: string | undefined;
  let applying = false;
  let requesting = false;
  // Bumped whenever the loop resets, so an answer that arrives late is discarded.
  let epoch = 0;
  let clarifying: AgentTask[] | undefined;
  let planBaseHash: string | undefined;
  let lastHash: string | undefined = port.programHash();

  const wf = (): HostMessage => ({ schema, type: "workflow", state: workflow });
  const agreementsMsg = (): HostMessage => ({ schema, type: "agreements", agreements });
  const cleared = (): HostMessage => ({ schema, type: "proposalCleared" });
  const helpMsg = (taskId: AgentTaskId): HostMessage => {
    const shown = highestHelpKind(agreements);
    const kind = shown === undefined || shown === "proposal" ? "none" : shown;
    const blockIds = kind === "pointer" ? port.pointerFor(taskId) : [];
    return {
      schema,
      type: "help",
      kind,
      ceiling: agreements.assistanceCeiling,
      taskId,
      ...(kind === "concept" ? { concept: relevantConcept(taskId) } : {}),
      ...(blockIds.length > 0 ? { blockIds } : {}),
    };
  };
  const planMsg = (): HostMessage => ({ schema, type: "plan", tasks });
  const clarifyMsg = (options: readonly AgentTask[]): HostMessage => ({
    schema,
    type: "clarify",
    options,
  });
  const proposalMsg = (view: ProposalView): HostMessage => ({
    schema,
    type: "proposal",
    proposalId: view.proposalId,
    purpose: view.purpose,
    rationale: view.rationale,
    ...(view.affectedActorIds === undefined ? {} : { affectedActorIds: view.affectedActorIds }),
    ...(view.affectedScriptIds === undefined ? {} : { affectedScriptIds: view.affectedScriptIds }),
    ...(view.affectedAssetIds === undefined ? {} : { affectedAssetIds: view.affectedAssetIds }),
    ...(view.affectedVariableIds === undefined
      ? {}
      : { affectedVariableIds: view.affectedVariableIds }),
    ...(view.affectedNodeIds === undefined ? {} : { affectedNodeIds: view.affectedNodeIds }),
    ...(view.expectedRuntimeEvidence === undefined
      ? {}
      : { expectedRuntimeEvidence: view.expectedRuntimeEvidence }),
    changes: view.changes,
    ...(view.operations === undefined ? {} : { operations: view.operations }),
    ...(view.evidence === undefined ? {} : { evidence: view.evidence }),
    ...(view.alternatives === undefined ? {} : { alternatives: view.alternatives }),
    ...(view.origin === undefined ? {} : { origin: view.origin }),
    ...(view.notice === undefined ? {} : { notice: view.notice }),
  });
  const predictionMsg = (): HostMessage => ({
    schema,
    type: "prediction",
    questionId: "reaches-goal",
    options: ["yes", "no"],
  });
  // `workflow` is reassigned by step(); this defeats control-flow narrowing after guards.
  const stageNow = () => workflow.stage;
  const level = () => effectiveAssistance(agreements, 4);
  const currentTask = (): AgentTask | undefined => tasks[workflow.taskIndex];

  function step(event: WorkflowEvent): boolean {
    const result = advance(workflow, event);
    if (!result.ok) {
      return false;
    }
    workflow = result.state;
    return true;
  }

  function resetLoop(): boolean {
    epoch += 1;
    const hadPending = pending !== undefined;
    if (hadPending) {
      port.rejectPending();
    }
    pending = undefined;
    workflow = createWorkflow(agreements.mode);
    tasks = [];
    clarifying = undefined;
    planBaseHash = undefined;
    answer = undefined;
    predictedProposalId = undefined;
    return hadPending;
  }

  function record(type: AgentEvent["type"], origin?: "provider" | "built-in"): void {
    const task = currentTask();
    if (task !== undefined) {
      port.record({
        type,
        taskId: task.id,
        scaffoldLevel: level(),
        ...(origin === undefined ? {} : { origin }),
      });
    }
  }

  async function requestProposal(): Promise<HostMessage[]> {
    const task = currentTask();
    if (
      workflow.stage !== "proposal" ||
      pending !== undefined ||
      task === undefined ||
      requesting
    ) {
      return [];
    }
    if (!canShowHelp(agreements, "proposal")) {
      // Below level 4 the agent may not propose (ADR 0008): it gives the most help the ceiling allows.
      return [helpMsg(task.id)];
    }
    step({ type: "proposalRequested" });
    const started = epoch;
    requesting = true;
    let view: ProposalView | undefined;
    try {
      view = await port.proposeFor(task.id);
    } finally {
      requesting = false;
    }
    if (epoch !== started) {
      // The learner changed the program or the agreements while the suggestion was on its way.
      if (view !== undefined) port.rejectPending();
      return [];
    }
    if (view === undefined) {
      workflow = { ...workflow, proposalRequested: false };
      return [cleared(), wf()];
    }
    pending = view;
    record("proposalRequested", view.origin);
    return agreements.requirePredictionBeforeAccept
      ? [wf(), proposalMsg(view), predictionMsg()]
      : [wf(), proposalMsg(view)];
  }

  async function decide(
    proposalId: string,
    decision: "accepted" | "rejected" | "modified",
    selection?: SelectionInput,
  ): Promise<HostMessage[]> {
    if (
      workflow.stage !== "proposal" ||
      !workflow.proposalRequested ||
      pending === undefined ||
      applying ||
      proposalId !== pending.proposalId
    ) {
      return [];
    }
    if (decision === "modified" && selection === undefined) {
      return [];
    }
    if (decision === "modified" && agreements.requirePredictionBeforeAccept) {
      return [{ schema, type: "error", code: "PREDICTION_REQUIRED" }];
    }
    if (decision === "modified" && selection !== undefined && selection.include.length === 0) {
      decision = "rejected";
    }
    if (
      decision !== "rejected" &&
      agreements.requirePredictionBeforeAccept &&
      (!workflow.predicted || predictedProposalId !== pending.proposalId)
    ) {
      return [{ schema, type: "error", code: "PREDICTION_REQUIRED" }];
    }
    if (decision === "rejected") {
      port.rejectPending();
      const rejectedOrigin = pending.origin;
      pending = undefined;
      answer = undefined;
      predictedProposalId = undefined;
      record("proposalRejected", rejectedOrigin);
      step({ type: "proposalDecided", decision: "rejected" });
      return [cleared(), wf()];
    }
    applying = true;
    let outcome: "applied" | "stale" | "invalid" | "empty";
    try {
      outcome =
        selection === undefined ? await port.applyPending() : await port.applySelection(selection);
    } finally {
      applying = false;
    }
    if (outcome === "invalid" || outcome === "empty") {
      return [
        {
          schema,
          type: "selectionEvidence",
          proposalId,
          result: { ok: false, reason: outcome === "empty" ? "EMPTY" : "INVALID" },
        },
      ];
    }
    const decidedOrigin = pending.origin;
    pending = undefined;
    if (outcome === "stale") {
      answer = undefined;
      predictedProposalId = undefined;
      step({ type: "proposalDecided", decision: "rejected" });
      return [{ schema, type: "error", code: "STALE_PROPOSAL" }, cleared(), wf()];
    }
    record(selection === undefined ? "proposalAccepted" : "proposalModified", decidedOrigin);
    step({ type: "proposalDecided", decision: "accepted" });
    lastHash = port.programHash();
    return stageNow() === "predict" ? [cleared(), wf(), predictionMsg()] : [cleared(), wf()];
  }

  function stalePlan(): HostMessage[] {
    resetLoop();
    return [{ schema, type: "error", code: "STALE_PLAN" }, wf()];
  }

  async function handle(message: UiMessage): Promise<HostMessage[] | undefined> {
    switch (message.type) {
      case "ready":
      case "intent":
        return undefined;
      case "agreementsChanged": {
        agreements = message.agreements;
        const had = resetLoop();
        return [agreementsMsg(), ...(had ? [cleared()] : []), wf()];
      }
      default:
        break;
    }
    if (!agreements.aiEnabled) {
      return [{ schema, type: "agentUnavailable" }];
    }
    switch (message.type) {
      case "stateIntent": {
        const had = resetLoop();
        step({ type: "intentStated" });
        planBaseHash = port.programHash();
        const maybePlanned = port.planIntent?.(message.text);
        const planned = isPromiseLike(maybePlanned) ? await maybePlanned : maybePlanned;
        if (planned !== undefined) {
          planBaseHash = planned.baseHash ?? planBaseHash;
          if (planned.kind === "clarify") {
            clarifying = [...planned.options];
            return [...(had ? [cleared()] : []), wf(), clarifyMsg(clarifying)];
          }
          tasks = [...planned.tasks];
          return [...(had ? [cleared()] : []), wf(), planMsg()];
        }
        const available = port.availableTasks();
        if (needsClarification(message.text, available)) {
          clarifying = available.map(taskForId);
          return [...(had ? [cleared()] : []), wf(), clarifyMsg(clarifying)];
        }
        tasks = planTasks(message.text, available);
        return [...(had ? [cleared()] : []), wf(), planMsg()];
      }
      case "answerClarification": {
        if (clarifying === undefined || workflow.stage !== "plan") return [];
        if (planBaseHash !== port.programHash()) return stalePlan();
        const chosen = clarifying.find((task) => task.id === message.taskId);
        if (chosen === undefined) return [];
        clarifying = undefined;
        tasks = [chosen];
        return [wf(), planMsg()];
      }
      case "acceptPlan": {
        if (workflow.stage === "plan" && tasks.length > 0 && planBaseHash !== port.programHash()) {
          return stalePlan();
        }
        if (tasks.length === 0 || !step({ type: "planAccepted", taskCount: tasks.length })) {
          return [];
        }
        return agreements.mode === "bounded" ? [wf(), ...(await requestProposal())] : [wf()];
      }
      case "requestProposal":
        return requestProposal();
      case "decideProposal":
        return decide(message.proposalId, message.decision, message.selection);
      case "chooseAlternative": {
        if (workflow.stage !== "proposal" || pending === undefined || applying) return [];
        const view = port.chooseAlternative(message.proposalId);
        if (view === undefined) return [];
        pending = view;
        answer = undefined;
        predictedProposalId = undefined;
        if (workflow.predicted) {
          workflow = { ...workflow, predicted: false };
        }
        record("alternativeChosen", view.origin);
        return agreements.requirePredictionBeforeAccept
          ? [wf(), proposalMsg(view)]
          : [proposalMsg(view)];
      }
      case "previewSelection": {
        if (pending === undefined || message.proposalId !== pending.proposalId) return [];
        if (agreements.requirePredictionBeforeAccept) return [];
        return [
          {
            schema,
            type: "selectionEvidence",
            proposalId: pending.proposalId,
            result: port.previewSelection(message.selection),
          },
        ];
      }
      case "predict":
        if (workflow.stage === "proposal") {
          if (!agreements.requirePredictionBeforeAccept || !step({ type: "prePredictionMade" })) {
            return [];
          }
          if (pending === undefined) return [];
          answer = message.answer;
          predictedProposalId = pending.proposalId;
          return [wf()];
        }
        if (!step({ type: "predictionMade" })) return [];
        answer = message.answer;
        predictedProposalId = undefined;
        return [wf()];
      case "skipPrediction":
        if (!step({ type: "predictionSkipped" })) return [];
        answer = undefined;
        predictedProposalId = undefined;
        return [wf()];
      case "run": {
        if (workflow.stage !== "run") return [];
        const observed = port.run();
        if (observed === undefined) return [];
        step({ type: "runObserved", completed: observed.reachedGoal });
        const result = comparePrediction(answer, observed.reachedGoal);
        record(
          result === "matched"
            ? "predictionMatched"
            : result === "mismatched"
              ? "predictionMismatched"
              : "predictionSkipped",
        );
        return [
          wf(),
          {
            schema,
            type: "comparison",
            predicted: answer ?? "skipped",
            reachedGoal: observed.reachedGoal,
            result,
            stepsUsed: observed.stepsUsed,
          },
        ];
      }
      case "continue":
        if (!step({ type: "compared" })) return [];
        return [wf(), { schema, type: "explainPrompt", options: [...CONCEPT_IDS] }];
      case "explain": {
        const task = currentTask();
        if (task === undefined || workflow.stage !== "explain") return [];
        const result = checkExplanation(task.id, message.concept);
        record("explainCompleted");
        if (!step({ type: "explained" })) return [];
        return [{ schema, type: "explainFeedback", result }, wf()];
      }
      case "skipExplain":
        if (workflow.stage !== "explain") return [];
        record("explainSkipped");
        if (!step({ type: "explainSkipped" })) return [];
        return [wf()];
      default:
        return undefined;
    }
  }

  function snapshot(): HostMessage[] {
    const out: HostMessage[] = [agreementsMsg(), wf()];
    if (clarifying !== undefined && workflow.stage === "plan") out.push(clarifyMsg(clarifying));
    else if (tasks.length > 0 && workflow.stage !== "intent") out.push(planMsg());
    if (pending !== undefined) out.push(proposalMsg(pending));
    return out;
  }

  function onProgramChanged(): HostMessage[] {
    const hash = port.programHash();
    if (applying || hash === lastHash) {
      return [];
    }
    lastHash = hash;
    if (workflow.stage === "plan") {
      return stalePlan();
    }
    if (["proposal", "predict", "run", "compare"].includes(workflow.stage)) {
      const had = resetLoop();
      return had ? [cleared(), wf()] : [wf()];
    }
    return [];
  }

  return { handle, snapshot, onProgramChanged };
}
