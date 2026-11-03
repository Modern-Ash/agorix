// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { contextFromTarget, describeContext } from "./kidsOriContext.js";

function el(
  tag: string,
  attrs: Record<string, string>,
  ...children: (Element | string)[]
): Element {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) node.append(child);
  document.body.appendChild(node);
  return node;
}

describe("Ori's local context", () => {
  it("falls back to the screen when nothing annotated is under the cursor", () => {
    const context = contextFromTarget(null, "map");
    expect(context).toEqual({ screen: "map" });
    expect(describeContext(context, "es")).toBe("Estás en el mapa.");
  });

  it("names the panel and the family of a block, never its text", () => {
    const target = el("span", {}, "Mover 10 pasos de Lucía");
    el("section", { "data-panel-id": "program" }, el("li", { "data-ori-block": "move" }, target));
    const context = contextFromTarget(target, "editor");
    expect(context).toEqual({ screen: "editor", panel: "program", block: "motion" });
    const text = describeContext(context, "es");
    expect(text).toBe("Estás mirando el panel Programa, un bloque de Movimiento.");
    expect(JSON.stringify(context)).not.toContain("Lucía");
  });

  it("reports only the numbers of a selected sprite, not its name", () => {
    const target = el("strong", {}, "Pip");
    el(
      "section",
      { "data-panel-id": "inspector" },
      el("div", { "data-ori-sprite-x": "0", "data-ori-sprite-y": "120" }, target),
    );
    const context = contextFromTarget(target, "studio");
    expect(context.sprite).toEqual({ x: 0, y: 120 });
    expect(describeContext(context, "en")).toBe(
      "You are looking at the panel Selected sprite, the selected sprite (x=0, y=120).",
    );
    expect(JSON.stringify(context)).not.toContain("Pip");
  });

  it("ignores unknown panels and unknown block types", () => {
    const target = el("i", {});
    el(
      "section",
      { "data-panel-id": "secret" },
      el("div", { "data-ori-block": "mystery" }, target),
    );
    expect(contextFromTarget(target, "studio")).toEqual({ screen: "studio", block: "other" });
  });
});
