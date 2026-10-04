import { describe, expect, it } from "vitest";
import { createStarterWorkspace } from "@agorix/block-editor";
import { DEFAULT_AGREEMENTS, createWorkflow } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION as schema, parseHostMessage, parseUiMessage } from "./index.js";

const script = { kind: "script", scriptIndex: 0 } as const;

describe("studio-protocol", () => {
  it("round-trips well-formed ui messages", () => {
    const intent = {
      type: "moveBlock",
      from: { container: script, index: 0 },
      to: { container: script, index: 1 },
    };
    expect(parseUiMessage({ schema, type: "intent", intent })).toEqual({
      schema,
      type: "intent",
      intent,
    });
    expect(
      parseUiMessage({ schema, type: "agreementsChanged", agreements: DEFAULT_AGREEMENTS }),
    ).toEqual({
      schema,
      type: "agreementsChanged",
      agreements: DEFAULT_AGREEMENTS,
    });
    expect(
      parseUiMessage({ schema, type: "decideProposal", proposalId: "p:1", decision: "rejected" }),
    ).toBeDefined();
  });

  it("rejects junk, unknown types, accept-style intents and bad ids", () => {
    for (const junk of [
      null,
      7,
      {},
      { schema: "x", type: "ready" },
      { schema, type: "mutateProgram" },
      { schema, type: "intent", intent: { type: "acceptProposal", proposalId: "p" } },
      { schema, type: "intent", intent: { type: "reviewProposal", proposalId: "/etc/passwd" } },
      { schema, type: "decideProposal", proposalId: "p", decision: "applied" },
    ]) {
      expect(parseUiMessage(junk)).toBeUndefined();
    }
  });

  it("drops extra keys including __proto__", () => {
    const raw = JSON.parse(
      '{"schema":"agorix/studio-protocol/v1","type":"ready","__proto__":{"x":1},"extra":1}',
    );
    expect(parseUiMessage(raw)).toEqual({ schema, type: "ready" });
  });

  it("parses host messages strictly", () => {
    const state = createWorkflow("supervised");
    expect(parseHostMessage({ schema, type: "workflow", state })).toEqual({
      schema,
      type: "workflow",
      state,
    });
    expect(
      parseHostMessage({ schema, type: "workflow", state: { stage: "nope" } }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "programHash", hash: "has space" })).toBeUndefined();
  });

  it("validates workspace and error host messages", () => {
    const workspace = createStarterWorkspace();
    expect(
      parseHostMessage({ schema, type: "workspace", workspace, programHash: "abc123" }),
    ).toEqual({
      schema,
      type: "workspace",
      workspace,
      programHash: "abc123",
    });
    const bad = (w: unknown, h = "abc") =>
      parseHostMessage({ schema, type: "workspace", workspace: w, programHash: h });
    expect(
      bad({ scripts: [{ id: "s", trigger: { id: "t", type: "nope" }, statements: [] }] }),
    ).toBeUndefined();
    expect(
      bad({ scripts: Array.from({ length: 65 }, () => workspace.scripts[0]) }),
    ).toBeUndefined();
    expect(bad(workspace, "has space")).toBeUndefined();
    let nested: unknown = [];
    for (let i = 0; i < 20; i += 1) {
      nested = [{ id: `r${i}`, type: "control_repeat", inputs: { body: nested } }];
    }
    expect(
      bad({
        scripts: [{ id: "s", trigger: { id: "t", type: "event_on_start" }, statements: nested }],
      }),
    ).toBeUndefined();
    expect(
      bad({
        scripts: [
          {
            id: "s",
            trigger: { id: "t", type: "event_on_start" },
            statements: [{ id: "m", type: "motion_move", fields: { steps: {} } }],
          },
        ],
      }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "error", code: "INVALID_CHANGE" })).toBeDefined();
    expect(parseHostMessage({ schema, type: "error", code: "x" })).toBeUndefined();
  });
});
