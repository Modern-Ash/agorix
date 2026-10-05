import { useState } from "react";
import {
  CONCEPT_IDS,
  type AgentAgreements,
  type AssistanceLevel,
  type WorkflowMode,
  type WorkflowStage,
} from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION, type UiMessage } from "@agorix/studio-protocol";
import {
  editOperation,
  selectionInput,
  toggleOperation,
  type AgentUiState,
  type SelectionState,
} from "./agentUi.js";
import { copyFor, taskTitle, type StudioUiCopy, type StudioUiLocale } from "./i18n.js";

const STAGES = [
  "intent",
  "plan",
  "proposal",
  "predict",
  "run",
  "compare",
  "explain",
] as const satisfies readonly WorkflowStage[];

type Send = (message: Omit<UiMessage, "schema"> & Record<string, unknown>) => void;

function Ribbon({
  stage,
  copy,
}: {
  readonly stage: WorkflowStage | undefined;
  readonly copy: StudioUiCopy;
}) {
  const index = STAGES.findIndex((id) => id === stage);
  return (
    <ol className="ribbon" aria-label={copy.agentLoop}>
      {STAGES.map((id, position) => (
        <li
          key={id}
          aria-current={id === stage ? "step" : undefined}
          className={stage === "done" || (index >= 0 && position < index) ? "done" : undefined}
        >
          {copy.stages[id]}
        </li>
      ))}
    </ol>
  );
}

function Agreements({
  agreements,
  send,
  copy,
}: {
  readonly agreements: AgentAgreements;
  readonly send: Send;
  readonly copy: StudioUiCopy;
}) {
  const change = (patch: Partial<AgentAgreements>) =>
    send({ type: "agreementsChanged", agreements: { ...agreements, ...patch } });
  return (
    <details className="agreements">
      <summary>{copy.agreements}</summary>
      <label>
        <input
          type="checkbox"
          checked={agreements.aiEnabled}
          onChange={(event) => change({ aiEnabled: event.target.checked })}
        />{" "}
        {copy.agentHelps}
      </label>
      <label>
        {copy.howItWorks}{" "}
        <select
          value={agreements.mode}
          onChange={(event) => change({ mode: event.target.value as WorkflowMode })}
        >
          <option value="supervised">{copy.supervised}</option>
          <option value="bounded">{copy.bounded}</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={agreements.requirePredictionBeforeAccept}
          onChange={(event) => change({ requirePredictionBeforeAccept: event.target.checked })}
        />{" "}
        {copy.predictBeforeAccept}
      </label>
      <label>
        {copy.helpLevelUpTo}{" "}
        <select
          value={agreements.assistanceCeiling}
          onChange={(event) =>
            change({ assistanceCeiling: Number(event.target.value) as AssistanceLevel })
          }
        >
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}

function evidenceText(
  evidence: {
    readonly stepsUsed: number;
    readonly reachedGoal: boolean;
  },
  copy: StudioUiCopy,
): string {
  return `${copy.runResult} ${evidence.reachedGoal ? copy.reachesGoal : copy.missesGoal} (${evidence.stepsUsed} ${copy.steps}, ${copy.runtimeFact}).`;
}

function conceptLabel(id: string, copy: StudioUiCopy): string {
  if (id === "sequence") return copy.sequence;
  if (id === "repetition") return copy.repetition;
  if (id === "condition") return copy.condition;
  if (id === "event") return copy.event;
  return id;
}

function Alternatives({
  state,
  post,
  copy,
  showEvidence,
}: {
  readonly state: AgentUiState;
  readonly post: Send;
  readonly copy: StudioUiCopy;
  readonly showEvidence: boolean;
}) {
  const proposal = state.proposal;
  if (proposal === undefined || proposal.alternatives === undefined) return null;
  return (
    <div className="alternatives" role="group" aria-label={copy.alternatives}>
      <article className="alt current" aria-current="true">
        <h4>{proposal.purpose}</h4>
        {showEvidence && proposal.evidence !== undefined && (
          <p>{evidenceText(proposal.evidence, copy)}</p>
        )}
        <p className="ghost-badge">{copy.showingThisOne}</p>
      </article>
      {proposal.alternatives.map((alt) => (
        <article className="alt" key={alt.proposalId}>
          <h4>{alt.purpose}</h4>
          <p>{alt.tradeoff}</p>
          {showEvidence && <p>{evidenceText(alt.evidence, copy)}</p>}
          <button
            type="button"
            onClick={() => post({ type: "chooseAlternative", proposalId: alt.proposalId })}
          >
            {copy.useAlternative}
          </button>
        </article>
      ))}
    </div>
  );
}

function Operations({
  state,
  selection,
  onSelectionChange,
  post,
  copy,
  needsPrediction,
}: {
  readonly state: AgentUiState;
  readonly selection: SelectionState;
  readonly onSelectionChange: (next: SelectionState) => void;
  readonly post: Send;
  readonly copy: StudioUiCopy;
  readonly needsPrediction: boolean;
}) {
  const proposal = state.proposal;
  if (proposal?.operations === undefined || proposal.operations.length === 0) return null;
  const preview = (next: SelectionState) => {
    onSelectionChange(next);
    post({
      type: "previewSelection",
      proposalId: proposal.proposalId,
      selection: selectionInput(next),
    });
  };
  return (
    <fieldset className="operations">
      <legend>{copy.chooseChanges}</legend>
      {proposal.operations.map((operation) => {
        const included = selection.include.includes(operation.index);
        const value = selection.overrides[operation.index] ?? operation.editable?.value;
        return (
          <div className="operation" key={operation.index}>
            <label>
              <input
                type="checkbox"
                checked={included}
                onChange={() => preview(toggleOperation(selection, operation.index))}
              />{" "}
              {operation.label}
            </label>
            {operation.editable !== undefined && (
              <label>
                {" "}
                {operation.editable.field}{" "}
                <input
                  type="number"
                  value={value}
                  disabled={!included}
                  aria-label={`${operation.editable.field} ${copy.for} ${operation.label}`}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isInteger(parsed)) {
                      preview(editOperation(selection, operation.index, parsed));
                    }
                  }}
                />
              </label>
            )}
          </div>
        );
      })}
      {!needsPrediction && state.selectionEvidence !== undefined && (
        <p role="status">
          {state.selectionEvidence.ok
            ? evidenceText(state.selectionEvidence.evidence, copy)
            : state.selectionEvidence.reason === "EMPTY"
              ? copy.empty
              : state.selectionEvidence.reason === "INVALID"
                ? copy.invalid
                : copy.stale}
        </p>
      )}
      <button
        type="button"
        disabled={selection.include.length === 0 || needsPrediction}
        onClick={() =>
          post({
            type: "decideProposal",
            proposalId: proposal.proposalId,
            decision: "modified",
            selection: selectionInput(selection),
          })
        }
      >
        {`${copy.applySelected} (${selection.include.length} ${copy.of} ${proposal.operations.length})`}
      </button>
    </fieldset>
  );
}

export function AgentPanel({
  state,
  send,
  selection,
  onSelectionChange,
  locale,
}: {
  readonly state: AgentUiState;
  readonly send: (message: UiMessage) => void;
  readonly selection?: SelectionState | undefined;
  readonly onSelectionChange?: ((next: SelectionState) => void) | undefined;
  readonly locale?: StudioUiLocale | undefined;
}) {
  const copy = copyFor(locale ?? "en");
  const [text, setText] = useState("");
  const post: Send = (message) =>
    send({ schema: STUDIO_PROTOCOL_VERSION, ...message } as UiMessage);
  const stage = state.workflow?.stage;
  const needsPrediction =
    state.agreements.requirePredictionBeforeAccept && state.workflow?.predicted !== true;
  const showIntent = stage === undefined || stage === "intent" || stage === "done";
  return (
    <aside className="agent" aria-label={copy.agentLabel}>
      <Agreements agreements={state.agreements} send={post} copy={copy} />
      <Ribbon stage={stage} copy={copy} />
      {showIntent && (
        <form
          className="intent-bar"
          onSubmit={(event) => {
            event.preventDefault();
            const value = text.trim();
            if (value.length > 0 && state.available) {
              post({ type: "stateIntent", text: value });
              setText("");
            }
          }}
        >
          <label>
            {copy.intentQuestion}
            <input
              value={text}
              maxLength={140}
              disabled={!state.available}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!state.available}>
            {copy.ask}
          </button>
        </form>
      )}
      {stage === "plan" && state.clarify !== undefined && (
        <section aria-label={copy.question}>
          <p>{copy.clarifyQuestion}</p>
          {state.clarify.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => post({ type: "answerClarification", taskId: task.id })}
            >
              {taskTitle(task, copy)}
            </button>
          ))}
        </section>
      )}
      {stage === "plan" && state.clarify === undefined && (
        <section aria-label={copy.plan}>
          {state.tasks !== undefined && state.tasks.length > 0 ? (
            <>
              <ul>
                {state.tasks.map((task) => (
                  <li key={task.id}>{taskTitle(task, copy)}</li>
                ))}
              </ul>
              <button type="button" onClick={() => post({ type: "acceptPlan" })}>
                {copy.usePlan}
              </button>
            </>
          ) : (
            <p>{copy.noPlan}</p>
          )}
        </section>
      )}
      {stage === "proposal" && state.proposal === undefined && (
        <button type="button" onClick={() => post({ type: "requestProposal" })}>
          {copy.showSuggestion}
        </button>
      )}
      {stage === "proposal" && state.proposal !== undefined && (
        <section className="suggestion" aria-label={copy.suggestion}>
          <p className="ghost-badge">
            {state.proposal.origin === "built-in"
              ? copy.builtInSuggestion
              : state.proposal.origin === "provider"
                ? copy.aiSuggestion
                : copy.unknownSuggestion}
          </p>
          {state.proposal.notice !== undefined && (
            <p className="notice" role="status">
              {state.proposal.notice}
            </p>
          )}
          <p>{state.proposal.purpose}</p>
          <p>{state.proposal.rationale}</p>
          <p>{copy.dashedBlocks}</p>
          {!needsPrediction && state.proposal.evidence !== undefined && (
            <p>{evidenceText(state.proposal.evidence, copy)}</p>
          )}
          <Alternatives state={state} post={post} copy={copy} showEvidence={!needsPrediction} />
          {!state.agreements.requirePredictionBeforeAccept &&
            selection !== undefined &&
            onSelectionChange !== undefined && (
              <Operations
                state={state}
                selection={selection}
                onSelectionChange={onSelectionChange}
                post={post}
                copy={copy}
                needsPrediction={needsPrediction}
              />
            )}
          {needsPrediction && state.prediction !== undefined && (
            <div aria-label={copy.predictionBeforeAccept}>
              <p>{copy.beforeAccept}</p>
              {state.prediction.includes("yes") && (
                <button type="button" onClick={() => post({ type: "predict", answer: "yes" })}>
                  {copy.yes}
                </button>
              )}
              {state.prediction.includes("no") && (
                <button type="button" onClick={() => post({ type: "predict", answer: "no" })}>
                  {copy.no}
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={needsPrediction}
            onClick={() =>
              post({
                type: "decideProposal",
                proposalId: state.proposal?.proposalId ?? "",
                decision: "accepted",
              })
            }
          >
            {copy.accept}
          </button>
          <button
            type="button"
            onClick={() =>
              post({
                type: "decideProposal",
                proposalId: state.proposal?.proposalId ?? "",
                decision: "rejected",
              })
            }
          >
            {copy.reject}
          </button>
        </section>
      )}
      {stage === "predict" && state.prediction !== undefined && (
        <section aria-label={copy.prediction}>
          <p>{copy.predictionQuestion}</p>
          {state.prediction.includes("yes") && (
            <button type="button" onClick={() => post({ type: "predict", answer: "yes" })}>
              {copy.yes}
            </button>
          )}
          {state.prediction.includes("no") && (
            <button type="button" onClick={() => post({ type: "predict", answer: "no" })}>
              {copy.no}
            </button>
          )}
          <button type="button" onClick={() => post({ type: "skipPrediction" })}>
            {copy.skip}
          </button>
        </section>
      )}
      {stage === "run" && (
        <button type="button" onClick={() => post({ type: "run" })}>
          {copy.runIt}
        </button>
      )}
      {stage === "compare" && state.comparison !== undefined && (
        <section aria-label={copy.comparison}>
          <p>
            {copy.predicted}{" "}
            {state.comparison.predicted === "skipped" ? copy.skipped : state.comparison.predicted}.{" "}
            {copy.runShowed} {state.comparison.reachedGoal ? copy.reachesGoal : copy.missesGoal} (
            {copy.runtimeFact}, {state.comparison.stepsUsed} {copy.steps}).
          </p>
          {state.comparison.result === "mismatched" && <p>{copy.mismatchNote}</p>}
          <button type="button" onClick={() => post({ type: "continue" })}>
            {copy.continue}
          </button>
        </section>
      )}
      {stage === "explain" && state.explain !== undefined && (
        <section aria-label={copy.explain}>
          <p>{copy.explainQuestion}</p>
          {state.explain
            .filter((id) => (CONCEPT_IDS as readonly string[]).includes(id))
            .map((id) => (
              <button key={id} type="button" onClick={() => post({ type: "explain", concept: id })}>
                {conceptLabel(id, copy)}
              </button>
            ))}
          <button type="button" onClick={() => post({ type: "skipExplain" })}>
            {copy.skip}
          </button>
        </section>
      )}
      {state.feedback !== undefined && (
        <p role="status">{state.feedback === "relevant" ? copy.relevant : copy.other}</p>
      )}
      <div className="status" role="status" aria-live="polite">
        {state.notice ?? ""}
      </div>
    </aside>
  );
}
