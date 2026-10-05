import { useState } from "react";
import {
  CONCEPT_IDS,
  type AgentAgreements,
  type AssistanceLevel,
  type ConceptId,
  type WorkflowMode,
  type WorkflowStage,
} from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION, type UiMessage } from "@agorix/studio-protocol";
import type { AgentUiState } from "./agentUi.js";

const STAGES: readonly [WorkflowStage, string][] = [
  ["intent", "Intent"],
  ["plan", "Plan"],
  ["proposal", "Proposal"],
  ["predict", "Predict"],
  ["run", "Run"],
  ["compare", "Compare"],
  ["explain", "Explain"],
];

const CONCEPT_LABELS: Record<ConceptId, string> = {
  sequence: "Sequence",
  repetition: "Repetition",
  condition: "Condition",
  event: "Event",
};

type Send = (message: Omit<UiMessage, "schema"> & Record<string, unknown>) => void;

function Ribbon({ stage }: { readonly stage: WorkflowStage | undefined }) {
  const index = STAGES.findIndex(([id]) => id === stage);
  return (
    <ol className="ribbon" aria-label="Agent loop">
      {STAGES.map(([id, label], position) => (
        <li
          key={id}
          aria-current={id === stage ? "step" : undefined}
          className={stage === "done" || (index >= 0 && position < index) ? "done" : undefined}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function Agreements({
  agreements,
  send,
}: {
  readonly agreements: AgentAgreements;
  readonly send: Send;
}) {
  const change = (patch: Partial<AgentAgreements>) =>
    send({ type: "agreementsChanged", agreements: { ...agreements, ...patch } });
  return (
    <details className="agreements">
      <summary>Agent agreements</summary>
      <label>
        <input
          type="checkbox"
          checked={agreements.aiEnabled}
          onChange={(event) => change({ aiEnabled: event.target.checked })}
        />{" "}
        Agent helps
      </label>
      <label>
        How it works{" "}
        <select
          value={agreements.mode}
          onChange={(event) => change({ mode: event.target.value as WorkflowMode })}
        >
          <option value="supervised">Ask me before each suggestion</option>
          <option value="bounded">Suggest after I accept the plan</option>
        </select>
      </label>
      <label>
        Help level up to{" "}
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

export function AgentPanel({
  state,
  send,
}: {
  readonly state: AgentUiState;
  readonly send: (message: UiMessage) => void;
}) {
  const [text, setText] = useState("");
  const post: Send = (message) =>
    send({ schema: STUDIO_PROTOCOL_VERSION, ...message } as UiMessage);
  const stage = state.workflow?.stage;
  const showIntent = stage === undefined || stage === "intent" || stage === "done";
  return (
    <aside className="agent" aria-label="Agent">
      <Agreements agreements={state.agreements} send={post} />
      <Ribbon stage={stage} />
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
            What do you want to make?
            <input
              value={text}
              maxLength={140}
              disabled={!state.available}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!state.available}>
            Ask
          </button>
        </form>
      )}
      {stage === "plan" && state.clarify !== undefined && (
        <section aria-label="Question">
          <p>What do you want to try first?</p>
          {state.clarify.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => post({ type: "answerClarification", taskId: task.id })}
            >
              {task.title}
            </button>
          ))}
        </section>
      )}
      {stage === "plan" && state.clarify === undefined && (
        <section aria-label="Plan">
          {state.tasks !== undefined && state.tasks.length > 0 ? (
            <>
              <ul>
                {state.tasks.map((task) => (
                  <li key={task.id}>{task.title}</li>
                ))}
              </ul>
              <button type="button" onClick={() => post({ type: "acceptPlan" })}>
                Use this plan
              </button>
            </>
          ) : (
            <p>I can&apos;t suggest anything right now. Try changing the program first.</p>
          )}
        </section>
      )}
      {stage === "proposal" && state.proposal === undefined && (
        <button type="button" onClick={() => post({ type: "requestProposal" })}>
          Show me a suggestion
        </button>
      )}
      {stage === "proposal" && state.proposal !== undefined && (
        <section className="suggestion" aria-label="Suggestion">
          <p className="ghost-badge">Suggestion (AI, not in your program yet)</p>
          <p>{state.proposal.purpose}</p>
          <p>{state.proposal.rationale}</p>
          <p>Dashed blocks show what would change.</p>
          <button
            type="button"
            onClick={() =>
              post({
                type: "decideProposal",
                proposalId: state.proposal?.proposalId ?? "",
                decision: "accepted",
              })
            }
          >
            Accept
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
            Reject
          </button>
        </section>
      )}
      {stage === "predict" && state.prediction !== undefined && (
        <section aria-label="Prediction">
          <p>Will the character reach the goal?</p>
          {state.prediction.includes("yes") && (
            <button type="button" onClick={() => post({ type: "predict", answer: "yes" })}>
              Yes
            </button>
          )}
          {state.prediction.includes("no") && (
            <button type="button" onClick={() => post({ type: "predict", answer: "no" })}>
              No
            </button>
          )}
          <button type="button" onClick={() => post({ type: "skipPrediction" })}>
            Skip
          </button>
        </section>
      )}
      {stage === "run" && (
        <button type="button" onClick={() => post({ type: "run" })}>
          Run it
        </button>
      )}
      {stage === "compare" && state.comparison !== undefined && (
        <section aria-label="Comparison">
          <p>
            You predicted:{" "}
            {state.comparison.predicted === "skipped" ? "skipped" : state.comparison.predicted}. The
            run showed:{" "}
            {state.comparison.reachedGoal ? "reached the goal" : "did not reach the goal"} (runtime
            fact, {state.comparison.stepsUsed} steps).
          </p>
          {state.comparison.result === "mismatched" && <p>That is a good thing to look at.</p>}
          <button type="button" onClick={() => post({ type: "continue" })}>
            Continue
          </button>
        </section>
      )}
      {stage === "explain" && state.explain !== undefined && (
        <section aria-label="Explain">
          <p>Which idea made this work?</p>
          {state.explain
            .filter((id) => (CONCEPT_IDS as readonly string[]).includes(id))
            .map((id) => (
              <button key={id} type="button" onClick={() => post({ type: "explain", concept: id })}>
                {CONCEPT_LABELS[id]}
              </button>
            ))}
          <button type="button" onClick={() => post({ type: "skipExplain" })}>
            Skip
          </button>
        </section>
      )}
      {state.feedback !== undefined && (
        <p role="status">
          {state.feedback === "relevant"
            ? "That fits."
            : "Another idea fits better, but your answer is noted."}
        </p>
      )}
      <div className="status" role="status" aria-live="polite">
        {state.notice ?? ""}
      </div>
    </aside>
  );
}
