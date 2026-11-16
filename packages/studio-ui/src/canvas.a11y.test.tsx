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
import { SceneLibrary } from "./SceneLibrary.js";
import { StagePanel, Workbench } from "./Workbench.js";
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
  it("shows visual asset choices on costume blocks and posts an explicit selection", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "costume:change",
        type: "looks_switch_costume",
        fields: { costumeId: "asset:costume.default" },
      },
    }).workspace;
    const intents: Intent[] = [];
    act(() =>
      root.render(
        <Canvas
          workspace={workspace}
          assets={[
            { id: "asset:costume.default", name: "Nova", kind: "costume", tags: [] },
            { id: "asset:costume.spark", name: "Spark", kind: "costume", tags: [] },
          ]}
          onIntent={(intent) => intents.push(intent)}
        />,
      ),
    );
    expect(host.querySelector(".block-asset-field img")).not.toBeNull();
    const select = host.querySelector<HTMLSelectElement>(".block-asset-field select")!;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Nova",
      "Spark",
    ]);
    act(() => {
      select.value = "asset:costume.spark";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setTextField",
      location: { container: script, index: 0 },
      field: "costumeId",
      value: "asset:costume.spark",
    });
  });
  it("selects a declared variable and edits its numeric value", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "set:energy",
        type: "variables_set",
        fields: { variableId: "energy" },
        inputs: { value: { id: "num:energy", type: "literal_number", fields: { value: 0 } } },
      },
    }).workspace;
    const withVariables = {
      ...workspace,
      variables: [
        { id: "energy", name: "Energy", initialValue: 0, visible: true },
        { id: "score", name: "Score", initialValue: 0, visible: true },
      ],
    };
    const intents: Intent[] = [];
    render(withVariables, { onIntent: (intent) => intents.push(intent) });
    const select = host.querySelector<HTMLSelectElement>(
      '.block-field select[aria-label="Set variable to [N]: Variables"]',
    )!;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      "Energy",
      "Score",
    ]);
    act(() => {
      select.value = "score";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setTextField",
      location: { container: script, index: 0 },
      field: "variableId",
      value: "score",
    });
    const input = host.querySelector<HTMLInputElement>(
      '.block-field input[aria-label="Set variable to [N]: Value"]',
    )!;
    act(() => {
      input.value = "9";
      input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setExpressionNumber",
      location: { container: script, index: 0 },
      input: "value",
      value: 9,
    });
  });
  it("offers declared numeric reporters inside list value sockets", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "v", name: "Energy", initialValue: 0, visible: true }],
      lists: [{ id: "l", name: "Items", initialItems: [], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "listAdd", listId: "l", value: { type: "numericLiteral", value: 1 } },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const source = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="source"]',
    )!;
    expect(Array.from(source.options).map((option) => option.value)).toEqual([
      "number",
      "variable",
      "listLength",
      "listItem",
    ]);
    act(() => {
      source.value = "listLength";
      source.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setNumericInput",
      input: "value",
      reporter: "listLength",
      referenceId: "l",
    });
  });
  it("labels an existing arithmetic expression instead of presenting it as a number", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      lists: [{ id: "l", name: "Items", initialItems: [], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "listAdd",
              listId: "l",
              value: {
                type: "add",
                left: { type: "numericLiteral", value: 1 },
                right: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    }).workspace;
    render(workspace);
    const source = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="source"]',
    )!;
    expect(source.value).toBe("other");
    expect(source.selectedOptions[0]?.textContent).toContain("+");
  });
  it("edits numeric comparison operands directly and keeps invalid values out of intents", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:numbers",
        type: "control_if",
        inputs: {
          then: [],
          condition: {
            id: "cmp",
            type: "operator_less_than",
            inputs: {
              left: { id: "left", type: "literal_number", fields: { value: 0 } },
              right: { id: "right", type: "literal_number", fields: { value: 10 } },
            },
          },
        },
      },
    }).workspace;
    const intents: Intent[] = [];
    act(() =>
      root.render(<Canvas workspace={workspace} onIntent={(intent) => intents.push(intent)} />),
    );
    const left = host.querySelector<HTMLInputElement>(
      '.comparison-fields input[aria-label="Condition: Left value"]',
    )!;
    expect(left.value).toBe("0");
    act(() => {
      left.value = "7";
      left.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setConditionNumber",
      location: { container: script, index: 0 },
      side: "left",
      value: 7,
    });
    expect(left.value).toBe("0");
    act(() => {
      left.value = "";
      left.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toHaveLength(1);
  });
  it("replaces an if condition from a selected reporter and from a palette drop", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:socket",
        type: "control_if",
        inputs: { condition: { id: "goal:socket", type: "sensing_touching_goal" }, then: [] },
      },
    }).workspace;
    const intents: Intent[] = [];
    act(() =>
      root.render(
        <Canvas
          workspace={workspace}
          selectedExpression="literal_boolean"
          onIntent={(intent) => intents.push(intent)}
        />,
      ),
    );
    const socket = host.querySelector<HTMLButtonElement>(".expression-socket")!;
    expect(socket.textContent).toContain("Touching the goal?");
    act(() => socket.click());
    expect(intents[0]).toMatchObject({
      type: "replaceCondition",
      blockType: "literal_boolean",
      location: { index: 0 },
    });
    const dataTransfer = {
      getData: (kind: string) =>
        kind === "application/x-agorix-drag"
          ? JSON.stringify({ kind: "palette", blockType: "sensing_touching_stage_edge" })
          : "",
    };
    const drop = new dom.window.MouseEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    act(() => socket.dispatchEvent(drop));
    expect(intents[1]).toMatchObject({
      type: "replaceCondition",
      blockType: "sensing_touching_stage_edge",
    });
  });
  it("shows editable Boolean and actor targets inside conditions", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "if", condition: { type: "booleanLiteral", value: true }, then: [] },
            { type: "if", condition: { type: "touchingActor", actorId: "actor:main" }, then: [] },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    const actors = [
      {
        id: "actor:main",
        name: "Main",
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        scriptCount: 1,
        scriptIds: ["main"],
      },
      {
        id: "actor:robot",
        name: "Robot",
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        scriptCount: 0,
        scriptIds: [],
      },
    ];
    act(() =>
      root.render(
        <Canvas
          workspace={workspace}
          actors={actors}
          onIntent={(intent) => intents.push(intent)}
        />,
      ),
    );
    const boolean = host.querySelector<HTMLSelectElement>(
      '.condition-detail select[aria-label="Condition: Boolean value"]',
    )!;
    act(() => {
      boolean.value = "false";
      boolean.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setConditionBoolean",
      value: false,
      location: { index: 0 },
    });
    const actor = host.querySelector<HTMLSelectElement>(
      '.condition-detail select[aria-label="Condition: Target actor"]',
    )!;
    act(() => {
      actor.value = "actor:robot";
      actor.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setConditionActor",
      actorId: "actor:robot",
      location: { index: 1 },
    });
  });
  it("selects and places a stage actor through an explicit drag", () => {
    const selected: string[] = [];
    const placed: { actorId: string; x: number; y: number }[] = [];
    act(() =>
      root.render(
        <StagePanel
          copy={copyFor("en")}
          selectedActorId={undefined}
          onSelectActor={(actorId) => selected.push(actorId)}
          onPlaceActor={(actorId, position) => placed.push({ actorId, ...position })}
          frame={{
            state: {
              sprite: { x: 10, y: 10, heading: 0, radius: 10 },
              goal: { x: 200, y: 100, radius: 12 },
              viewport: { width: 240, height: 180 },
              actors: [
                {
                  id: "actor:nova",
                  name: "Nova",
                  x: 10,
                  y: 10,
                  direction: 0,
                  size: 100,
                  visible: true,
                },
              ],
            },
            frameIndex: 0,
            frameCount: 1,
            step: 0,
            running: false,
            reachedGoal: false,
          }}
        />,
      ),
    );
    const actor = host.querySelector<HTMLButtonElement>(".stage-sprite")!;
    const viewport = host.querySelector<HTMLElement>(".stage-viewport")!;
    act(() => actor.click());
    expect(selected).toEqual(["actor:nova"]);
    const transfer = new Map<string, string>();
    const dataTransfer = {
      setData: (key: string, value: string) => transfer.set(key, value),
      getData: (key: string) => transfer.get(key) ?? "",
      effectAllowed: "none",
    };
    const start = new dom.window.Event("dragstart", { bubbles: true, cancelable: true });
    Object.defineProperty(start, "dataTransfer", { value: dataTransfer });
    act(() => actor.dispatchEvent(start));
    expect(transfer.get("application/x-agorix-stage-actor")).toBe("actor:nova");
    viewport.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 480,
      height: 360,
      right: 480,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const drop = new dom.window.MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientX: 240,
      clientY: 180,
    });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    act(() => viewport.dispatchEvent(drop));
    expect(placed).toEqual([{ actorId: "actor:nova", x: 120, y: 90 }]);
    transfer.set("application/x-agorix-stage-actor", "actor:unknown");
    act(() => viewport.dispatchEvent(drop));
    expect(placed).toHaveLength(1);
  });
  it("selects a costume and backdrop explicitly from the scene library", () => {
    const costumes: string[] = [];
    const backdrops: string[] = [];
    act(() =>
      root.render(
        <SceneLibrary
          copy={copyFor("en")}
          actors={[
            {
              id: "actor:nova",
              name: "Nova",
              x: 0,
              y: 0,
              direction: 0,
              size: 100,
              visible: true,
              costumeId: "costume:nova",
            },
          ]}
          assets={[
            {
              id: "costume:nova",
              name: "Nova",
              kind: "costume",
              tags: [],
              source: "builtin:kids-gallery-costume:nova",
            },
            {
              id: "costume:mika",
              name: "Mika",
              kind: "costume",
              tags: [],
              source: "builtin:kids-gallery-costume:mika",
            },
            {
              id: "backdrop:moon",
              name: "Moon",
              kind: "backdrop",
              tags: [],
              source: "builtin:kids-gallery-backdrop:moon",
            },
          ]}
          selectedActorId="actor:nova"
          backdropId="backdrop:moon"
          onSelectActor={() => undefined}
          onCostume={(actorId, id) => costumes.push(`${actorId}:${id}`)}
          onBackdrop={(id) => backdrops.push(id)}
        />,
      ),
    );
    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Choose costume: Mika"]')?.click(),
    );
    act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Choose backdrop: Moon"]')?.click(),
    );
    expect(costumes).toEqual(["actor:nova:costume:mika"]);
    expect(backdrops).toEqual(["backdrop:moon"]);
  });
  it("lets the learner edit a numeric block value in place", () => {
    const intents: Intent[] = [];
    render(initial, { onIntent: (intent) => intents.push(intent) });
    const input = host.querySelector<HTMLInputElement>(
      '.block-field input[aria-label="Move [N] steps: steps"]',
    );
    expect(input).not.toBeNull();
    expect(input?.value).toBe("3");
    act(() => {
      input!.value = "8";
      input!.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setNumericField",
      location: { container: script, index: 0 },
      field: "steps",
      value: 8,
    });
    expect(input?.value).toBe("3");
    act(() => {
      input!.value = "";
      input!.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(input?.value).toBe("3");
    expect(intents).toHaveLength(1);
  });

  it("lets the learner edit visible text on a visual block", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: { id: "say:1", type: "looks_say", fields: { text: "Hello" } },
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const input = host.querySelector<HTMLInputElement>('.block-field input[type="text"]');
    expect(input?.value).toBe("Hello");
    act(() => {
      input!.value = "Hola";
      input!.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toContainEqual({
      type: "setTextField",
      location: { container: script, index: 0 },
      field: "text",
      value: "Hola",
    });
    expect(input?.value).toBe("Hello");
  });

  it("asks Ori about the chosen block with one explicit action", () => {
    const intents: Intent[] = [];
    render(initial, { onIntent: (intent) => intents.push(intent) });
    const button = host.querySelector<HTMLButtonElement>(".block .block-ori");
    expect(button?.getAttribute("aria-label")).toContain("Ask Ori");
    act(() => button?.click());
    expect(intents).toContainEqual({
      type: "askAgent",
      verb: "explain",
      about: { kind: "node", id: initial.scripts[0]?.statements[0]?.id },
    });
  });
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
    expect(tabbableButtons).toHaveLength(4);
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
  it("routes palette edits to the selected actor's canonical script", () => {
    let listener: ((message: HostMessage) => void) | undefined;
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => void posted.push(message),
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
    };
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        { id: "main", trigger: { type: "onStart" }, statements: [] },
        { id: "helper", trigger: { type: "greenFlag" }, statements: [] },
      ],
    }).workspace;
    act(() => root.render(<Workbench bridge={bridge} />));
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "actors",
        selectedActorId: "actor:helper",
        actors: [
          {
            id: "actor:main",
            name: "Main",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["main"],
          },
          {
            id: "actor:helper",
            name: "Helper",
            x: 30,
            y: 30,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["helper"],
          },
        ],
      }),
    );
    expect(host.querySelectorAll(".script-title")).toHaveLength(1);
    const move = Array.from(host.querySelectorAll<HTMLButtonElement>(".palette button")).find(
      (button) => button.textContent?.includes("Move"),
    )!;
    act(() => move.click());
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "insertBlock", to: { container: { kind: "script", scriptIndex: 1 } } },
    });
    act(() =>
      host.querySelector<HTMLButtonElement>('.library-tabs button[aria-pressed="false"]')?.click(),
    );
    const actorName = host.querySelector<HTMLInputElement>(".scene-create-actor input")!;
    actorName.value = "Robot";
    act(() =>
      host
        .querySelector<HTMLFormElement>(".scene-create-actor")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({ type: "createActor", name: "Robot" });
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "actors",
        selectedActorId: "actor:robot",
        actors: [
          {
            id: "actor:main",
            name: "Main",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["main"],
          },
          {
            id: "actor:helper",
            name: "Helper",
            x: 30,
            y: 30,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["helper"],
          },
          {
            id: "actor:robot",
            name: "Robot",
            x: 40,
            y: 40,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["robot"],
          },
        ],
      }),
    );
    expect(
      host
        .querySelector<HTMLButtonElement>('.scene-actors button[title="Robot"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    act(() =>
      host
        .querySelector<HTMLFormElement>(".scene-create-script")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({
      type: "createScript",
      actorId: "actor:robot",
      trigger: "greenFlag",
      baseHash: "fnv1a32:12345678",
    });
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        programHash: "fnv1a32:23456789",
        workspace: programToWorkspace({
          schema: "agorix/program/v1",
          scripts: [
            { id: "main", trigger: { type: "onStart" }, statements: [] },
            { id: "helper", trigger: { type: "greenFlag" }, statements: [] },
            { id: "receiver", trigger: { type: "onMessage", message: "go" }, statements: [] },
          ],
        }).workspace,
      }),
    );
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "actors",
        selectedActorId: "actor:robot",
        actors: [
          {
            id: "actor:robot",
            name: "Robot",
            x: 0,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            scriptCount: 1,
            scriptIds: ["receiver"],
          },
        ],
      }),
    );
    expect(host.querySelector(".script-title")?.textContent).toContain("go");
    act(() =>
      host.querySelector<HTMLButtonElement>('.library-tabs button[aria-pressed="false"]')?.click(),
    );
    act(() =>
      Array.from(host.querySelectorAll<HTMLButtonElement>(".palette button"))
        .find((button) => button.textContent?.includes("Move"))
        ?.click(),
    );
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "insertBlock", to: { container: { kind: "script", scriptIndex: 2 } } },
    });
  });
  it("offers variable creation from the visible Blocks library", () => {
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => void posted.push(message),
      subscribe: () => () => undefined,
    };
    act(() => root.render(<Workbench bridge={bridge} />));
    const input = host.querySelector<HTMLInputElement>(".variable-creator input")!;
    input.value = "energy";
    act(() =>
      host
        .querySelector<HTMLFormElement>(".variable-creator")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted).toContainEqual({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "intent",
      intent: { type: "addVariable", name: "energy" },
    });
  });
  it("creates lists and exposes list operations only after declaration", () => {
    let listener: ((message: HostMessage) => void) | undefined;
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => void posted.push(message),
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
    };
    act(() => root.render(<Workbench bridge={bridge} />));
    expect(host.querySelector('.palette button[aria-label="add item to list"]')).toBeNull();
    const input = host.querySelector<HTMLInputElement>(".list-creator input")!;
    input.value = "items";
    act(() =>
      host
        .querySelector<HTMLFormElement>(".list-creator")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "addList", name: "items" },
    });
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      lists: [{ id: "list:items", name: "items", initialItems: [], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "greenFlag" },
          statements: [
            { type: "listAdd", listId: "list:items", value: { type: "numericLiteral", value: 3 } },
          ],
        },
      ],
    }).workspace;
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    expect(
      host.querySelector<HTMLSelectElement>('.block-field select[aria-label*="Lists"]')?.value,
    ).toBe("list:items");
    expect(host.querySelector('.palette button[aria-label="add item to list"]')).not.toBeNull();
  });
  it("shows the toolbox and accepts a palette drag on an empty script", () => {
    let listener: ((message: HostMessage) => void) | undefined;
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => void posted.push(message),
      subscribe: (next) => {
        listener = next;
        return () => undefined;
      },
    };
    const empty = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    }).workspace;
    act(() => root.render(<Workbench bridge={bridge} locale="es" />));
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace: empty,
        programHash: "sha:empty",
      }),
    );
    const tool = Array.from(host.querySelectorAll<HTMLButtonElement>(".palette button")).find(
      (button) => button.textContent?.includes("Mover"),
    );
    const slot = host.querySelector<HTMLElement>(".slot.is-empty");
    expect(tool?.draggable).toBe(true);
    expect(slot?.textContent).toContain("Soltá un bloque acá");
    const values = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? "",
      effectAllowed: "none",
    };
    const dispatchDrag = (target: Element, type: string) => {
      const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      act(() => target.dispatchEvent(event));
    };
    const beforeInvalidDrop = posted.length;
    dispatchDrag(slot!, "drop");
    expect(posted).toHaveLength(beforeInvalidDrop);
    dispatchDrag(tool!, "dragstart");
    expect(host.querySelector(".workbench")?.getAttribute("data-dragging")).toBe("true");
    dispatchDrag(slot!, "dragover");
    expect(slot?.classList.contains("drag-over")).toBe(true);
    dispatchDrag(slot!, "drop");
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "insertBlock", blockType: "motion_move" },
    });
    expect(host.querySelector(".workbench")?.getAttribute("data-dragging")).toBe("false");
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace: initial,
        programHash: "sha:filled",
      }),
    );
    const block = host.querySelector<HTMLElement>(".block[data-pos]");
    const explain = Array.from(host.querySelectorAll<HTMLElement>(".zone")).find(
      (zone) => zone.textContent === "Explicar",
    );
    dispatchDrag(block!, "dragstart");
    dispatchDrag(explain!, "drop");
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "askAgent", verb: "explain" },
    });
  });

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
