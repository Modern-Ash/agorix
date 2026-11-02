import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Panel, PanelDock, PanelWorkArea, usePanelLayoutController } from "./Panel.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
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

function Demo() {
  const controller = usePanelLayoutController("test", "es");
  return (
    <PanelWorkArea controller={controller}>
      <Panel id="program" title="Programa" zoomable minimizable maximizable>
        <p>contenido</p>
      </Panel>
      <Panel id="stage" title="Escenario" minimizable maximizable>
        <p>escenario</p>
      </Panel>
      <PanelDock
        panels={[
          { id: "program", title: "Programa" },
          { id: "stage", title: "Escenario" },
        ]}
      />
    </PanelWorkArea>
  );
}

function StandaloneDemo() {
  const controller = usePanelLayoutController("standalone", "es");
  return (
    <>
      <Panel id="stage" title="Escenario" controller={controller} minimizable maximizable>
        <p>escenario</p>
      </Panel>
      <PanelDock controller={controller} panels={[{ id: "stage", title: "Escenario" }]} />
    </>
  );
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Demo />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (el: Element | null) => {
  if (el === null) throw new Error("missing element");
  act(() => {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
};
const panel = (id: string) => host.querySelector<HTMLElement>(`[data-panel-id="${id}"]`);

describe("<Panel>", () => {
  it("labels every header button for assistive tech", () => {
    for (const label of [
      "Alejar Programa",
      "Acercar Programa",
      "Volver Programa al 100 %",
      "Minimizar Programa",
      "Maximizar Programa",
    ]) {
      expect(button(label), label).not.toBeNull();
    }
    expect(button("Alejar Escenario")).toBeNull();
  });

  it("orders header controls zoom, minimize, maximize", () => {
    const labels = [...(panel("program")?.querySelectorAll("header button") ?? [])].map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "Alejar Programa",
      "Volver Programa al 100 %",
      "Acercar Programa",
      "Minimizar Programa",
      "Maximizar Programa",
    ]);
  });

  it("Esc restores a maximized panel and returns focus to the maximize button", () => {
    const maximize = button("Maximizar Programa");
    maximize?.focus();
    click(maximize);
    expect(panel("program")?.classList.contains("agx-panel--maximized")).toBe(true);
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(panel("program")?.classList.contains("agx-panel--maximized")).toBe(false);
    expect(document.activeElement).toBe(maximize);
  });

  it("other keys do not restore", () => {
    click(button("Maximizar Programa"));
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(panel("program")?.classList.contains("agx-panel--maximized")).toBe(true);
  });

  it("minimize hides the panel, keeps it mounted and the dock chip restores it", () => {
    click(button("Minimizar Escenario"));
    expect(panel("stage")?.hidden).toBe(true);
    expect(panel("stage")?.textContent).toContain("escenario");
    click(button("Restaurar Escenario desde la barra"));
    expect(panel("stage")?.hidden).toBe(false);
    expect(host.querySelector("nav")).toBeNull();
  });

  it("maximizing another panel un-maximizes the first", () => {
    click(button("Maximizar Programa"));
    click(button("Maximizar Escenario"));
    expect(panel("program")?.classList.contains("agx-panel--maximized")).toBe(false);
    expect(panel("stage")?.classList.contains("agx-panel--maximized")).toBe(true);
  });

  it("zooms within 50-200 and the percentage resets to 100", () => {
    click(button("Acercar Programa"));
    expect(button("Volver Programa al 100 %")?.textContent).toBe("110 %");
    click(button("Volver Programa al 100 %"));
    expect(button("Volver Programa al 100 %")?.textContent).toBe("100 %");
    for (let i = 0; i < 10; i += 1) click(button("Alejar Programa"));
    expect(button("Alejar Programa")?.disabled).toBe(true);
  });

  it("supports direct panel and dock use with a shared controller", () => {
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<StandaloneDemo />));
    click(button("Minimizar Escenario"));
    expect(panel("stage")?.hidden).toBe(true);
    click(button("Restaurar Escenario desde la barra"));
    expect(panel("stage")?.hidden).toBe(false);
    click(button("Maximizar Escenario"));
    expect(panel("stage")?.classList.contains("agx-panel--maximized")).toBe(true);
    act(() => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(panel("stage")?.classList.contains("agx-panel--maximized")).toBe(false);
  });

  it("persists minimized state per device scope", () => {
    click(button("Minimizar Programa"));
    act(() => root.unmount());
    root = createRoot(host);
    act(() => root.render(<Demo />));
    expect(panel("program")?.hidden).toBe(true);
  });
});
