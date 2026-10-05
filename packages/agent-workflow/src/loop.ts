export type WorkflowStage =
  "intent" | "plan" | "proposal" | "predict" | "run" | "compare" | "explain" | "done";

export type WorkflowMode = "supervised" | "bounded";

export interface WorkflowState {
  readonly stage: WorkflowStage;
  readonly mode: WorkflowMode;
  readonly taskIndex: number;
  readonly taskCount: number;
  readonly proposalRequested: boolean;
  readonly rejections: number;
  readonly predicted: boolean;
  readonly explained: boolean;
  /** Set only from runtime evidence via runObserved; never from AI judgment. */
  readonly completed: boolean;
}

export type WorkflowEvent =
  | { readonly type: "intentStated" }
  | { readonly type: "planAccepted"; readonly taskCount: number }
  | { readonly type: "proposalRequested" }
  | { readonly type: "proposalDecided"; readonly decision: "accepted" | "rejected" | "modified" }
  | { readonly type: "prePredictionMade" }
  | { readonly type: "predictionMade" }
  | { readonly type: "predictionSkipped" }
  | { readonly type: "runObserved"; readonly completed: boolean }
  | { readonly type: "compared" }
  | { readonly type: "explained" }
  | { readonly type: "explainSkipped" };

export type AdvanceResult =
  | { readonly ok: true; readonly state: WorkflowState }
  | { readonly ok: false; readonly error: "INVALID_TRANSITION" };

export type AgentAction =
  | "ask-intent"
  | "offer-plan"
  | "await-learner-request"
  | "request-proposal"
  | "await-decision"
  | "await-prediction"
  | "await-run"
  | "show-comparison"
  | "ask-explanation"
  | "none";

export function createWorkflow(mode: WorkflowMode): WorkflowState {
  return {
    stage: "intent",
    mode,
    taskIndex: 0,
    taskCount: 0,
    proposalRequested: false,
    rejections: 0,
    predicted: false,
    explained: false,
    completed: false,
  };
}

const INVALID: AdvanceResult = { ok: false, error: "INVALID_TRANSITION" };

function ok(state: WorkflowState): AdvanceResult {
  return { ok: true, state };
}

export function advance(state: WorkflowState, event: WorkflowEvent): AdvanceResult {
  switch (event.type) {
    case "intentStated":
      return state.stage === "intent" ? ok({ ...state, stage: "plan" }) : INVALID;
    case "planAccepted":
      if (state.stage !== "plan" || !Number.isInteger(event.taskCount) || event.taskCount < 1) {
        return INVALID;
      }
      return ok({ ...state, stage: "proposal", taskIndex: 0, taskCount: event.taskCount });
    case "proposalRequested":
      return state.stage === "proposal" ? ok({ ...state, proposalRequested: true }) : INVALID;
    case "proposalDecided":
      if (state.stage !== "proposal") {
        return INVALID;
      }
      if (event.decision === "rejected") {
        return ok({
          ...state,
          proposalRequested: false,
          predicted: false,
          rejections: state.rejections + 1,
        });
      }
      return ok({
        ...state,
        stage: state.predicted ? "run" : "predict",
        proposalRequested: false,
        explained: false,
      });
    case "prePredictionMade":
      return state.stage === "proposal" && state.proposalRequested && !state.predicted
        ? ok({ ...state, predicted: true })
        : INVALID;
    case "predictionMade":
    case "predictionSkipped":
      return state.stage === "predict"
        ? ok({ ...state, stage: "run", predicted: event.type === "predictionMade" })
        : INVALID;
    case "runObserved":
      return state.stage === "run"
        ? ok({ ...state, stage: "compare", completed: event.completed })
        : INVALID;
    case "compared":
      return state.stage === "compare" ? ok({ ...state, stage: "explain" }) : INVALID;
    case "explained":
    case "explainSkipped": {
      if (state.stage !== "explain") {
        return INVALID;
      }
      const explained = event.type === "explained";
      const nextIndex = state.taskIndex + 1;
      if (nextIndex >= state.taskCount) {
        return ok({ ...state, stage: "done", explained });
      }
      return ok({
        ...state,
        stage: "proposal",
        taskIndex: nextIndex,
        explained,
        predicted: false,
        completed: false,
        rejections: 0,
      });
    }
  }
}

export function nextAgentAction(state: WorkflowState): AgentAction {
  switch (state.stage) {
    case "intent":
      return "ask-intent";
    case "plan":
      return "offer-plan";
    case "proposal":
      if (state.proposalRequested) {
        return "await-decision";
      }
      return state.mode === "bounded" ? "request-proposal" : "await-learner-request";
    case "predict":
      return "await-prediction";
    case "run":
      return "await-run";
    case "compare":
      return "show-comparison";
    case "explain":
      return "ask-explanation";
    case "done":
      return "none";
  }
}
