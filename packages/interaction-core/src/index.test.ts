import { describe, expect, it } from "vitest";
import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  createStarterWorkspace,
} from "@agorix/block-editor";
import {
  createAnchorRef,
  intentToChange,
  keyboardIntent,
  parseAnchorRef,
  resolveDrop,
} from "./index.js";
import type { DropTarget } from "./index.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const slot = (index: number): DropTarget => ({ kind: "slot", to: { container: script, index } });
let n = 0;
const newId = () => `block:t_${(n += 1)}`;

describe("interaction-core", () => {
  it("validates anchors", () => {
    expect(createAnchorRef("node", "node:a")).toEqual({ kind: "node", id: "node:a" });
    expect(() => createAnchorRef("node", "/etc/passwd")).toThrow(RangeError);
    expect(parseAnchorRef({ kind: "nope", id: "a" })).toBeUndefined();
  });

  it("never turns a proposal drop into anything but review", () => {
    const source = { kind: "proposal", proposalId: "prop:1" } as const;
    for (const target of [
      slot(0),
      { kind: "node", nodeId: "n" },
      { kind: "canvas" },
    ] as DropTarget[]) {
      expect(resolveDrop(source, target)).toEqual({ type: "reviewProposal", proposalId: "prop:1" });
    }
    expect(resolveDrop(source, { kind: "agent", verb: "explain" })).toBeUndefined();
  });

  it("returns undefined for invalid pairs and bad ids", () => {
    expect(
      resolveDrop({ kind: "palette", blockType: "motion_move" }, { kind: "canvas" }),
    ).toBeUndefined();
    expect(
      resolveDrop(
        { kind: "block", nodeId: "/x", location: { container: script, index: 0 } },
        { kind: "agent", verb: "debug" },
      ),
    ).toBeUndefined();
  });

  it("keyboard and drag resolve to the same change and respect list edges", () => {
    const location = { container: script, index: 1 };
    const key = keyboardIntent("Alt+ArrowDown", { location, siblingCount: 3 });
    const drag = resolveDrop({ kind: "block", nodeId: "n", location }, slot(2));
    expect(key).toEqual(drag);
    expect(
      keyboardIntent("Alt+ArrowUp", { location: { container: script, index: 0 }, siblingCount: 3 }),
    ).toBeUndefined();
    expect(
      keyboardIntent("Alt+ArrowDown", {
        location: { container: script, index: 2 },
        siblingCount: 3,
      }),
    ).toBeUndefined();
  });

  it("applies inserts canonically and surfaces block-editor errors for non-statements", () => {
    const ok = intentToChange(
      { type: "insertBlock", blockType: "motion_move", to: { container: script, index: 0 } },
      newId,
    );
    const bad = intentToChange(
      { type: "insertBlock", blockType: "event_on_start", to: { container: script, index: 0 } },
      newId,
    );
    expect(
      applyWorkspaceChange(createStarterWorkspace(), ok!).program.scripts[0]?.statements,
    ).toHaveLength(1);
    expect(() => applyWorkspaceChange(createStarterWorkspace(), bad!)).toThrow(
      BlockEditorAdapterError,
    );
    expect(intentToChange({ type: "revealNode", nodeId: "n" }, newId)).toBeUndefined();
  });
});
