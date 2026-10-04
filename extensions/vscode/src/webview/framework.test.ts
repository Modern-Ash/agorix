import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  createNonce,
  escapeHtml,
  escapeJsonForScript,
  field,
  MAX_WEBVIEW_MESSAGE_BYTES,
  NODE_ID_PATTERN,
  renderWebviewDocument,
  validateMessage,
  WEBVIEW_BASE_STYLES,
} from "./framework.js";
import { renderWorldPreview, worldPreviewInboundSchemas } from "./worldPreview.js";
import type { StudioExecutionViewState } from "../studioCore.js";

describe("webview CSP", () => {
  it("creates unique, URL-safe nonces with at least 128 bits", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  });

  it("builds a strict policy with nonce-only script and style", () => {
    const nonce = createNonce();
    const csp = buildContentSecurityPolicy({ nonce, cspSource: "vscode-webview:" });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain(`script-src 'nonce-${nonce}'`);
    expect(csp).toContain(`style-src 'nonce-${nonce}'`);
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*|https?:/);
  });

  it("rejects weak nonces and unsafe csp sources", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "short", cspSource: "x:" })).toThrow();
    expect(() =>
      buildContentSecurityPolicy({ nonce: createNonce(), cspSource: "x: 'unsafe-inline'" }),
    ).toThrow();
    expect(() => buildContentSecurityPolicy({ nonce: createNonce(), cspSource: "" })).toThrow();
    expect(() =>
      buildContentSecurityPolicy({
        nonce: createNonce(),
        cspSource: "vscode-webview:; script-src *",
      }),
    ).toThrow();
    expect(() => buildContentSecurityPolicy({ nonce: createNonce(), cspSource: "*" })).toThrow();
  });

  it("accepts VS Code's real cspSource shape", () => {
    const csp = buildContentSecurityPolicy({
      nonce: createNonce(),
      cspSource: "'self' https://*.vscode-cdn.net",
    });
    expect(csp).toContain("img-src 'self' https://*.vscode-cdn.net data:");
  });

  it("renders a document where every script/style carries the nonce and content is escaped", () => {
    const nonce = createNonce();
    const html = renderWebviewDocument({
      title: `</title><script>x</script>`,
      nonce,
      cspSource: "vscode-webview:",
      body: "<main></main>",
      script: "agorix.on('x', () => {});",
      outboundTypes: ["a"],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;/title&gt;");
    const tags = html.match(/<(script|style)\b[^>]*>/g) ?? [];
    expect(tags.length).toBe(2);
    for (const tag of tags) expect(tag).toContain(`nonce="${nonce}"`);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<main>");
  });

  it("escapes embedded JSON so data cannot close the script element", () => {
    expect(escapeJsonForScript({ a: "</script><!--" })).not.toContain("</script>");
    expect(escapeHtml(`"'<&>`)).toBe("&quot;&#39;&lt;&amp;&gt;");
  });
});

describe("webview message validation", () => {
  const schemas = worldPreviewInboundSchemas;

  it("accepts well-formed messages", () => {
    expect(validateMessage(schemas, { type: "agorix-ready" })).toEqual({
      ok: true,
      message: { type: "agorix-ready" },
    });
    expect(
      validateMessage(schemas, { type: "agorix-reveal-node", nodeId: "scripts[0]/statements[1]" }),
    ).toEqual({
      ok: true,
      message: { type: "agorix-reveal-node", nodeId: "scripts[0]/statements[1]" },
    });
  });

  it.each([
    ["null", null],
    ["string", "agorix-ready"],
    ["array", [{ type: "agorix-ready" }]],
    ["missing type", {}],
    ["numeric type", { type: 1 }],
    ["unknown type", { type: "eval" }],
    ["prototype key", { type: "__proto__" }],
    ["inherited key", { type: "toString" }],
    ["missing field", { type: "agorix-reveal-node" }],
    ["non-string field", { type: "agorix-reveal-node", nodeId: 7 }],
    ["injection field", { type: "agorix-reveal-node", nodeId: "<img onerror=x>" }],
    ["path traversal field", { type: "agorix-reveal-node", nodeId: "a b" }],
    ["oversized field", { type: "agorix-reveal-node", nodeId: "a".repeat(201) }],
  ])("rejects %s", (_name, raw) => {
    expect(validateMessage(schemas, raw).ok).toBe(false);
  });

  it("rejects oversized and non-serializable messages", () => {
    const big = { type: "agorix-ready", pad: "x".repeat(MAX_WEBVIEW_MESSAGE_BYTES) };
    expect(validateMessage(schemas, big)).toMatchObject({
      ok: false,
      reason: "message is too large",
    });
    const cyclic: Record<string, unknown> = { type: "agorix-ready" };
    cyclic["self"] = cyclic;
    expect(validateMessage(schemas, cyclic).ok).toBe(false);
  });

  it("field helpers bound input", () => {
    expect(field.integer(3, 0, 5)).toBe(3);
    expect(field.integer(3.5, 0, 5)).toBeUndefined();
    expect(field.integer(6, 0, 5)).toBeUndefined();
    expect(field.oneOf("a", ["a", "b"] as const)).toBe("a");
    expect(field.oneOf("c", ["a", "b"] as const)).toBeUndefined();
    expect(field.string("", 5)).toBeUndefined();
    expect(NODE_ID_PATTERN.test("scripts[0]/statements[0]")).toBe(true);
  });
});

describe("webview theming and accessibility", () => {
  const hexOrRgb = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

  it("uses only VS Code theme tokens: no hard-coded colors in shared styles", () => {
    expect(WEBVIEW_BASE_STYLES).not.toMatch(hexOrRgb);
    expect(WEBVIEW_BASE_STYLES).toContain("var(--vscode-editor-background)");
    expect(WEBVIEW_BASE_STYLES).toContain("color-scheme: light dark");
  });

  it("covers high-contrast, forced-colors, focus and reduced motion", () => {
    expect(WEBVIEW_BASE_STYLES).toContain("body.vscode-high-contrast");
    expect(WEBVIEW_BASE_STYLES).toContain("body.vscode-high-contrast-light");
    expect(WEBVIEW_BASE_STYLES).toContain("--vscode-contrastBorder");
    expect(WEBVIEW_BASE_STYLES).toContain("forced-colors: active");
    expect(WEBVIEW_BASE_STYLES).toContain(":focus-visible");
    expect(WEBVIEW_BASE_STYLES).toContain("prefers-reduced-motion: reduce");
  });

  it("World Preview has landmarks, labels, a live region and no hard-coded colors", () => {
    const view = { status: "idle", selectedFrameIndex: 0, previewFrames: [], inspectorSteps: [] };
    const html = renderWorldPreview(
      view as unknown as StudioExecutionViewState,
      createNonce(),
      "vscode-webview:",
    );
    expect(html).toContain("<main>");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Agorix shared runtime world preview"');
    expect(html).not.toMatch(hexOrRgb);
    expect(html).toContain("Rendered from @agorix/stage frames produced by the canonical runtime.");
  });
});
