import { describe, expect, it, vi } from "vitest";
import { applyWorkspaceChange, programToWorkspace } from "@agorix/block-editor";
import type { ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import { STUDIO_PROTOCOL_VERSION as schema } from "@agorix/studio-protocol";
import { DEFAULT_AGREEMENTS } from "@agorix/agent-workflow";
import { createWorkbenchHost, type HostPort } from "./workbenchHost.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const base = {
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
} as unknown as ProjectProgram;

function setup(initial: ProjectProgram | null = base) {
  let program: ProjectProgram | undefined = initial ?? undefined;
  const labels: string[] = [];
  const port: HostPort = {
    getProgram: () => program,
    commit: async (next, label) => {
      program = next;
      labels.push(label);
    },
    openProposalReview: vi.fn(async () => undefined),
    reveal: vi.fn(async () => undefined),
    askAgent: vi.fn(async () => undefined),
    updateAgreements: vi.fn(),
  };
  let n = 0;
  const host = createWorkbenchHost(port, () => `block:wb_${(n += 1)}`);
  return { host, port, labels, get: () => program };
}

describe("workbenchHost", () => {
  it("answers ready with the workspace and hash, or nothing without a project", async () => {
    const { host } = setup();
    expect(await host.handle({ schema, type: "ready" })).toEqual([
      {
        schema,
        type: "workspace",
        workspace: programToWorkspace(base).workspace,
        programHash: programSemanticHash(base),
      },
    ]);
    expect(await setup(null).host.handle({ schema, type: "ready" })).toEqual([]);
  });

  it("inserts through the canonical path and reports the new hash", async () => {
    const { host, labels, get } = setup();
    const out = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "motion_move",
        to: { container: script, index: 0 },
      },
    });
    expect(get()?.scripts[0]?.statements).toHaveLength(3);
    expect(labels[0]).toMatch(/^Workbench:/);
    expect(out[0]).toMatchObject({ type: "workspace", programHash: programSemanticHash(get()!) });
  });

  it("moves exactly like applying the same change through block-editor", async () => {
    const { host, get } = setup();
    const from = { container: script, index: 0 };
    const to = { container: script, index: 1 };
    await host.handle({ schema, type: "intent", intent: { type: "moveBlock", from, to } });
    const direct = applyWorkspaceChange(programToWorkspace(base).workspace, {
      type: "moveBlock",
      from,
      to,
    }).program;
    expect(programSemanticHash(get()!)).toBe(programSemanticHash(direct));
  });

  it("rejects invalid changes without committing", async () => {
    const { host, labels } = setup();
    const bad = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "insertBlock",
        blockType: "event_on_start",
        to: { container: script, index: 0 },
      },
    });
    const outOfRange = await host.handle({
      schema,
      type: "intent",
      intent: {
        type: "moveBlock",
        from: { container: script, index: 9 },
        to: { container: script, index: 0 },
      },
    });
    expect(bad).toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "NOT_A_STATEMENT" },
    ]);
    expect(outOfRange).toEqual([
      { schema, type: "error", code: "INVALID_CHANGE", reason: "BLOCK_NOT_FOUND" },
    ]);
    expect(labels).toHaveLength(0);
  });

  it("routes non-mutating intents and never commits on proposal decisions", async () => {
    const { host, port, labels } = setup();
    await host.handle({ schema, type: "intent", intent: { type: "revealNode", nodeId: "n" } });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "reviewProposal", proposalId: "p" },
    });
    expect(port.reveal).toHaveBeenCalledWith("n");
    expect(port.openProposalReview).toHaveBeenCalledWith("p");
    expect(
      await host.handle({
        schema,
        type: "intent",
        intent: { type: "askAgent", verb: "explain", about: { kind: "node", id: "n" } },
      }),
    ).toEqual([]);
    expect(port.askAgent).toHaveBeenCalledWith("explain", "n");
    expect(
      await host.handle({ schema, type: "decideProposal", proposalId: "p", decision: "accepted" }),
    ).toEqual([]);
    expect(
      await host.handle({
        schema,
        type: "intent",
        intent: { type: "highlightNodes", nodeIds: ["n"] },
      }),
    ).toEqual([]);
    expect(port.reveal).toHaveBeenCalledWith("n");
    expect(labels).toHaveLength(0);
  });

  it("resolves Workbench block ids to canonical node ids for agent and reveal sync", async () => {
    const { host, port } = setup();
    const { workspace } = programToWorkspace(base);
    const blockId = workspace.scripts[0]?.statements[0]?.id;
    expect(blockId).toBeDefined();

    await host.handle({
      schema,
      type: "intent",
      intent: { type: "revealNode", nodeId: blockId! },
    });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "highlightNodes", nodeIds: [blockId!] },
    });
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "askAgent", verb: "debug", about: { kind: "node", id: blockId! } },
    });

    expect(port.reveal).toHaveBeenCalledWith("scripts[0]/statements[0]");
    expect(port.askAgent).toHaveBeenCalledWith("debug", "scripts[0]/statements[0]");
  });

  it("stores Workbench agent agreements through the host port", async () => {
    const { host, port } = setup();
    const agreements = {
      ...DEFAULT_AGREEMENTS,
      aiEnabled: false,
      proactive: { ...DEFAULT_AGREEMENTS.proactive, stalled: false },
    };

    expect(await host.handle({ schema, type: "agreementsChanged", agreements })).toEqual([]);
    expect(port.updateAgreements).toHaveBeenCalledWith(agreements);
  });
});

describe("syncMessage", () => {
  it("maps canonical hub ids to block ids", () => {
    const { host } = setup();
    const { mapping } = programToWorkspace(base);
    const entry = mapping.find((m) => m.kind === "statement")!;
    expect(
      host.syncMessage({ selectedNodeId: entry.nodeId, failedNodeId: "does/not/exist" }),
    ).toEqual([{ schema, type: "sync", selectedBlockId: entry.blockId }]);
  });

  it("returns no sync message without a program", () => {
    const { host } = setup(null);
    expect(host.syncMessage({ selectedNodeId: "x" })).toEqual([]);
  });
});

describe("stale edits", () => {
  const insert = {
    type: "insertBlock",
    blockType: "motion_move",
    to: { container: script, index: 0 },
  } as const;

  it("refuses a mutating intent whose baseHash is stale and resends a snapshot", async () => {
    const { host, labels } = setup();
    const out = await host.handle({ schema, type: "intent", intent: insert, baseHash: "old-hash" });
    expect(out[0]).toEqual({ schema, type: "error", code: "STALE_EDIT" });
    expect(out[1]).toMatchObject({ type: "workspace" });
    expect(labels).toHaveLength(0);
  });

  it("commits when the baseHash matches the current program", async () => {
    const { host, labels } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: insert,
      baseHash: programSemanticHash(base),
    });
    expect(labels).toHaveLength(1);
  });

  it("still routes non-mutating intents with a stale baseHash", async () => {
    const { host, port } = setup();
    await host.handle({
      schema,
      type: "intent",
      intent: { type: "revealNode", nodeId: "scripts[0]/statements[0]" },
      baseHash: "old-hash",
    });
    expect(port.reveal).toHaveBeenCalled();
  });
});
