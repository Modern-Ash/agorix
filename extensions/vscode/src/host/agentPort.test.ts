import { describe, expect, it, vi } from "vitest";
import type { AgentEvent } from "@agorix/agent-workflow";
import {
  createIntentPlanResponse,
  createLearningCompanionResponse,
  type IntentPlanRequest,
} from "@agorix/tutor-contract";
import {
  createProposalSession,
  createStudioStarterProject,
  openStoredProject,
  type StudioProposalSession,
} from "../studioCore.js";
import { createFirstStepProposal, programSemanticHash } from "@agorix/proposals";
import type { ProviderProposalResult } from "../studioProposalSource.js";
import { createAgentPort, type AgentPortDeps } from "./agentPort.js";

function projectWith(statements: unknown[]) {
  const base = createStudioStarterProject({ starter: "blank", now: "2026-01-01T00:00:00.000Z" });
  return openStoredProject({
    ...base,
    program: {
      ...base.program,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
    },
  } as never);
}

function setup(statements: unknown[], options: Partial<AgentPortDeps> = {}) {
  let project = projectWith(statements);
  let active: StudioProposalSession | undefined;
  const events: AgentEvent[] = [];
  const applyActiveProposal = vi.fn(async () => undefined);
  const commitProgram = vi.fn(async (_program: unknown) => undefined);
  const port = createAgentPort({
    getProject: () => project,
    getActiveProposal: () => active,
    setActiveProposal: (next) => {
      active = next;
    },
    applyActiveProposal,
    commitProgram,
    rejectActiveProposal: () => {
      active = undefined;
    },
    runAndGetResult: () => undefined,
    events,
    ...(options.providerProposal === undefined
      ? {}
      : { providerProposal: options.providerProposal }),
    ...(options.providerIntentPlan === undefined
      ? {}
      : { providerIntentPlan: options.providerIntentPlan }),
  });
  return {
    port,
    applyActiveProposal,
    commitProgram,
    events,
    setProject: (next: unknown[]) => (project = projectWith(next)),
    active: () => active,
  };
}

const repeated = [1, 2, 3].flatMap(() => [
  { type: "move", steps: 20 },
  { type: "turn", degrees: 90 },
]);

describe("agentPort", () => {
  it("lists tasks that apply to the current program", () => {
    expect(setup([]).port.availableTasks()).toEqual(["first-step"]);
    expect(setup(repeated).port.availableTasks()).toEqual(["repeat-pattern"]);
  });

  it("plans learner intent through the provider-neutral intent-plan contract", () => {
    expect(setup([]).port.planIntent?.("make it move")).toMatchObject({
      kind: "plan",
      tasks: [{ id: "first-step" }],
    });
    expect(setup(repeated).port.planIntent?.("repite 3 veces")).toMatchObject({
      kind: "plan",
      tasks: [{ id: "repeat-pattern" }],
    });
    expect(setup([]).port.planIntent?.("hola")).toMatchObject({
      kind: "plan",
      tasks: [{ id: "first-step" }],
    });
  });

  it("builds a proposal view and remembers it; repeat changes resolve to blocks", async () => {
    const empty = setup([]);
    const first = await empty.port.proposeFor("first-step");
    expect(first?.purpose).toBeTruthy();
    expect(empty.active()).toBeDefined();
    const repeat = await setup(repeated).port.proposeFor("repeat-pattern");
    expect(repeat?.changes.some((change) => change.blockId !== undefined)).toBe(true);
  });

  it("refuses to apply a stale proposal and never calls the apply path", async () => {
    const ctx = setup([]);
    await ctx.port.proposeFor("first-step");
    ctx.setProject([{ type: "move", steps: 5 }]);
    expect(await ctx.port.applyPending()).toBe("stale");
    expect(ctx.applyActiveProposal).not.toHaveBeenCalled();
  });

  it("applies a fresh proposal, hashes the program and caps events", async () => {
    const ctx = setup([]);
    await ctx.port.proposeFor("first-step");
    expect(await ctx.port.applyPending()).toBe("applied");
    expect(ctx.applyActiveProposal).toHaveBeenCalledOnce();
    expect(ctx.port.programHash()).toMatch(/^[A-Za-z0-9:_-]{1,128}$/);
    for (let i = 0; i < 250; i += 1) {
      ctx.port.record({ type: "proposalRequested", taskId: "first-step", scaffoldLevel: 4 });
    }
    expect(ctx.events).toHaveLength(200);
  });
});

describe("agentPort provider-backed intent planning", () => {
  const responseFor = (
    request: IntentPlanRequest,
    concept: "movement" | "repetition",
    baseProgramHash = programSemanticHash(request.program),
  ) =>
    createIntentPlanResponse({
      kind: "plan",
      message: "Plan ready.",
      metadata: {
        provenance: "local-provider",
        uncertainty: "low",
        questionsAsked: 0,
      },
      plan: {
        schema: "agorix/intent-plan/v1",
        id: "provider-plan",
        baseProgramHash,
        status: "proposed",
        revision: 1,
        learnerIntent: request.learnerIntent,
        learningObjective: request.mission.learningObjective,
        concepts: request.mission.concepts,
        steps: [
          {
            id: "step-1",
            order: 1,
            description: "Provider-selected task.",
            concept,
            rationale: "Provider mapped intent to a mission concept.",
          },
        ],
        omittedSteps: 0,
      },
    });

  it("uses provider intent planning when the response is fresh", async () => {
    const ctx = setup(repeated, {
      providerIntentPlan: async (request) => responseFor(request, "repetition"),
    });
    const planned = await ctx.port.planIntent?.("make it shorter");
    expect(planned).toMatchObject({
      kind: "plan",
      tasks: [{ id: "repeat-pattern" }],
    });
  });

  it("maps provider clarifications to fixed task choices only", async () => {
    const ctx = setup(repeated, {
      providerIntentPlan: async (_request) =>
        createIntentPlanResponse({
          kind: "clarification",
          message: "Which direction?",
          metadata: {
            provenance: "local-provider",
            uncertainty: "medium",
            questionsAsked: 1,
          },
          clarification: {
            reason: "vague-outcome",
            question: "Provider free text should not become a task title.",
            options: ["provider-specific wording"],
          },
        }),
    });
    const planned = await ctx.port.planIntent?.("make it better");
    expect(planned).toMatchObject({
      kind: "plan",
      tasks: [{ id: "repeat-pattern" }],
    });
    expect(JSON.stringify(planned)).not.toContain("provider-specific wording");
  });

  it("falls back to deterministic planning for stale provider intent plans", async () => {
    const ctx = setup([], {
      providerIntentPlan: async (request) => responseFor(request, "repetition", "stale-hash"),
    });
    const planned = await ctx.port.planIntent?.("make it move");
    expect(planned).toMatchObject({
      kind: "plan",
      tasks: [{ id: "first-step" }],
    });
  });
});

describe("agentPort advanced proposals", () => {
  it("offers a real alternative with measured evidence and lets the learner switch", async () => {
    const ctx = setup([]);
    const first = (await ctx.port.proposeFor("first-step"))!;
    expect(first.proposalId).toBe("first-step");
    expect(first.evidence).toMatchObject({ outcome: "completed" });
    expect(first.operations).toEqual([
      expect.objectContaining({
        index: 0,
        kind: "add",
        label: "Add move 10 steps",
        editable: { field: "steps", value: 10 },
      }),
    ]);
    expect(first.alternatives).toHaveLength(1);
    const alt = first.alternatives![0]!;
    expect(alt.proposalId).toBe("first-step-small");
    expect(alt.tradeoff).toMatch(/shorter/);
    expect(alt.evidence.stepsUsed).toBeGreaterThan(0);
    const chosen = ctx.port.chooseAlternative("first-step-small")!;
    expect(chosen.operations?.[0]?.label).toBe("Add move 5 steps");
    expect(chosen.alternatives?.[0]?.proposalId).toBe("first-step");
    expect(ctx.active()?.review.proposal.id).toBe("first-step-small");
    expect(ctx.port.chooseAlternative("nope")).toBeUndefined();
    expect(ctx.applyActiveProposal).not.toHaveBeenCalled();
  });

  it("anchors operations to the original blocks and offers a single repeat proposal", async () => {
    const view = (await setup(repeated).port.proposeFor("repeat-pattern"))!;
    expect(view.alternatives).toBeUndefined();
    expect(view.operations).toHaveLength(6);
    expect(view.operations?.every((op) => op.blockId !== undefined)).toBe(true);
    expect(view.operations?.filter((op) => op.kind === "remove")).toHaveLength(5);
  });

  it("previews a selection with evidence and reports empty, invalid and stale", async () => {
    const ctx = setup([]);
    await ctx.port.proposeFor("first-step");
    expect(ctx.port.previewSelection({ include: [0] })).toMatchObject({
      ok: true,
      evidence: { outcome: "completed" },
    });
    expect(ctx.port.previewSelection({ include: [] })).toEqual({ ok: false, reason: "EMPTY" });
    expect(
      ctx.port.previewSelection({ include: [0], overrides: [{ index: 0, value: 100000 }] }),
    ).toEqual({ ok: false, reason: "INVALID" });
    ctx.setProject([{ type: "move", steps: 5 }]);
    expect(ctx.port.previewSelection({ include: [0] })).toEqual({ ok: false, reason: "STALE" });
  });

  it("applies a selected subset as one commit and never touches the apply-all path", async () => {
    const ctx = setup([]);
    await ctx.port.proposeFor("first-step");
    expect(
      await ctx.port.applySelection({ include: [0], overrides: [{ index: 0, value: 7 }] }),
    ).toBe("applied");
    expect(ctx.commitProgram).toHaveBeenCalledOnce();
    const committed = ctx.commitProgram.mock.calls[0]![0] as {
      scripts: { statements: unknown[] }[];
    };
    expect(committed.scripts[0]?.statements).toEqual([{ type: "move", steps: 7 }]);
    expect(ctx.applyActiveProposal).not.toHaveBeenCalled();
    expect(ctx.active()).toBeUndefined();
  });

  it("commits nothing for an empty, invalid or stale selection", async () => {
    const ctx = setup([]);
    await ctx.port.proposeFor("first-step");
    expect(await ctx.port.applySelection({ include: [] })).toBe("empty");
    expect(
      await ctx.port.applySelection({ include: [0], overrides: [{ index: 0, value: 100000 }] }),
    ).toBe("invalid");
    ctx.setProject([{ type: "move", steps: 5 }]);
    expect(await ctx.port.applySelection({ include: [0] })).toBe("stale");
    expect(ctx.commitProgram).not.toHaveBeenCalled();
  });
});

describe("agentPort provider-backed proposals", () => {
  const providerSession = (project: ReturnType<typeof projectWith>) =>
    createProposalSession(
      project,
      createFirstStepProposal({
        id: "ai-first-step",
        baseProgram: project.stored.program,
        purpose: "AI step",
        rationale: "The assistant suggests a longer move.",
        steps: 6,
      })!,
    );
  const providerResponse = (session: StudioProposalSession) =>
    createLearningCompanionResponse({
      capability: "builder",
      message: session.review.proposal.purpose,
      nodeIds: session.review.proposal.affectedNodeIds,
      concepts: ["movement"],
      metadata: {
        capability: "builder",
        scaffoldLevel: 4,
        provenance: "deterministic-fake",
        uncertainty: "low",
      },
      payload: {
        kind: "program-proposal",
        proposal: session.review.proposal,
        reviewState: "proposed",
        validation: { status: "valid", errors: [] },
        preview: {
          summary: session.review.proposal.purpose,
          affectedNodeIds: session.review.proposal.affectedNodeIds,
        },
      },
    });

  it("makes the provider proposal primary and keeps the built-in one as an alternative", async () => {
    const ctx = setup([], {
      providerProposal: async (project): Promise<ProviderProposalResult> => {
        const session = providerSession(project);
        return {
          origin: "provider",
          session,
          response: providerResponse(session),
          locality: "local",
        };
      },
    });
    const view = (await ctx.port.proposeFor("first-step"))!;
    expect(view.origin).toBe("provider");
    expect(view.proposalId).toBe("ai-first-step");
    expect(view.alternatives?.map((a) => a.proposalId)).toEqual(["first-step", "first-step-small"]);
    expect(view.alternatives?.[0]?.tradeoff).toMatch(/Built-in/);
    expect(view.alternatives?.every((a) => a.evidence.outcome === "completed")).toBe(true);
    expect(ctx.active()?.review.proposal.id).toBe("ai-first-step");
    const builtIn = ctx.port.chooseAlternative("first-step")!;
    expect(builtIn.origin).toBe("built-in");
    expect(builtIn.alternatives?.[0]?.proposalId).toBe("ai-first-step");
    expect(ctx.applyActiveProposal).not.toHaveBeenCalled();
  });

  it("falls back to the built-in proposal and carries the notice", async () => {
    const ctx = setup([], {
      providerProposal: async () => ({
        origin: "built-in",
        reason: "not-allowed",
        notice: "AI help isn't available right now.",
      }),
    });
    const view = (await ctx.port.proposeFor("first-step"))!;
    expect(view.origin).toBe("built-in");
    expect(view.notice).toBe("AI help isn't available right now.");
    expect(view.proposalId).toBe("first-step");
  });

  it("ignores a provider proposal whose base program is no longer current", async () => {
    const ref: { ctx?: ReturnType<typeof setup> } = {};
    const ctx = setup([], {
      providerProposal: async (project): Promise<ProviderProposalResult> => {
        const session = providerSession(project);
        ref.ctx?.setProject([{ type: "move", steps: 5 }]);
        return {
          origin: "provider",
          session,
          response: providerResponse(session),
          locality: "local",
        };
      },
    });
    ref.ctx = ctx;
    const view = await ctx.port.proposeFor("first-step");
    // The program is no longer empty, so the first-step task no longer applies.
    expect(view).toBeUndefined();
    expect(ctx.active()).toBeUndefined();
  });

  it("never lets a provider proposal reuse a built-in id", async () => {
    const ctx = setup([], {
      providerProposal: async (project): Promise<ProviderProposalResult> => {
        const session = createProposalSession(
          project,
          createFirstStepProposal({
            id: "first-step",
            baseProgram: project.stored.program,
            purpose: "dup",
            rationale: "dup",
          })!,
        );
        return {
          origin: "provider",
          session,
          response: providerResponse(session),
          locality: "local",
        };
      },
    });
    const view = (await ctx.port.proposeFor("first-step"))!;
    expect(view.origin).toBe("built-in");
  });
});
