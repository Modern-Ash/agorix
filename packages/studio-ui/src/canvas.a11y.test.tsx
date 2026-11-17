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
import { STAGE_BACKDROP_DRAG_TYPE, STAGE_COSTUME_DRAG_TYPE } from "./SceneLibrary.js";
import { StagePanel, Workbench } from "./Workbench.js";
import type { HostBridge } from "./bridge.js";
import { STUDIO_PROTOCOL_VERSION, type ActorView, type HostMessage } from "@agorix/studio-protocol";
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

it("returns from an Ori pointer to its canonical block", () => {
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
  const target = host.querySelectorAll<HTMLElement>("[data-pos]")[0];
  expect(target).toBeDefined();
  const blockId = initial.scripts[0]?.statements[0]?.id;
  expect(blockId).toBeDefined();
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "help",
      kind: "pointer",
      ceiling: 3,
      taskId: "first-step",
      blockIds: [blockId!],
    }),
  );
  const returnButton = Array.from(host.querySelectorAll<HTMLButtonElement>(".help button")).find(
    (button) => button.textContent?.includes("Look here 1"),
  );
  expect(returnButton).toBeDefined();
  act(() => returnButton?.click());
  expect(document.activeElement).toBe(target);
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "help",
      kind: "pointer",
      ceiling: 3,
      taskId: "first-step",
      blockIds: ["missing:block"],
    }),
  );
  expect(host.querySelector(".help button")).toBeNull();
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "help",
      kind: "pointer",
      ceiling: 3,
      taskId: "first-step",
      blockIds: [blockId!],
    }),
  );
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "workspace",
      workspace: initial,
      programHash: "sha:new",
    }),
  );
  expect(host.querySelector(".help button")).toBeNull();
});

it("switches actor before focusing an Ori hint in another script", () => {
  let listener: ((message: HostMessage) => void) | undefined;
  const bridge: HostBridge = {
    post: () => undefined,
    subscribe: (next) => {
      listener = next;
      return () => undefined;
    },
  };
  const workspace = programToWorkspace({
    schema: "agorix/program/v1",
    scripts: [
      { id: "first", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
      { id: "second", trigger: { type: "onStart" }, statements: [{ type: "turn", degrees: 30 }] },
    ],
  }).workspace;
  act(() => root.render(<Workbench bridge={bridge} />));
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "workspace",
      workspace,
      programHash: "sha:test",
    }),
  );
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "actors",
      selectedActorId: "actor:second",
      actors: [
        {
          id: "actor:first",
          name: "First",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scriptCount: 1,
          scriptIds: ["first"],
        },
        {
          id: "actor:second",
          name: "Second",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scriptCount: 1,
          scriptIds: ["second"],
        },
      ],
    }),
  );
  expect(host.querySelectorAll(".script-title")).toHaveLength(1);
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "help",
      kind: "pointer",
      ceiling: 3,
      taskId: "first-step",
      blockIds: [workspace.scripts[0]!.statements[0]!.id],
    }),
  );
  act(() => host.querySelector<HTMLButtonElement>(".help button")?.click());
  expect((document.activeElement as HTMLElement).dataset["pos"]).toBe(
    locationKey({ container: { kind: "script", scriptIndex: 0 }, index: 0 }),
  );
});

it("keeps the selected actor controls beside the visual scene", () => {
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
  act(() =>
    listener?.({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "actors",
      selectedActorId: "actor:first",
      actors: [
        {
          id: "actor:first",
          name: "First",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scriptCount: 1,
        },
        {
          id: "actor:second",
          name: "Second",
          x: 10,
          y: 20,
          direction: 90,
          size: 80,
          visible: true,
          scriptCount: 1,
        },
      ],
    }),
  );
  act(() => host.querySelectorAll<HTMLButtonElement>(".studio-editor-tabs button")[1]?.click());
  const scene = host.querySelector<HTMLElement>(".studio-scene-editor")!;
  expect(scene.querySelector(".actor-inspector header strong")?.textContent).toBe("First");
  expect(host.querySelector(".studio-details .actor-inspector")).toBeNull();
  act(() => scene.querySelectorAll<HTMLButtonElement>(".scene-actors button")[1]?.click());
  expect(scene.querySelector(".actor-inspector header strong")?.textContent).toBe("Second");
  act(() => scene.querySelector<HTMLInputElement>(".actor-visible input")?.click());
  expect(posted.at(-1)).toMatchObject({
    type: "updateActor",
    actorId: "actor:second",
    patch: { visible: false },
  });
  act(() => listener?.({ schema: STUDIO_PROTOCOL_VERSION, type: "actors", actors: [] }));
  expect(scene.querySelector(".actor-inspector")).toBeNull();
});

it("requires a second explicit action before removing an actor and its scripts", () => {
  const onDeleteActor = vi.fn();
  const actors = [
    {
      id: "actor:first",
      name: "First",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scriptIds: ["main"],
    },
    {
      id: "actor:second",
      name: "Second",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scriptIds: ["helper"],
    },
  ];
  act(() =>
    root.render(
      <SceneLibrary
        copy={copyFor("en")}
        actors={actors}
        assets={[]}
        selectedActorId="actor:second"
        backdropId={undefined}
        onSelectActor={() => undefined}
        onCostume={() => undefined}
        onBackdrop={() => undefined}
        onDeleteActor={onDeleteActor}
      />,
    ),
  );
  const button = host.querySelector<HTMLButtonElement>(".scene-delete-actor")!;
  act(() => button.click());
  expect(onDeleteActor).not.toHaveBeenCalled();
  expect(button.textContent).toContain("Second and 1 script");
  act(() => button.click());
  expect(onDeleteActor).toHaveBeenCalledWith("actor:second", ["helper"]);
  act(() =>
    root.render(
      <SceneLibrary
        copy={copyFor("en")}
        actors={[actors[0]!]}
        assets={[]}
        selectedActorId="actor:first"
        backdropId={undefined}
        onSelectActor={() => undefined}
        onCostume={() => undefined}
        onBackdrop={() => undefined}
        onDeleteActor={onDeleteActor}
      />,
    ),
  );
  expect(host.querySelector<HTMLButtonElement>(".scene-delete-actor")?.disabled).toBe(true);
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
    actors?: readonly ActorView[];
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
        {...(props.actors === undefined ? {} : { actors: props.actors })}
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
      "add",
      "subtract",
      "multiply",
      "divide",
      "modulo",
      "random",
      "randomInteger",
      "xPosition",
      "yPosition",
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
  it("offers an actor distance reporter through a named actor selector", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "score",
              value: { type: "numericLiteral", value: 0 },
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    const actors = [
      { id: "actor:nova", name: "Nova", x: 0, y: 0, direction: 0, size: 100, visible: true },
      { id: "actor:robot", name: "Robot", x: 20, y: 0, direction: 0, size: 100, visible: true },
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
    const source = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="source"]',
    )!;
    expect(Array.from(source.options).map((option) => option.value)).toContain("distanceToActor");
    act(() => {
      source.value = "distanceToActor";
      source.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setNumericInput",
      reporter: "distanceToActor",
      referenceId: "actor:nova",
    });
  });
  it("shows and edits arithmetic operands without changing the other operand", () => {
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
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const source = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="source"]',
    )!;
    expect(source.value).toBe("add");
    expect(Array.from(source.options).map((option) => option.value)).toEqual(
      expect.arrayContaining(["modulo", "random", "randomInteger"]),
    );
    const left = host.querySelector<HTMLInputElement>('.numeric-socket input[aria-label*="Left"]')!;
    act(() => {
      left.value = "7";
      left.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setArithmeticOperand",
      input: "value",
      side: "left",
      value: 7,
    });
    const nestedSource = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="Left value source"]',
    )!;
    expect(nestedSource).not.toBeNull();
    expect(Array.from(nestedSource.options).map((option) => option.value)).toContain("multiply");
    act(() => {
      nestedSource.value = "listLength";
      nestedSource.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setArithmeticOperandSource",
      input: "value",
      side: "left",
      reporter: "listLength",
      referenceId: "l",
    });
    act(() => {
      source.value = "divide";
      source.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({ type: "setNumericInput", reporter: "divide" });
  });
  it("edits numbers in a second arithmetic level from the visual canvas", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "score",
              value: {
                type: "add",
                left: {
                  type: "multiply",
                  left: { type: "numericLiteral", value: 2 },
                  right: { type: "numericLiteral", value: 3 },
                },
                right: { type: "numericLiteral", value: 1 },
              },
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const nested = host.querySelector<HTMLInputElement>(
      '.numeric-socket input[aria-label*="Left value right"]',
    )!;
    expect(nested).not.toBeNull();
    act(() => {
      nested.value = "6";
      nested.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setArithmeticOperand",
      input: "value",
      path: ["left"],
      side: "right",
      value: 6,
    });
  });
  it("changes a nested variable reporter through its visible reference picker", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [
        { id: "a", name: "Score", initialValue: 0, visible: true },
        { id: "b", name: "Energy", initialValue: 0, visible: true },
      ],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "a",
              value: {
                type: "add",
                left: { type: "variable", variableId: "a" },
                right: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const reference = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="Left value declaration"]',
    )!;
    expect(reference).not.toBeNull();
    act(() => {
      reference.value = "b";
      reference.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setArithmeticOperandSource",
      side: "left",
      reporter: "variable",
      referenceId: "b",
    });
  });
  it("edits random range bounds from the numeric socket", () => {
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
                type: "randomInteger",
                min: { type: "numericLiteral", value: 1 },
                max: { type: "numericLiteral", value: 10 },
              },
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const source = host.querySelector<HTMLSelectElement>(
      '.numeric-socket select[aria-label*="source"]',
    )!;
    expect(source.value).toBe("randomInteger");
    const max = host.querySelector<HTMLInputElement>(
      '.numeric-socket input[aria-label*="Maximum"]',
    )!;
    act(() => {
      max.value = "20";
      max.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({ type: "setArithmeticOperand", side: "max", value: 20 });
    act(() => {
      max.value = "bad";
      max.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(intents).toHaveLength(1);
  });
  it("offers logical operand sources and Boolean values in a condition", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:logic",
        type: "control_if",
        inputs: {
          then: [],
          condition: {
            id: "and:logic",
            type: "operator_and",
            inputs: {
              left: { id: "goal:logic", type: "sensing_touching_goal" },
              right: { id: "bool:logic", type: "literal_boolean", fields: { value: true } },
            },
          },
        },
      },
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const source = host.querySelector<HTMLSelectElement>(
      '.logical-fields select[aria-label="Condition: left source"]',
    )!;
    act(() => {
      source.value = "sensing_touching_stage_edge";
      source.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setLogicalOperand",
      side: "left",
      blockType: "sensing_touching_stage_edge",
    });
    const boolean = host.querySelector<HTMLSelectElement>(
      '.logical-fields select[aria-label="Condition: right Boolean value"]',
    )!;
    act(() => {
      boolean.value = "false";
      boolean.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setLogicalBoolean",
      side: "right",
      value: false,
    });
  });
  it("offers actor contact inside logical operands with an actor picker", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:actor-logic",
        type: "control_if",
        inputs: {
          then: [],
          condition: {
            id: "and:actor-logic",
            type: "operator_and",
            inputs: {
              left: { id: "goal:actor-logic", type: "sensing_touching_goal" },
              right: {
                id: "touch:actor-logic",
                type: "sensing_touching_actor",
                fields: { actorId: "actor:main" },
              },
            },
          },
        },
      },
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, {
      onIntent: (intent) => intents.push(intent),
      actors: [
        { id: "actor:main", name: "Main", x: 0, y: 0, direction: 90, size: 100, visible: true },
        { id: "actor:robot", name: "Robot", x: 0, y: 0, direction: 90, size: 100, visible: true },
      ],
    });
    const picker = host.querySelector<HTMLSelectElement>(
      '.logical-fields select[aria-label="Condition: right Target actor"]',
    )!;
    expect(picker).not.toBeNull();
    act(() => {
      picker.value = "actor:robot";
      picker.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setLogicalActor",
      side: "right",
      actorId: "actor:robot",
    });
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
  it("offers declared and sensor sources on both comparison sides", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
      lists: [{ id: "items", name: "Items", initialItems: [], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: {
                type: "lessOrEqual",
                left: { type: "numericLiteral", value: 0 },
                right: { type: "numericLiteral", value: 10 },
              },
              then: [],
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const left = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Left value source"]',
    )!;
    expect(Array.from(left.options).map((option) => option.value)).toContain("variable");
    act(() => {
      left.value = "variable";
      left.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setComparisonOperand",
      side: "left",
      source: "variable",
      referenceId: "score",
    });
    const right = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Right value source"]',
    )!;
    act(() => {
      right.value = "yPosition";
      right.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setComparisonOperand",
      side: "right",
      source: "yPosition",
    });
  });
  it("offers distance to actor as a comparison source and lets the learner choose its target", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: {
        id: "if:distance",
        type: "control_if",
        inputs: {
          then: [],
          condition: {
            id: "compare:distance",
            type: "operator_less_than",
            inputs: {
              left: { id: "distance:left", type: "literal_number", fields: { value: 0 } },
              right: {
                id: "distance:right",
                type: "sensing_distance_to_actor",
                fields: { actorId: "actor:main" },
              },
            },
          },
        },
      },
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, {
      onIntent: (intent) => intents.push(intent),
      actors: [
        { id: "actor:main", name: "Main", x: 0, y: 0, direction: 90, size: 100, visible: true },
        { id: "actor:robot", name: "Robot", x: 0, y: 0, direction: 90, size: 100, visible: true },
      ],
    });
    const source = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Left value source"]',
    )!;
    expect(Array.from(source.options).map((option) => option.value)).toContain("distanceToActor");
    const target = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Right value Target actor"]',
    )!;
    expect(target).not.toBeNull();
    act(() => {
      target.value = "actor:robot";
      target.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setComparisonOperand",
      side: "right",
      source: "distanceToActor",
      referenceId: "actor:robot",
    });
  });
  it("shows list item index and random integer bounds inside a comparison", () => {
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      lists: [{ id: "items", name: "Items", initialItems: [3], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: {
                type: "lessThan",
                left: {
                  type: "listItem",
                  listId: "items",
                  index: { type: "numericLiteral", value: 1 },
                },
                right: {
                  type: "randomInteger",
                  min: { type: "numericLiteral", value: 1 },
                  max: { type: "numericLiteral", value: 10 },
                },
              },
              then: [],
            },
          ],
        },
      ],
    }).workspace;
    const intents: Intent[] = [];
    render(workspace, { onIntent: (intent) => intents.push(intent) });
    const listSource = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Left value source"]',
    )!;
    expect(listSource.value).toBe("listItem");
    const randomSource = host.querySelector<HTMLSelectElement>(
      '.comparison-operand select[aria-label="Condition: Right value source"]',
    )!;
    expect(randomSource.value).toBe("randomInteger");
    for (const [label, value, field, side] of [
      ["Condition: Left value Item number", "2", "index", "left"],
      ["Condition: Right value Maximum", "20", "max", "right"],
    ] as const) {
      const input = host.querySelector<HTMLInputElement>(
        `.comparison-operand input[aria-label="${label}"]`,
      )!;
      expect(input).not.toBeNull();
      act(() => {
        input.value = value;
        input.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
      });
      expect(intents.at(-1)).toMatchObject({
        type: "setComparisonNestedNumber",
        side,
        field,
        value: Number(value),
      });
    }
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
  it("chooses front or back on a visual layer block", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: { id: "layer:one", type: "looks_go_to_layer", fields: { layer: "front" } },
    }).workspace;
    const intents: Intent[] = [];
    act(() =>
      root.render(<Canvas workspace={workspace} onIntent={(intent) => intents.push(intent)} />),
    );
    const layer = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Go to front or back layer: Layer"]',
    )!;
    expect(Array.from(layer.options).map((option) => option.textContent)).toEqual([
      "Front",
      "Back",
    ]);
    act(() => {
      layer.value = "back";
      layer.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setTextField",
      field: "layer",
      value: "back",
      location: { index: 0 },
    });
  });
  it("chooses a visible actor for the point-towards block", () => {
    const workspace = applyWorkspaceChange(initial, {
      type: "addBlock",
      container: script,
      index: 0,
      block: { id: "point:robot", type: "motion_point_towards", fields: { actorId: "actor:main" } },
    }).workspace;
    const intents: Intent[] = [];
    act(() =>
      root.render(
        <Canvas
          workspace={workspace}
          actors={
            [
              { id: "actor:main", name: "Main" },
              { id: "actor:robot", name: "Robot" },
            ] as never
          }
          onIntent={(intent) => intents.push(intent)}
        />,
      ),
    );
    const target = host.querySelector<HTMLSelectElement>(
      'select[aria-label="Point towards actor: Target actor"]',
    )!;
    expect(target).not.toBeNull();
    expect(Array.from(target.options).map((option) => option.textContent)).toContain("Robot");
    act(() => {
      target.value = "actor:robot";
      target.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    expect(intents.at(-1)).toMatchObject({
      type: "setTextField",
      field: "actorId",
      value: "actor:robot",
      location: { index: 0 },
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
    const events: (
      { event: "keyPressed"; key: string } | { event: "actorClicked"; actorId: string }
    )[] = [];
    const placed: { actorId: string; x: number; y: number }[] = [];
    act(() =>
      root.render(
        <StagePanel
          copy={copyFor("en")}
          selectedActorId={undefined}
          onSelectActor={(actorId) => selected.push(actorId)}
          onStageEvent={(event) => events.push(event)}
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
    expect(events).toEqual([{ event: "actorClicked", actorId: "actor:nova" }]);
    key(viewport, { key: "a" });
    expect(events.at(-1)).toEqual({ event: "keyPressed", key: "A" });
    key(viewport, { key: "ArrowRight" });
    expect(events.at(-1)).toEqual({ event: "keyPressed", key: "ArrowRight" });
    key(viewport, { key: "7" });
    expect(events.at(-1)).toEqual({ event: "keyPressed", key: "7" });
    key(viewport, { key: "Escape" });
    expect(events).toHaveLength(4);
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
  it("drops known costumes and backdrops onto their stage targets", () => {
    const applied: string[] = [];
    const backdrops: string[] = [];
    const selected: string[] = [];
    act(() =>
      root.render(
        <StagePanel
          copy={copyFor("en")}
          selectedActorId="actor:a"
          onSelectActor={(id) => selected.push(id)}
          onCostume={(actorId, costumeId) => applied.push(`${actorId}:${costumeId}`)}
          onBackdrop={(backdropId) => backdrops.push(backdropId)}
          assets={[
            { id: "costume:mika", name: "Mika", kind: "costume", tags: [] },
            { id: "backdrop:moon", name: "Moon", kind: "backdrop", tags: [] },
          ]}
          frame={{
            state: {
              sprite: { x: 0, y: 0, heading: 0, radius: 10 },
              goal: { x: 200, y: 100, radius: 12 },
              viewport: { width: 240, height: 180 },
              actors: [
                { id: "actor:a", name: "A", x: 10, y: 10, direction: 0, size: 100, visible: true },
                { id: "actor:b", name: "B", x: 20, y: 20, direction: 0, size: 100, visible: true },
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
    const transfer = new Map<string, string>([[STAGE_COSTUME_DRAG_TYPE, "costume:mika"]]);
    const drop = new dom.window.MouseEvent("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { getData: (kind: string) => transfer.get(kind) ?? "" },
    });
    const actorB = Array.from(host.querySelectorAll<HTMLButtonElement>(".stage-sprite")).find(
      (button) => button.getAttribute("aria-label")?.includes(" B:"),
    )!;
    act(() => actorB.dispatchEvent(drop));
    expect(applied).toEqual(["actor:b:costume:mika"]);
    expect(selected).toEqual(["actor:b"]);
    transfer.set(STAGE_COSTUME_DRAG_TYPE, "costume:unknown");
    act(() => actorB.dispatchEvent(drop));
    expect(applied).toHaveLength(1);
    transfer.set(STAGE_COSTUME_DRAG_TYPE, "backdrop:moon");
    act(() => actorB.dispatchEvent(drop));
    expect(applied).toHaveLength(1);
    transfer.set(STAGE_COSTUME_DRAG_TYPE, "costume:mika");
    act(() => host.querySelector<HTMLElement>(".stage-viewport")!.dispatchEvent(drop));
    expect(applied).toEqual(["actor:b:costume:mika", "actor:a:costume:mika"]);
    transfer.delete(STAGE_COSTUME_DRAG_TYPE);
    transfer.set(STAGE_BACKDROP_DRAG_TYPE, "backdrop:moon");
    act(() => host.querySelector<HTMLElement>(".stage-viewport")!.dispatchEvent(drop));
    expect(backdrops).toEqual(["backdrop:moon"]);
    transfer.set(STAGE_BACKDROP_DRAG_TYPE, "backdrop:unknown");
    act(() => host.querySelector<HTMLElement>(".stage-viewport")!.dispatchEvent(drop));
    expect(backdrops).toHaveLength(1);
    transfer.set(STAGE_BACKDROP_DRAG_TYPE, "costume:mika");
    act(() => host.querySelector<HTMLElement>(".stage-viewport")!.dispatchEvent(drop));
    expect(backdrops).toHaveLength(1);
  });
  it("shows only canonical visible variable and list watchers", () => {
    act(() =>
      root.render(
        <StagePanel
          copy={copyFor("en")}
          selectedActorId={undefined}
          frame={{
            state: {
              sprite: { x: 0, y: 0, heading: 0, radius: 10 },
              goal: { x: 10, y: 10, radius: 10 },
              viewport: { width: 240, height: 180 },
              variables: [
                { id: "score", label: "Score", value: 7, visible: true },
                { id: "hidden", label: "Hidden", value: 1, visible: false },
              ],
              lists: [
                { id: "items", label: "Items", items: [1, 2], visible: true },
                { id: "secret", label: "Secret", items: [3], visible: false },
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
    expect(host.querySelector('[data-variable-id="score"]')).not.toBeNull();
    expect(host.querySelector('[data-variable-id="hidden"]')).toBeNull();
    expect(host.querySelector('[data-list-id="items"]')).not.toBeNull();
    expect(host.querySelector('[data-list-id="secret"]')).toBeNull();
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
    const transfer = new Map<string, string>();
    const drag = new dom.window.Event("dragstart", { bubbles: true, cancelable: true });
    Object.defineProperty(drag, "dataTransfer", {
      value: {
        setData: (kind: string, value: string) => transfer.set(kind, value),
        effectAllowed: "none",
      },
    });
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Choose costume: Mika"]')
        ?.closest(".scene-asset-card")
        ?.dispatchEvent(drag),
    );
    expect(transfer.get(STAGE_COSTUME_DRAG_TYPE)).toBe("costume:mika");
    act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Choose backdrop: Moon"]')
        ?.closest(".scene-asset-card")
        ?.dispatchEvent(drag),
    );
    expect(transfer.get(STAGE_BACKDROP_DRAG_TYPE)).toBe("backdrop:moon");
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

  it("indents and outdents with the keyboard and restores focus after each canonical update", () => {
    const onAnnounce = vi.fn();
    let current = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "repeat", count: 2, body: [] },
            { type: "move", steps: 3 },
          ],
        },
      ],
    } as never).workspace;
    const onIntent = vi.fn((intent: Intent) => {
      if (intent.type === "moveBlock") current = applyWorkspaceChange(current, intent).workspace;
    });
    render(current, { onIntent, onAnnounce });
    const move = blocks()[1] as HTMLElement;
    act(() => move.focus());
    key(move, { key: "ArrowRight", altKey: true });
    expect(onAnnounce).toHaveBeenCalledWith("Moved Move [N] steps into the preceding block");
    render(current, { onIntent, onAnnounce });
    expect((document.activeElement as HTMLElement).dataset["pos"]).toContain("repeatBody");
    key(document.activeElement as HTMLElement, { key: "ArrowLeft", altKey: true });
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
  it("requires two deliberate clicks before deleting a script", () => {
    const onDeleteScript = vi.fn();
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      scripts: [
        { id: "main", trigger: { type: "onStart" }, statements: [] },
        { id: "helper", trigger: { type: "greenFlag" }, statements: [] },
      ],
    }).workspace;
    act(() =>
      root.render(
        <Canvas workspace={workspace} onIntent={() => undefined} onDeleteScript={onDeleteScript} />,
      ),
    );
    const first = host.querySelector<HTMLButtonElement>(".script-delete")!;
    act(() => first.click());
    expect(onDeleteScript).not.toHaveBeenCalled();
    expect(first.textContent).toBe(copyFor("en").sceneConfirmDeleteScript);
    act(() => first.click());
    expect(onDeleteScript).toHaveBeenCalledWith("main");
  });

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
    const deleteButton = host.querySelector<HTMLButtonElement>(".script-delete")!;
    act(() => deleteButton.click());
    expect(posted.at(-1)).not.toMatchObject({ type: "deleteScript" });
    act(() => deleteButton.click());
    expect(posted.at(-1)).toMatchObject({
      type: "deleteScript",
      actorId: "actor:helper",
      scriptId: "helper",
      baseHash: "fnv1a32:12345678",
    });
    const move = Array.from(host.querySelectorAll<HTMLButtonElement>(".palette button")).find(
      (button) => button.textContent?.includes("Move"),
    )!;
    act(() => host.querySelector<HTMLButtonElement>(".studio-program-heading button")!.click());
    expect(host.querySelector<HTMLElement>(".workbench")?.dataset.toolsOpen).toBe("true");
    act(() => move.click());
    expect(host.querySelector<HTMLElement>(".workbench")?.dataset.toolsOpen).toBe("false");
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
    const triggerSelect = host.querySelector<HTMLSelectElement>(".scene-create-script select")!;
    act(() => {
      triggerSelect.value = "onKeyPressed";
      triggerSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    act(() =>
      host
        .querySelector<HTMLFormElement>(".scene-create-script")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({
      type: "createScript",
      trigger: "onKeyPressed",
      key: "Space",
    });
    const capture = host.querySelector<HTMLButtonElement>(".scene-key-picker button")!;
    act(() =>
      capture.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "7", bubbles: true, cancelable: true }),
      ),
    );
    expect(host.querySelector<HTMLSelectElement>(".scene-key-picker select")?.value).toBe("7");
    act(() =>
      host
        .querySelector<HTMLFormElement>(".scene-create-script")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({
      type: "createScript",
      trigger: "onKeyPressed",
      key: "7",
    });
    act(() =>
      capture.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
      ),
    );
    expect(host.querySelector<HTMLSelectElement>(".scene-key-picker select")?.value).toBe("7");
    act(() => {
      triggerSelect.value = "onActorClicked";
      triggerSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    act(() =>
      host
        .querySelector<HTMLFormElement>(".scene-create-script")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(posted.at(-1)).toMatchObject({ type: "createScript", trigger: "onActorClicked" });
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
  it("offers explicit variable rename and two-step deletion", () => {
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
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "energy", name: "Energy", initialValue: 0, visible: true }],
      scripts: [],
    }).workspace;
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    const details = host.querySelector<HTMLDetailsElement>(".variable-management")!;
    act(() => {
      details.open = true;
    });
    const input = details.querySelector<HTMLInputElement>("#rename-variable-energy")!;
    act(() => {
      input.value = "Power";
    });
    act(() =>
      details.querySelector<HTMLButtonElement>(".variable-management-actions button")!.click(),
    );
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "renameVariable", variableId: "energy", name: "Power" },
    });
    const deleteButton = details.querySelectorAll<HTMLButtonElement>(
      ".variable-management-actions button",
    )[1]!;
    const count = posted.length;
    act(() => deleteButton.click());
    expect(posted).toHaveLength(count);
    act(() => deleteButton.click());
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "deleteVariable", variableId: "energy" },
    });
  });
  it("edits variable defaults and toggles both stage watchers", () => {
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
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "Score", initialValue: 1, visible: true }],
      lists: [{ id: "items", name: "Items", initialItems: [], visible: true }],
      scripts: [],
    }).workspace;
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    const initial = host.querySelector<HTMLInputElement>(
      '.variable-management input[aria-label="Score: Initial value"]',
    )!;
    act(() => {
      initial.value = "7";
      initial.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "setVariableInitialValue", variableId: "score", value: 7 },
    });
    const count = posted.length;
    act(() => {
      initial.value = "Infinity";
      initial.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(posted).toHaveLength(count);
    const variableToggle = host.querySelector<HTMLInputElement>(
      ".variable-management .watcher-toggle input",
    )!;
    act(() => variableToggle.click());
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "setVariableVisible", variableId: "score", visible: false },
    });
    const listToggle = host.querySelector<HTMLInputElement>(
      ".list-initial-items .watcher-toggle input",
    )!;
    act(() => listToggle.click());
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "setListVisible", listId: "items", visible: false },
    });
  });
  it("navigates editor views and folds tools and Ori without losing their state", () => {
    const bridge: HostBridge = { post: () => undefined, subscribe: () => () => undefined };
    act(() => root.render(<Workbench bridge={bridge} locale="es" />));
    const shell = host.querySelector<HTMLElement>(".workbench")!;
    expect(shell.dataset.toolsOpen).toBe("false");
    const blocksButton = host.querySelector<HTMLButtonElement>(".studio-program-heading button")!;
    expect(blocksButton.getAttribute("aria-expanded")).toBe("false");
    act(() => blocksButton.click());
    expect(shell.dataset.toolsOpen).toBe("true");
    expect(blocksButton.getAttribute("aria-expanded")).toBe("true");
    act(() => blocksButton.click());
    expect(shell.dataset.toolsOpen).toBe("false");
    const scene = host.querySelector<HTMLButtonElement>(".studio-editor-tabs button:nth-child(2)")!;
    act(() => scene.click());
    expect(shell.dataset.workspaceView).toBe("scene");
    expect(scene.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector<HTMLElement>(".studio-program")?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>(".studio-details")?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>(".studio-scene-editor")?.hidden).toBe(false);
    const sceneTabs = host.querySelector<HTMLElement>(".studio-scene-editor .scene-section-tabs")!;
    expect(sceneTabs.querySelectorAll("button")).toHaveLength(5);
    expect(
      host.querySelector<HTMLElement>(".studio-scene-editor .scene-create-actor")?.hidden,
    ).not.toBe(true);
    act(() => sceneTabs.querySelectorAll<HTMLButtonElement>("button")[1]!.click());
    expect(
      host.querySelector<HTMLElement>('.studio-scene-editor section[aria-label="Disfraces"]')
        ?.hidden,
    ).toBe(false);
    expect(
      host.querySelector<HTMLElement>('.studio-scene-editor section[aria-label="Personajes"]')
        ?.hidden,
    ).toBe(true);
    act(() =>
      host.querySelector<HTMLButtonElement>(".studio-scene-editor .scene-create-shortcut")!.click(),
    );
    expect(
      host.querySelector<HTMLElement>(".studio-scene-editor .scene-create-image")?.hidden,
    ).toBe(false);
    expect(
      host.querySelector<HTMLSelectElement>(".studio-scene-editor .scene-create-image select")
        ?.value,
    ).toBe("costume");
    expect(shell.dataset.toolsOpen).toBe("false");
    expect(
      host
        .querySelector<HTMLButtonElement>(".library-tabs button:nth-child(2)")
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
    const review = host.querySelector<HTMLButtonElement>(
      ".studio-editor-tabs button:nth-child(3)",
    )!;
    act(() => review.click());
    expect(host.querySelector<HTMLElement>(".studio-evidence")?.hidden).toBe(false);
    const tools = host.querySelector<HTMLButtonElement>(
      '.studio-shell-actions button[aria-controls="studio-tools"]',
    )!;
    const ori = host.querySelector<HTMLButtonElement>(
      '.studio-shell-actions button[aria-controls="studio-ori"]',
    )!;
    act(() => {
      tools.click();
      ori.click();
    });
    expect(shell.dataset.toolsOpen).toBe("true");
    act(() => tools.click());
    expect(shell.dataset.toolsOpen).toBe("false");
    expect(shell.dataset.oriOpen).toBe("false");
    expect(host.querySelector("#studio-ori .agent")).not.toBeNull();
    const build = host.querySelector<HTMLButtonElement>(".studio-editor-tabs button:first-child")!;
    act(() => build.click());
    expect(host.querySelector<HTMLElement>(".studio-program")?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>(".studio-evidence")?.hidden).toBe(true);
  });
  it("resizes Ori by keyboard within editor-safe bounds and restores the default", () => {
    const bridge: HostBridge = { post: () => undefined, subscribe: () => () => undefined };
    act(() => root.render(<Workbench bridge={bridge} />));
    const shell = host.querySelector<HTMLElement>(".workbench")!;
    const dock = host.querySelector<HTMLElement>(".studio-ori-dock")!;
    let shellWidth = 800;
    shell.getBoundingClientRect = () => ({ width: shellWidth }) as DOMRect;
    dock.getBoundingClientRect = () =>
      ({
        width: Number.parseInt(shell.style.getPropertyValue("--ori-width"), 10) || 210,
      }) as DOMRect;
    const handle = host.querySelector<HTMLElement>(".studio-ori-resize")!;
    expect(handle.getAttribute("role")).toBe("separator");
    act(() =>
      handle.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      ),
    );
    expect(shell.style.getPropertyValue("--ori-width")).toBe("230px");
    act(() =>
      handle.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "End", bubbles: true })),
    );
    expect(shell.style.getPropertyValue("--ori-width")).toBe("260px");
    act(() => {
      shellWidth = 760;
      dom.window.dispatchEvent(new dom.window.Event("resize"));
    });
    expect(shell.style.getPropertyValue("--ori-width")).toBe("220px");
    act(() =>
      handle.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true })),
    );
    expect(shell.style.getPropertyValue("--ori-width")).toBe("190px");
    act(() => handle.dispatchEvent(new dom.window.MouseEvent("dblclick", { bubbles: true })));
    expect(shell.style.getPropertyValue("--ori-width")).toBe("");
  });
  it("draws, erases, and restores the previous canvas stroke", () => {
    const context = {
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(160 * 120 * 4),
        width: 160,
        height: 120,
      })),
      putImageData: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: "",
    };
    act(() =>
      root.render(
        <SceneLibrary
          copy={copyFor("es")}
          actors={[]}
          assets={[]}
          selectedActorId={undefined}
          backdropId={undefined}
          onSelectActor={() => undefined}
          onCostume={() => undefined}
          onBackdrop={() => undefined}
          onImportAsset={() => undefined}
        />,
      ),
    );
    act(() => host.querySelectorAll<HTMLButtonElement>(".scene-section-tabs button")[4]!.click());
    const canvas = host.querySelector<HTMLCanvasElement>(".scene-create-image canvas")!;
    vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 160,
      height: 120,
    } as DOMRect);
    canvas.setPointerCapture = vi.fn();
    const undo = Array.from(
      host.querySelectorAll<HTMLButtonElement>(".scene-draw-actions button"),
    ).find((button) => button.textContent === copyFor("es").sceneUndoDrawing)!;
    expect(undo.disabled).toBe(true);
    const pointer = (type: string) => {
      const event = new dom.window.Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, clientX: 20, clientY: 30 });
      act(() => canvas.dispatchEvent(event));
    };
    pointer("pointerdown");
    expect(context.arc).toHaveBeenCalledWith(20, 30, 5, 0, Math.PI * 2);
    expect(context.getImageData).toHaveBeenCalledTimes(1);
    expect(undo.disabled).toBe(false);
    pointer("pointerup");
    act(() =>
      host
        .querySelector<HTMLButtonElement>('.scene-draw-tools button[aria-pressed="false"]')!
        .click(),
    );
    pointer("pointerdown");
    expect(context.clearRect).toHaveBeenCalledWith(15, 25, 10, 10);
    pointer("pointercancel");
    act(() => undo.click());
    expect(context.putImageData).toHaveBeenCalledTimes(1);
  });
  it("opens the canonical code projection from the editor tabs", () => {
    const posted: unknown[] = [];
    const bridge: HostBridge = {
      post: (message) => posted.push(message),
      subscribe: () => () => undefined,
    };
    act(() => root.render(<Workbench bridge={bridge} />));
    act(() => host.querySelector<HTMLButtonElement>(".studio-code-tab")!.click());
    expect(posted.at(-1)).toEqual({ schema: STUDIO_PROTOCOL_VERSION, type: "openCode" });
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
  it("edits, adds and removes visible initial list items", () => {
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
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      lists: [{ id: "items", name: "Items", initialItems: [3], visible: true }],
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
    }).workspace;
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    const details = host.querySelector<HTMLDetailsElement>(".list-initial-items")!;
    act(() => {
      details.open = true;
    });
    const item = details.querySelector<HTMLInputElement>('input[aria-label="Items: List item 1"]')!;
    act(() => {
      item.value = "7";
      item.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(posted.at(-1)).toMatchObject({
      type: "intent",
      intent: { type: "setListInitialItems", listId: "items", items: [7] },
    });
    const count = posted.length;
    act(() => {
      item.value = "Infinity";
      item.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true }));
    });
    expect(posted).toHaveLength(count);
    act(() =>
      details
        .querySelector<HTMLButtonElement>('button[aria-label="Remove initial item 1 Items"]')!
        .click(),
    );
    expect(posted.at(-1)).toMatchObject({ intent: { items: [] } });
    act(() => details.querySelector<HTMLButtonElement>(".list-add-initial")!.click());
    expect(posted.at(-1)).toMatchObject({ intent: { items: [3, 0] } });
  });
  it("offers explicit list rename and two-step deletion", () => {
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
    const workspace = programToWorkspace({
      schema: "agorix/program/v1",
      lists: [{ id: "items", name: "Items", initialItems: [], visible: true }],
      scripts: [],
    }).workspace;
    act(() =>
      listener?.({
        schema: STUDIO_PROTOCOL_VERSION,
        type: "workspace",
        workspace,
        programHash: "fnv1a32:12345678",
      }),
    );
    const details = host.querySelector<HTMLDetailsElement>(".list-initial-items")!;
    act(() => {
      details.open = true;
    });
    const input = details.querySelector<HTMLInputElement>("#rename-items")!;
    act(() => {
      input.value = "Inventory";
    });
    act(() => details.querySelector<HTMLButtonElement>(".list-management-actions button")!.click());
    expect(posted.at(-1)).toMatchObject({
      intent: { type: "renameList", listId: "items", name: "Inventory" },
    });
    const deleteButton = details.querySelectorAll<HTMLButtonElement>(
      ".list-management-actions button",
    )[1]!;
    const count = posted.length;
    act(() => deleteButton.click());
    expect(posted).toHaveLength(count);
    act(() => deleteButton.click());
    expect(posted.at(-1)).toMatchObject({ intent: { type: "deleteList", listId: "items" } });
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
