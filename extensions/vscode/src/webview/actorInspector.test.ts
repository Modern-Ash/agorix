// @vitest-environment node
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { ProjectActors } from "@agorix/persistence";
import { createNonce, validateMessage } from "./framework.js";
import { actorInspectorInboundSchemas, renderActorInspector } from "./actorInspector.js";

const actors: ProjectActors = {
  activeId: "sprite",
  items: [{ id: "sprite", name: "Sprite", x: 5, y: 6, direction: 90, size: 120, visible: true }],
  backdrop: "space",
  sounds: ["pop"],
};

function mount() {
  const posted: Array<Record<string, unknown>> = [];
  const dom = new JSDOM(renderActorInspector(actors, createNonce(), "vscode-webview:"), {
    runScripts: "dangerously",
    beforeParse(window) {
      (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
        postMessage: (message: Record<string, unknown>) => posted.push(message),
        getState: () => undefined,
        setState: () => undefined,
      });
    },
  });
  const { document, window } = dom.window;
  const edit = (name: string, value: string) => {
    const input = document.querySelector(`[name="${name}"]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  return { document, window, posted, edit };
}

describe("Actor Inspector webview", () => {
  it("has landmarks, labelled fields and shows the current actor and assets", () => {
    const { document, posted } = mount();
    expect(document.querySelector("main")).not.toBeNull();
    expect(document.querySelector('form[aria-label="Actor properties"]')).not.toBeNull();
    for (const id of ["name", "x", "y", "direction", "size", "visible"]) {
      expect(document.querySelector(`label[for="f-${id}"]`)).not.toBeNull();
    }
    expect((document.querySelector('[name="x"]') as HTMLInputElement).value).toBe("5");
    expect((document.querySelector('[name="visible"]') as HTMLInputElement).checked).toBe(true);
    expect(document.getElementById("assets")?.textContent).toContain("backdrop space");
    expect(document.getElementById("assets")?.textContent).toContain("sounds pop");
    expect(posted).toContainEqual({ type: "agorix-ready" });
  });

  it("posts one validated patch per edit", () => {
    const { posted, edit, document, window } = mount();
    edit("x", "42");
    edit("name", "Fox");
    const visible = document.querySelector('[name="visible"]') as HTMLInputElement;
    visible.checked = false;
    visible.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(posted.filter((m) => m["type"] === "agorix-actor-patch")).toEqual([
      { type: "agorix-actor-patch", x: 42 },
      { type: "agorix-actor-patch", name: "Fox" },
      { type: "agorix-actor-patch", visible: false },
    ]);
  });

  it("refuses a non-numeric value locally with an announced error and sends nothing", () => {
    const { posted, edit, document } = mount();
    edit("y", "abc");
    expect(document.getElementById("error")?.getAttribute("role")).toBe("alert");
    expect(document.getElementById("error")?.textContent).toContain("y must be a number");
    expect(posted.some((m) => m["type"] === "agorix-actor-patch")).toBe(false);
  });

  it("follows actors pushed by the host and host refusals", () => {
    const { document, window } = mount();
    window.dispatchEvent(
      new window.MessageEvent("message", {
        data: {
          type: "agorix-actors",
          actors: { ...actors, items: [{ ...actors.items[0], x: 99, name: "Moved" }] },
        },
      }),
    );
    expect((document.querySelector('[name="x"]') as HTMLInputElement).value).toBe("99");
    expect((document.querySelector('[name="name"]') as HTMLInputElement).value).toBe("Moved");
    window.dispatchEvent(
      new window.MessageEvent("message", {
        data: { type: "agorix-actor-error", reason: "size is out of range" },
      }),
    );
    expect(document.getElementById("error")?.textContent).toBe("size is out of range");
  });
});

describe("Actor patch validation", () => {
  const check = (raw: unknown) => validateMessage(actorInspectorInboundSchemas, raw).ok;

  it("accepts valid partial patches", () => {
    expect(check({ type: "agorix-actor-patch", x: -3.5 })).toBe(true);
    expect(check({ type: "agorix-actor-patch", name: "Ok", size: 5, visible: true })).toBe(true);
  });

  it.each([
    ["empty patch", { type: "agorix-actor-patch" }],
    ["unknown fields only", { type: "agorix-actor-patch", costume: "cat" }],
    ["string number", { type: "agorix-actor-patch", x: "5" }],
    ["NaN", { type: "agorix-actor-patch", x: Number.NaN }],
    ["Infinity", { type: "agorix-actor-patch", y: Number.POSITIVE_INFINITY }],
    ["position out of range", { type: "agorix-actor-patch", x: 10_001 }],
    ["size too small", { type: "agorix-actor-patch", size: 4 }],
    ["size too large", { type: "agorix-actor-patch", size: 501 }],
    ["blank name", { type: "agorix-actor-patch", name: "   " }],
    ["long name", { type: "agorix-actor-patch", name: "n".repeat(41) }],
    ["visible not boolean", { type: "agorix-actor-patch", visible: "yes" }],
  ])("rejects %s", (_label, raw) => {
    expect(check(raw)).toBe(false);
  });
});
