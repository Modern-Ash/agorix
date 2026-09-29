import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProvenanceLabel, type ProvenanceKind } from "./ProvenanceLabel.js";

const ALL_KINDS: readonly ProvenanceKind[] = [
  "suggestion",
  "accepted",
  "runtime-fact",
  "unavailable",
];

describe("ProvenanceLabel (issue #99)", () => {
  it("marks every state with a distinct data-provenance attribute, in English", () => {
    for (const kind of ALL_KINDS) {
      const html = renderToStaticMarkup(<ProvenanceLabel kind={kind} locale="en" />);
      expect(html).toContain(`data-provenance="${kind}"`);
    }
  });

  it("gives every state distinct, non-empty visible text (never relies on color alone)", () => {
    const texts = ALL_KINDS.map((kind) =>
      renderToStaticMarkup(<ProvenanceLabel kind={kind} locale="en" />),
    );
    for (const html of texts) {
      expect(html.replace(/<[^>]+>/g, "").trim().length).toBeGreaterThan(0);
    }
    expect(new Set(texts).size).toBe(ALL_KINDS.length);
  });

  it("carries the same distinction in the aria-label as in the visible text (screen-reader parity)", () => {
    const html = renderToStaticMarkup(<ProvenanceLabel kind="suggestion" locale="en" />);
    expect(html).toContain('aria-label="AI suggestion — not applied yet"');
    expect(html).toContain("AI suggestion — not applied yet");
  });

  it("localizes to Spanish without changing the provenance kind", () => {
    const html = renderToStaticMarkup(<ProvenanceLabel kind="runtime-fact" locale="es" />);
    expect(html).toContain('data-provenance="runtime-fact"');
    expect(html).toContain("Resultado del runtime");
  });

  it("never mentions a provider/vendor name — provenance is about kind, not authority", () => {
    for (const kind of ALL_KINDS) {
      const html = renderToStaticMarkup(<ProvenanceLabel kind={kind} locale="en" />).toLowerCase();
      expect(html).not.toContain("openai");
      expect(html).not.toContain("ollama");
      expect(html).not.toContain("claude");
      expect(html).not.toContain("gpt");
    }
  });

  it("suggestion copy communicates 'AI may be wrong' without alarming language", () => {
    const html = renderToStaticMarkup(<ProvenanceLabel kind="suggestion" locale="en" />);
    expect(html.toLowerCase()).not.toMatch(/warning|danger|error|caution/);
    expect(html).toContain("not applied yet");
  });
});
