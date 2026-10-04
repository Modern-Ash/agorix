import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_AGREEMENTS, createWorkflow, advance } from "@agorix/agent-workflow";
import { programToWorkspace } from "@agorix/block-editor";
import { STUDIO_PROTOCOL_VERSION as schema } from "@agorix/studio-protocol";
import { AgentPanel } from "./AgentPanel.js";
import { Canvas } from "./Canvas.js";
import { initialAgentUi, reduceAgentUi, type AgentUiState } from "./agentUi.js";

const program = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
} as const;
const workspace = programToWorkspace(program as never).workspace;
const firstBlockId = workspace.scripts[0]?.statements[0]?.id ?? "";

function stageState(stage: string): AgentUiState {
  let wf = createWorkflow("supervised");
  const steps = [
    "intentStated",
    "planAccepted",
    "proposalDecided",
    "predictionMade",
    "runObserved",
    "compared",
  ];
  const wanted = ["intent", "plan", "proposal", "predict", "run", "compare", "explain"];
  for (let i = 0; i < wanted.indexOf(stage); i += 1) {
    const type = steps[i] ?? "";
    const event =
      type === "planAccepted"
        ? { type, taskCount: 1 }
        : type === "proposalDecided"
          ? { type, decision: "accepted" }
          : type === "runObserved"
            ? { type, completed: false }
            : { type };
    if (type === "proposalDecided") wf = { ...wf, proposalRequested: true };
    const result = advance(wf, event as never);
    if (result.ok) wf = result.state;
  }
  return { ...initialAgentUi(), workflow: wf };
}

describe("agent ui", () => {
  it("reduces host messages", () => {
    let state = initialAgentUi();
    state = reduceAgentUi(state, {
      schema,
      type: "proposal",
      proposalId: "p",
      purpose: "a",
      rationale: "b",
      changes: [],
    });
    expect(state.proposal?.proposalId).toBe("p");
    state = reduceAgentUi(state, { schema, type: "proposalCleared" });
    expect(state.proposal).toBeUndefined();
    state = reduceAgentUi(state, { schema, type: "error", code: "STALE_PROPOSAL" });
    expect(state.notice).toMatch(/Nothing was applied/);
    state = reduceAgentUi(state, { schema, type: "agentUnavailable" });
    expect(state.available).toBe(false);
    state = reduceAgentUi(state, {
      schema,
      type: "agreements",
      agreements: { ...DEFAULT_AGREEMENTS, aiEnabled: true },
    });
    expect(state.available).toBe(true);
    state = reduceAgentUi(
      { ...state, tasks: [{ id: "first-step", title: "t" }] },
      { schema, type: "workflow", state: createWorkflow("supervised") },
    );
    expect(state.tasks).toBeUndefined();
  });

  it("renders the ribbon, a provisional suggestion and an accessible intent bar", () => {
    const base = stageState("proposal");
    const state: AgentUiState = {
      ...base,
      proposal: { proposalId: "p", purpose: "Try a step", rationale: "Safe", changes: [] },
    };
    const html = renderToStaticMarkup(<AgentPanel state={state} send={() => undefined} />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Suggestion (AI, not in your program yet)");
    expect(html).toContain("Accept");
    expect(html).toContain("Reject");
    expect(html).not.toMatch(/success|style=/);
    const intent = renderToStaticMarkup(
      <AgentPanel state={initialAgentUi()} send={() => undefined} />,
    );
    expect(intent).toContain('maxLength="140"');
    const off = renderToStaticMarkup(
      <AgentPanel state={{ ...initialAgentUi(), available: false }} send={() => undefined} />,
    );
    expect(off).toContain("disabled");
  });

  it("marks ghost blocks and ignores unknown ids", () => {
    const html = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        ghosts={[
          { kind: "changed", blockId: firstBlockId },
          { kind: "removed", blockId: "block:missing" },
          { kind: "added", afterText: "repeat(3)" },
        ]}
      />,
    );
    expect(html).toContain("ghost-changed");
    expect(html).toContain("Suggestion would change this block");
    expect(html).not.toContain("ghost-removed");
    expect(html).toContain("ghost-added");
    expect(html).toContain("repeat(3)");
    expect(html.match(/draggable="true"/g)).toHaveLength(2);
  });
});
