import { describe, expect, it, vi } from "vitest";
import type { AgentEvent } from "@agorix/agent-workflow";
import {
  createStudioStarterProject,
  openStoredProject,
  type StudioProposalSession,
} from "../studioCore.js";
import { createAgentPort } from "./agentPort.js";

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

function setup(statements: unknown[]) {
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

  it("builds a proposal view and remembers it; repeat changes resolve to blocks", () => {
    const empty = setup([]);
    const first = empty.port.proposeFor("first-step");
    expect(first?.purpose).toBeTruthy();
    expect(empty.active()).toBeDefined();
    const repeat = setup(repeated).port.proposeFor("repeat-pattern");
    expect(repeat?.changes.some((change) => change.blockId !== undefined)).toBe(true);
  });

  it("refuses to apply a stale proposal and never calls the apply path", async () => {
    const ctx = setup([]);
    ctx.port.proposeFor("first-step");
    ctx.setProject([{ type: "move", steps: 5 }]);
    expect(await ctx.port.applyPending()).toBe("stale");
    expect(ctx.applyActiveProposal).not.toHaveBeenCalled();
  });

  it("applies a fresh proposal, hashes the program and caps events", async () => {
    const ctx = setup([]);
    ctx.port.proposeFor("first-step");
    expect(await ctx.port.applyPending()).toBe("applied");
    expect(ctx.applyActiveProposal).toHaveBeenCalledOnce();
    expect(ctx.port.programHash()).toMatch(/^[A-Za-z0-9:_-]{1,128}$/);
    for (let i = 0; i < 250; i += 1) {
      ctx.port.record({ type: "proposalRequested", taskId: "first-step", scaffoldLevel: 4 });
    }
    expect(ctx.events).toHaveLength(200);
  });
});

describe("agentPort advanced proposals", () => {
  it("offers a real alternative with measured evidence and lets the learner switch", () => {
    const ctx = setup([]);
    const first = ctx.port.proposeFor("first-step")!;
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

  it("anchors operations to the original blocks and offers a single repeat proposal", () => {
    const view = setup(repeated).port.proposeFor("repeat-pattern")!;
    expect(view.alternatives).toBeUndefined();
    expect(view.operations).toHaveLength(6);
    expect(view.operations?.every((op) => op.blockId !== undefined)).toBe(true);
    expect(view.operations?.filter((op) => op.kind === "remove")).toHaveLength(5);
  });

  it("previews a selection with evidence and reports empty, invalid and stale", () => {
    const ctx = setup([]);
    ctx.port.proposeFor("first-step");
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
    ctx.port.proposeFor("first-step");
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
    ctx.port.proposeFor("first-step");
    expect(await ctx.port.applySelection({ include: [] })).toBe("empty");
    expect(
      await ctx.port.applySelection({ include: [0], overrides: [{ index: 0, value: 100000 }] }),
    ).toBe("invalid");
    ctx.setProject([{ type: "move", steps: 5 }]);
    expect(await ctx.port.applySelection({ include: [0] })).toBe("stale");
    expect(ctx.commitProgram).not.toHaveBeenCalled();
  });
});
