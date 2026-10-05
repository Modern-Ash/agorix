import {
  CONCEPT_IDS,
  DEFAULT_AGREEMENTS,
  advance,
  checkExplanation,
  comparePrediction,
  createWorkflow,
  effectiveAssistance,
  needsClarification,
  planTasks,
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
  readonly changes: GhostChange[];
  readonly operations?: OperationView[];
  readonly evidence?: EvidenceView;
  readonly alternatives?: AlternativeView[];
}

export type SelectionPreview =
  | { readonly ok: true; readonly evidence: EvidenceView }
  | { readonly ok: false; readonly reason: "EMPTY" | "INVALID" | "STALE" };

export interface AgentPort {
  availableTasks(): AgentTaskId[];
  /** Creates and remembers the pending proposal; undefined when the task no longer applies. */
  proposeFor(task: AgentTaskId): ProposalView | undefined;
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

export function createAgentHost(port: AgentPort): AgentHost {
  let agreements: AgentAgreements = DEFAULT_AGREEMENTS;
  let workflow: WorkflowState = createWorkflow(agreements.mode);
  let tasks: AgentTask[] = [];
  let pending: ProposalView | undefined;
  let answer: PredictionAnswer | undefined;
  let applying = false;
  let clarifying: AgentTask[] | undefined;
  let planBaseHash: string | undefined;
  let lastHash: string | undefined = port.programHash();

  const wf = (): HostMessage => ({ schema, type: "workflow", state: workflow });
  const agreementsMsg = (): HostMessage => ({ schema, type: "agreements", agreements });
  const cleared = (): HostMessage => ({ schema, type: "proposalCleared" });
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
    changes: view.changes,
    ...(view.operations === undefined ? {} : { operations: view.operations }),
    ...(view.evidence === undefined ? {} : { evidence: view.evidence }),
    ...(view.alternatives === undefined ? {} : { alternatives: view.alternatives }),
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
    return hadPending;
  }

  function record(type: AgentEvent["type"]): void {
    const task = currentTask();
    if (task !== undefined) {
      port.record({ type, taskId: task.id, scaffoldLevel: level() });
    }
  }

  function requestProposal(): HostMessage[] {
    const task = currentTask();
    if (workflow.stage !== "proposal" || pending !== undefined || task === undefined) {
      return [];
    }
    step({ type: "proposalRequested" });
    const view = port.proposeFor(task.id);
    if (view === undefined) {
      workflow = { ...workflow, proposalRequested: false };
      return [cleared(), wf()];
    }
    pending = view;
    record("proposalRequested");
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
      proposalId !== pending.proposalId
    ) {
      return [];
    }
    if (decision === "modified" && selection === undefined) {
      return [];
    }
    if (decision === "modified" && selection !== undefined && selection.include.length === 0) {
      decision = "rejected";
    }
    if (
      decision !== "rejected" &&
      agreements.requirePredictionBeforeAccept &&
      !workflow.predicted
    ) {
      return [{ schema, type: "error", code: "PREDICTION_REQUIRED" }];
    }
    if (decision === "rejected") {
      port.rejectPending();
      pending = undefined;
      answer = undefined;
      record("proposalRejected");
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
    pending = undefined;
    if (outcome === "stale") {
      answer = undefined;
      step({ type: "proposalDecided", decision: "rejected" });
      return [{ schema, type: "error", code: "STALE_PROPOSAL" }, cleared(), wf()];
    }
    record("proposalAccepted");
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
        return agreements.mode === "bounded" ? [wf(), ...requestProposal()] : [wf()];
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
        return [proposalMsg(view)];
      }
      case "previewSelection": {
        if (pending === undefined || message.proposalId !== pending.proposalId) return [];
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
          answer = message.answer;
          return [wf()];
        }
        if (!step({ type: "predictionMade" })) return [];
        answer = message.answer;
        return [wf()];
      case "skipPrediction":
        if (!step({ type: "predictionSkipped" })) return [];
        answer = undefined;
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
