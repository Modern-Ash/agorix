// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contextFromTarget, describeContext } from "./kidsOriContext.js";

function dom(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host.querySelector("[data-target]")!;
}

describe("Ori's local context", () => {
  it("falls back to the screen when nothing annotated is under the cursor", () => {
    const context = contextFromTarget(null, "map");
    expect(context).toEqual({ screen: "map" });
    expect(describeContext(context, "es")).toBe("Estás en el mapa.");
  });

  it("names the panel and the family of a block, never its text", () => {
    const target = dom(
      `<section data-panel-id="program"><ol><li data-ori-block="move"><span data-target>Mover 10 pasos de Lucía</span></li></ol></section>`,
    );
    const context = contextFromTarget(target, "editor");
    expect(context).toEqual({ screen: "editor", panel: "program", block: "motion" });
    const text = describeContext(context, "es");
    expect(text).toBe("Estás mirando el panel Programa, un bloque de Movimiento.");
    expect(JSON.stringify(context)).not.toContain("Lucía");
  });

  it("reports only the numbers of a selected sprite, not its name", () => {
    const target = dom(
      `<section data-panel-id="inspector"><div data-ori-sprite-x="0" data-ori-sprite-y="120"><strong data-target>Pip</strong></div></section>`,
    );
    const context = contextFromTarget(target, "studio");
    expect(context.sprite).toEqual({ x: 0, y: 120 });
    expect(describeContext(context, "en")).toBe(
      "You are looking at the panel Selected sprite, the selected sprite (x=0, y=120).",
    );
    expect(JSON.stringify(context)).not.toContain("Pip");
  });

  it("ignores unknown panels and unknown block types", () => {
    const target = dom(
      `<section data-panel-id="secret"><div data-ori-block="mystery"><i data-target></i></div></section>`,
    );
    expect(contextFromTarget(target, "studio")).toEqual({ screen: "studio", block: "other" });
  });
});
