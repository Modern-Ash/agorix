import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_AGREEMENTS, createWorkflow, advance } from "@agorix/agent-workflow";
import { programToWorkspace } from "@agorix/block-editor";
import { STUDIO_PROTOCOL_VERSION as schema } from "@agorix/studio-protocol";
import { AgentPanel } from "./AgentPanel.js";
import { Canvas } from "./Canvas.js";
import {
  canvasHints,
  editOperation,
  fullSelection,
  initialAgentUi,
  reduceAgentUi,
  selectionInput,
  toggleOperation,
  type AgentUiState,
} from "./agentUi.js";

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

describe("clarification ui", () => {
  const options = [
    { id: "first-step", title: "Try one visible movement step" },
    { id: "repeat-pattern", title: "Write the repeated steps once with repeat" },
  ] as const;

  it("shows the question as buttons and clears it when the plan arrives or goes stale", () => {
    let ui = stageState("plan");
    ui = reduceAgentUi(ui, { schema, type: "clarify", options });
    const markup = renderToStaticMarkup(<AgentPanel state={ui} send={() => undefined} />);
    expect(markup).toContain("What do you want to try first?");
    expect(markup).toContain("Try one visible movement step");
    expect(markup).not.toContain("Use this plan");
    const planned = reduceAgentUi(ui, { schema, type: "plan", tasks: [options[0]] });
    expect(planned.clarify).toBeUndefined();
    const stale = reduceAgentUi(ui, { schema, type: "error", code: "STALE_PLAN" });
    expect(stale.clarify).toBeUndefined();
    expect(stale.notice).toMatch(/plan was dropped/);
  });

  it("renders fixed agent chrome and deterministic task titles in Spanish", () => {
    let ui = stageState("plan");
    ui = reduceAgentUi(ui, { schema, type: "clarify", options });
    const markup = renderToStaticMarkup(
      <AgentPanel state={ui} send={() => undefined} locale="es" />,
    );
    expect(markup).toContain("Acuerdos del agente");
    expect(markup).toContain("Que queres probar primero?");
    expect(markup).toContain("Probar un paso visible de movimiento");
    expect(markup).toContain("Escribir los pasos repetidos una vez con repetir");

    const intent = renderToStaticMarkup(
      <AgentPanel state={initialAgentUi()} send={() => undefined} locale="es" />,
    );
    expect(intent).toContain('aria-label="Agente"');
    expect(intent).toContain("Que queres crear?");
    expect(intent).toContain("Pedir");
  });
});

describe("prediction before accept ui", () => {
  const gatedAgreements = { ...DEFAULT_AGREEMENTS, requirePredictionBeforeAccept: true };
  const withProposal = (predicted: boolean): AgentUiState => {
    let ui = stageState("proposal");
    ui = reduceAgentUi(ui, { schema, type: "agreements", agreements: gatedAgreements });
    ui = reduceAgentUi(ui, {
      schema,
      type: "proposal",
      proposalId: "p1",
      purpose: "p",
      rationale: "r",
      changes: [],
    });
    ui = reduceAgentUi(ui, {
      schema,
      type: "prediction",
      questionId: "reaches-goal",
      options: ["yes", "no"],
    });
    return predicted && ui.workflow !== undefined
      ? { ...ui, workflow: { ...ui.workflow, predicted: true } }
      : ui;
  };

  it("disables Accept and asks for a prediction until one is made", () => {
    const before = renderToStaticMarkup(
      <AgentPanel state={withProposal(false)} send={() => undefined} />,
    );
    expect(before).toContain("Before you accept");
    expect(before).toMatch(/<button[^>]*disabled=""[^>]*>Accept/);
    const after = renderToStaticMarkup(
      <AgentPanel state={withProposal(true)} send={() => undefined} />,
    );
    expect(after).not.toContain("Before you accept");
    expect(after).not.toMatch(/<button[^>]*disabled=""[^>]*>Accept/);
  });

  it("does not show runtime outcomes before the required prediction", () => {
    const withEvidence: AgentUiState = {
      ...withProposal(false),
      proposal: {
        proposalId: "p1",
        purpose: "p",
        rationale: "r",
        changes: [],
        evidence: { stepsUsed: 4, reachedGoal: true, outcome: "completed" },
        alternatives: [
          {
            proposalId: "p2",
            purpose: "Other",
            tradeoff: "Different path.",
            evidence: { stepsUsed: 8, reachedGoal: false, outcome: "budget-exceeded" },
          },
        ],
      },
      selectionEvidence: {
        ok: true,
        evidence: { stepsUsed: 2, reachedGoal: false, outcome: "completed" },
      },
    };
    const before = renderToStaticMarkup(
      <AgentPanel
        state={withEvidence}
        send={() => undefined}
        selection={{ include: [0], overrides: {} }}
        onSelectionChange={() => undefined}
      />,
    );
    expect(before).toContain("Before you accept");
    expect(before).not.toContain("reaches the goal");
    expect(before).not.toContain("does not reach the goal");
    expect(before).not.toContain("Choose which changes to keep");

    const after = renderToStaticMarkup(
      <AgentPanel state={withProposal(true)} send={() => undefined} />,
    );
    expect(after).not.toContain("Before you accept");
  });

  it("keeps Accept enabled and hides the prompt when the flag is off", () => {
    let ui = stageState("proposal");
    ui = reduceAgentUi(ui, {
      schema,
      type: "proposal",
      proposalId: "p1",
      purpose: "p",
      rationale: "r",
      changes: [],
    });
    const markup = renderToStaticMarkup(<AgentPanel state={ui} send={() => undefined} />);
    expect(markup).not.toContain("Before you accept");
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*>Accept/);
    expect(
      reduceAgentUi(ui, { schema, type: "error", code: "PREDICTION_REQUIRED" }).notice,
    ).toMatch(/prediction first/);
  });
});

describe("advanced proposal ui", () => {
  const evidence = { stepsUsed: 4, reachedGoal: true, outcome: "completed" } as const;
  const operations = [
    {
      index: 0,
      kind: "replace",
      label: "Replace with repeat 3 times",
      blockId: "b0",
      editable: { field: "count", value: 3 },
    },
    { index: 1, kind: "remove", label: "Remove a block", blockId: "b1" },
    { index: 2, kind: "add", label: "Add move 10 steps" },
  ] as const;
  const proposalState = (): AgentUiState =>
    reduceAgentUi(stageState("proposal"), {
      schema,
      type: "proposal",
      proposalId: "p1",
      purpose: "Shorter",
      rationale: "r",
      changes: [
        { kind: "changed", blockId: "b0" },
        { kind: "removed", blockId: "b1" },
        { kind: "added", afterText: "move(10)" },
      ],
      operations,
      evidence,
      alternatives: [
        {
          proposalId: "p2",
          purpose: "Smaller",
          tradeoff: "Easier to follow.",
          evidence: { ...evidence, reachedGoal: false },
        },
      ],
    });

  it("tracks the selection: toggle, edit and the input sent to the host", () => {
    const full = fullSelection(operations);
    expect(full.include).toEqual([0, 1, 2]);
    const less = toggleOperation(full, 1);
    expect(less.include).toEqual([0, 2]);
    expect(toggleOperation(less, 1).include).toEqual([0, 1, 2]);
    const edited = editOperation(less, 0, 5);
    expect(selectionInput(edited)).toEqual({
      include: [0, 2],
      overrides: [{ index: 0, value: 5 }],
    });
    expect(selectionInput(editOperation(toggleOperation(full, 0), 0, 5)).overrides).toBeUndefined();
  });

  it("anchors hints to blocks and dims skipped ones", () => {
    const state = proposalState();
    const all = canvasHints(state.proposal, fullSelection(operations));
    expect(all.hints).toEqual({ b0: "Replace with repeat 3 times", b1: "Remove a block" });
    expect(all.skipped).toEqual([]);
    expect(all.ghosts).toHaveLength(3);
    const some = canvasHints(
      state.proposal,
      toggleOperation(toggleOperation(fullSelection(operations), 1), 2),
    );
    expect(some.skipped).toEqual(["b1"]);
    expect(some.ghosts.map((g) => g.kind)).toEqual(["changed"]);
  });

  it("renders alternatives side by side, the operation list and measured evidence", () => {
    const state = reduceAgentUi(proposalState(), {
      schema,
      type: "selectionEvidence",
      proposalId: "p1",
      result: { ok: false, reason: "INVALID" },
    });
    const markup = renderToStaticMarkup(
      <AgentPanel
        state={state}
        send={() => undefined}
        selection={fullSelection(operations)}
        onSelectionChange={() => undefined}
      />,
    );
    expect(markup).toContain("Use this one instead");
    expect(markup).toContain("Easier to follow.");
    expect(markup).toContain("reaches the goal (4 steps, runtime fact)");
    expect(markup).toContain("does not reach the goal");
    expect(markup).toContain("Choose which changes to keep");
    expect(markup).toContain("Apply selected (3 of 3)");
    expect(markup).toContain("would break the program");
    expect(markup).toContain('aria-label="count for Replace with repeat 3 times"');
  });

  it("disables Apply selected when nothing is selected and hides the list without operations", () => {
    const empty = renderToStaticMarkup(
      <AgentPanel
        state={proposalState()}
        send={() => undefined}
        selection={{ include: [], overrides: {} }}
        onSelectionChange={() => undefined}
      />,
    );
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Apply selected \(0 of 3\)/);
    const plain = reduceAgentUi(stageState("proposal"), {
      schema,
      type: "proposal",
      proposalId: "p9",
      purpose: "p",
      rationale: "r",
      changes: [],
    });
    const markup = renderToStaticMarkup(
      <AgentPanel
        state={plain}
        send={() => undefined}
        selection={fullSelection(undefined)}
        onSelectionChange={() => undefined}
      />,
    );
    expect(markup).not.toContain("Choose which changes to keep");
    expect(markup).not.toContain("Alternatives");
  });

  it("clears the selection evidence when the proposal changes or is cleared", () => {
    let state = reduceAgentUi(proposalState(), {
      schema,
      type: "selectionEvidence",
      proposalId: "p1",
      result: { ok: true, evidence },
    });
    expect(state.selectionEvidence).toBeDefined();
    expect(
      reduceAgentUi(state, {
        schema,
        type: "selectionEvidence",
        proposalId: "other",
        result: { ok: false, reason: "EMPTY" },
      }),
    ).toBe(state);
    state = reduceAgentUi(state, { schema, type: "proposalCleared" });
    expect(state.selectionEvidence).toBeUndefined();
  });
});

describe("canvas hints", () => {
  it("shows a visible suggestion hint and a skipped marker on a block", () => {
    const markup = renderToStaticMarkup(
      <Canvas
        workspace={workspace}
        onIntent={() => undefined}
        hints={{ hints: { [firstBlockId]: "Add move 10 steps" }, skipped: [firstBlockId] }}
      />,
    );
    expect(markup).toContain("Skipped: Add move 10 steps");
    expect(markup).toContain("ghost-skipped");
    expect(markup).toContain("Suggestion: Add move 10 steps (skipped)");
  });
});

describe("proposal origin ui", () => {
  const withOrigin = (origin?: "provider" | "built-in", notice?: string): AgentUiState =>
    reduceAgentUi(stageState("proposal"), {
      schema,
      type: "proposal",
      proposalId: "p1",
      purpose: "p",
      rationale: "r",
      changes: [],
      ...(origin === undefined ? {} : { origin }),
      ...(notice === undefined ? {} : { notice }),
    });
  const html = (state: AgentUiState) =>
    renderToStaticMarkup(<AgentPanel state={state} send={() => undefined} />);

  it("labels AI and built-in suggestions honestly and shows the notice", () => {
    expect(html(withOrigin("provider"))).toContain("AI suggestion (not in your program yet)");
    const builtIn = html(withOrigin("built-in", "AI help isn't available right now."));
    expect(builtIn).toContain("Built-in suggestion (not in your program yet)");
    expect(builtIn).toContain("AI help isn&#x27;t available right now.");
    expect(html(withOrigin())).toContain("Suggestion (AI, not in your program yet)");
  });
});
