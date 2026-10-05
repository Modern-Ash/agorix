import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceChange,
  programToWorkspace,
  type BlockWorkspaceSnapshot,
} from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import { Canvas, type FocusRequest } from "./Canvas.js";
import { Workbench } from "./Workbench.js";
import type { HostBridge } from "./bridge.js";
import { STUDIO_PROTOCOL_VERSION, type HostMessage } from "@agorix/studio-protocol";
import { locationKey } from "./blockView.js";
import { copyFor } from "./i18n.js";

// A DOM is installed by hand so the test does not depend on which jsdom Vitest would pick.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
for (const name of Object.getOwnPropertyNames(dom.window)) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => (dom.window as unknown as Record<string, unknown>)[name],
    });
  }
}
Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const program = {
  schema: "agorix/program/v1",
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 3 },
        { type: "repeat", count: 2, body: [{ type: "turn", degrees: 90 }] },
        { type: "move", steps: 5 },
      ],
    },
  ],
} as const;
const initial = programToWorkspace(program as never).workspace;
const script = { kind: "script", scriptIndex: 0 } as const;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(
  workspace: BlockWorkspaceSnapshot,
  props: {
    onIntent?: (intent: Intent) => void;
    onAnnounce?: (text: string) => void;
    focusRequest?: FocusRequest;
    locale?: "en" | "es";
  } = {},
) {
  act(() =>
    root.render(
      <Canvas
        workspace={workspace}
        onIntent={props.onIntent ?? (() => undefined)}
        onAnnounce={props.onAnnounce}
        focusRequest={props.focusRequest}
        copy={copyFor(props.locale ?? "en")}
      />,
    ),
  );
}

const blocks = () => Array.from(host.querySelectorAll<HTMLElement>("[data-pos]"));
const key = (target: HTMLElement, init: KeyboardEventInit) =>
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
    );
  });

describe("canvas keyboard and screen reader behaviour", () => {
  it("has one tab stop and gives every block a name with position and level", () => {
    render(initial);
    const all = blocks();
    expect(all).toHaveLength(4);
    expect(all.filter((element) => element.tabIndex === 0)).toHaveLength(1);
    expect(all[0]?.tabIndex).toBe(0);
    expect(all[0]?.getAttribute("aria-label")).toBe("Move [N] steps, 1 of 3, level 1");
    expect(all[2]?.getAttribute("aria-label")).toBe("Turn [N] degrees, 1 of 1, level 2");
    const buttons = host.querySelectorAll<HTMLButtonElement>(".block button");
    const tabbableButtons = Array.from(buttons).filter((button) => button.tabIndex === 0);
    expect(tabbableButtons).toHaveLength(3);
    expect(host.querySelector("section")?.getAttribute("aria-describedby")).toBe(
      "canvas-keyboard-help",
    );
    expect(host.querySelector("#canvas-keyboard-help")?.textContent).toContain("Arrow keys");
  });

  it("moves focus with arrows, Home and End and keeps the active block as the tab stop", () => {
    render(initial);
    const all = blocks();
    act(() => all[0]?.focus());
    key(all[0] as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(all[1]);
    expect(all[1]?.tabIndex).toBe(0);
    expect(all[0]?.tabIndex).toBe(-1);
    key(all[1] as HTMLElement, { key: "End" });
    expect(document.activeElement).toBe(all[3]);
    key(all[3] as HTMLElement, { key: "ArrowUp" });
    expect(document.activeElement).toBe(all[2]);
    key(all[2] as HTMLElement, { key: "Home" });
    expect(document.activeElement).toBe(all[0]);
  });

  it("reveals the block in the code with Enter or Space, but not from inside a control", () => {
    const onIntent = vi.fn();
    render(initial, { onIntent });
    const first = blocks()[0] as HTMLElement;
    act(() => first.focus());
    key(first, { key: "Enter" });
    key(first, { key: " " });
    expect(onIntent).toHaveBeenCalledTimes(2);
    expect(onIntent).toHaveBeenCalledWith({ type: "revealNode", nodeId: expect.any(String) });
    const button = first.querySelector("button") as HTMLElement;
    key(button, { key: "Enter" });
    expect(onIntent).toHaveBeenCalledTimes(2);
  });

  it("announces a move and lets focus follow the block to its new position", () => {
    const onAnnounce = vi.fn();
    let current = initial;
    const onIntent = vi.fn((intent: Intent) => {
      if (intent.type === "moveBlock") {
        current = applyWorkspaceChange(current, {
          type: "moveBlock",
          from: intent.from,
          to: intent.to,
        }).workspace;
      }
    });
    render(current, { onIntent, onAnnounce });
    const first = blocks()[0] as HTMLElement;
    act(() => first.focus());
    key(first, { key: "ArrowDown", altKey: true });
    expect(onAnnounce).toHaveBeenCalledWith("Moved Move [N] steps to position 2 of 3");
    render(current, { onIntent, onAnnounce });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
      locationKey({ container: script, index: 1 }),
    );
  });

  it("explains an impossible move instead of failing silently", () => {
    const onAnnounce = vi.fn();
    render(initial, { onAnnounce });
    const first = blocks()[0] as HTMLElement;
    act(() => first.focus());
    key(first, { key: "ArrowUp", altKey: true });
    expect(onAnnounce).toHaveBeenCalledWith("Already the first block here");
  });

  it("announces a delete and moves focus to the next block, then the previous, then the canvas", () => {
    const onAnnounce = vi.fn();
    let current = initial;
    const onIntent = (intent: Intent) => {
      if (intent.type === "deleteBlock") {
        current = applyWorkspaceChange(current, {
          type: "deleteBlock",
          location: intent.location,
        }).workspace;
      }
    };
    render(current, { onIntent, onAnnounce });
    const first = blocks()[0] as HTMLElement;
    act(() => first.focus());
    key(first, { key: "Delete" });
    expect(onAnnounce).toHaveBeenCalledWith("Deleted Move [N] steps");
    render(current, { onIntent, onAnnounce });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
      locationKey({ container: script, index: 0 }),
    );
    // the last block of the list falls back to the previous one
    const last = blocks().find(
      (el) => el.dataset["pos"] === locationKey({ container: script, index: 1 }),
    ) as HTMLElement;
    act(() => last.focus());
    key(last, { key: "Delete" });
    render(current, { onIntent, onAnnounce });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
      locationKey({ container: script, index: 0 }),
    );
    // deleting the only block hands focus to the canvas itself
    const only = blocks().find(
      (el) => el.dataset["pos"] === locationKey({ container: script, index: 0 }),
    ) as HTMLElement;
    act(() => only.focus());
    key(only, { key: "Delete" });
    render(current, { onIntent, onAnnounce });
    expect(document.activeElement).toBe(host.querySelector("section"));
  });

  it("focuses a block requested by the host once it exists, and only once per request", () => {
    render(initial);
    const request = { pos: locationKey({ container: script, index: 2 }), nonce: 1 };
    render(initial, { focusRequest: request });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(request.pos);
    act(() => blocks()[0]?.focus());
    render(initial, { focusRequest: request });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
      locationKey({ container: script, index: 0 }),
    );
  });

  it("speaks Spanish for names, help and announcements", () => {
    const onAnnounce = vi.fn();
    render(initial, { locale: "es", onAnnounce });
    expect(blocks()[0]?.getAttribute("aria-label")).toBe("Mover [N] pasos, 1 de 3, nivel 1");
    expect(host.querySelector("#canvas-keyboard-help")?.textContent).toContain("Las flechas");
    const first = blocks()[0] as HTMLElement;
    act(() => first.focus());
    key(first, { key: "ArrowUp", altKey: true });
    expect(onAnnounce).toHaveBeenCalledWith("Ya es el primer bloque de este lugar");
  });

  it("passes the axe checks that do not need layout (roles, names, ARIA, focusable controls)", async () => {
    render(initial);
    const result = await axe.run(host, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});

describe("workbench live region and focus after inserting from the palette", () => {
  it("keeps the announcement over the generic update and focuses the new block", () => {
    let listener: ((message: HostMessage) => void) | undefined;
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => void posted.push(message),
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
    };
    const deliver = (workspace: BlockWorkspaceSnapshot) =>
      act(() =>
        listener?.({
          schema: STUDIO_PROTOCOL_VERSION,
          type: "workspace",
          workspace,
          programHash: "sha:test",
        }),
      );
    act(() => root.render(<Workbench bridge={bridge} />));
    deliver(initial);
    const status = () => host.querySelector(".status")?.textContent;
    expect(status()).toBe("Updated");

    const addMove = Array.from(host.querySelectorAll<HTMLButtonElement>(".palette button")).find(
      (button) => !button.disabled && button.textContent?.startsWith("Move"),
    ) as HTMLButtonElement;
    act(() => addMove.click());
    expect(status()).toBe("Added Move [N] steps");
    expect(posted.at(-1)).toMatchObject({ type: "intent", intent: { type: "insertBlock" } });

    const next = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 3,
      block: { id: "block:new", type: "motion_move", fields: { steps: 10 } },
    }).workspace;
    deliver(next);
    expect(status()).toBe("Added Move [N] steps");
    expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
      locationKey({ container: script, index: 3 }),
    );
    // A later, unrelated update goes back to the generic text.
    deliver(next);
    expect(status()).toBe("Updated");
  });

  it("lets a refusal replace a pending announcement", () => {
    let listener: ((message: HostMessage) => void) | undefined;
    const bridge: HostBridge = {
      post: () => undefined,
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
    };
    act(() => root.render(<Workbench bridge={bridge} />));
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace: initial,
        programHash: "sha:test",
      }),
    );
    const first = host.querySelector<HTMLElement>("[data-pos]") as HTMLElement;
    act(() => first.focus());
    key(first, { key: "ArrowDown", altKey: true });
    expect(host.querySelector(".status")?.textContent).toBe(
      "Moved Move [N] steps to position 2 of 3",
    );
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "error",
        code: "INVALID_CHANGE",
        reason: "BAD_INDEX",
      }),
    );
    expect(host.querySelector(".status")?.textContent).toMatch(/Nothing changed/);
  });
});
