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
  const port = createAgentPort({
    getProject: () => project,
    getActiveProposal: () => active,
    setActiveProposal: (next) => {
      active = next;
    },
    applyActiveProposal,
    rejectActiveProposal: () => {
      active = undefined;
    },
    runAndGetResult: () => undefined,
    events,
  });
  return {
    port,
    applyActiveProposal,
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
