import { describe, expect, it } from "vitest";
import { workbenchHtml } from "./workbenchHtml.js";

describe("workbenchHtml", () => {
  it("uses a locked-down CSP with nonce-protected style and script tags", () => {
    const html = workbenchHtml(
      "nonce123",
      "vscode-webview:",
      "vscode-webview:/dist/workbench.js",
      "compact",
      "es",
    );

    expect(html).toContain('<html lang="es">');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("style-src 'nonce-nonce123'");
    expect(html).toContain("script-src 'nonce-nonce123' vscode-webview:");
    expect(html).toContain('data-density="compact"');
    expect(html).toContain('data-locale="es"');
    expect(html).toContain('<style nonce="nonce123">');
    expect(html).toContain('<script nonce="nonce123" src="vscode-webview:/dist/workbench.js">');
    expect(html).not.toMatch(/https?:/);
    expect(html).not.toContain(' style="');
    expect(html).not.toMatch(/\s+on[a-z]+=/i);
  });
});
