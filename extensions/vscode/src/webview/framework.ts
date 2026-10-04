// Reusable webview component framework for Agorix Studio (issue #252).
// Pure module: no VS Code API import, so CSP, theming and message validation are
// unit-testable and reusable by the canvas, palette and proposal visuals.
import { randomBytes } from "node:crypto";

export const WEBVIEW_PROTOCOL_VERSION = 1;
export const MAX_WEBVIEW_MESSAGE_BYTES = 256 * 1024;

/** Cryptographically random, CSP-safe nonce (base64url, 128 bits). */
export function createNonce(): string {
  return randomBytes(16).toString("base64url");
}

export interface ContentSecurityPolicyOptions {
  readonly nonce: string;
  /** `webview.cspSource` from VS Code. */
  readonly cspSource: string;
}

/**
 * Strict CSP: nothing is allowed unless named. No `unsafe-inline`, no `unsafe-eval`,
 * no remote origins, no frames, no forms. Scripts and styles need the per-render nonce.
 */
export function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions): string {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(options.nonce)) {
    throw new Error("Webview nonce must be at least 16 URL-safe characters.");
  }
  // VS Code's cspSource is a space-separated list such as `'self' https://*.vscode-cdn.net`.
  const sources = options.cspSource.trim().split(/\s+/);
  const allowedSource = /^('self'|[A-Za-z][A-Za-z0-9+.-]*:(\/\/[^\s;,'"]*)?)$/;
  if (options.cspSource.trim().length === 0 || !sources.every((s) => allowedSource.test(s))) {
    throw new Error("Webview cspSource contains characters that are not allowed in a CSP source.");
  }
  return [
    "default-src 'none'",
    `img-src ${options.cspSource} data:`,
    `font-src ${options.cspSource}`,
    `style-src 'nonce-${options.nonce}'`,
    `script-src 'nonce-${options.nonce}'`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
  ].join("; ");
}

/**
 * Shared styles. Every color resolves to a VS Code theme token so light, dark and
 * high-contrast themes work without per-theme code. `--agx-*` semantic names map to the
 * Agorix design system roles (docs/product/DESIGN_SYSTEM.md) at IDE density.
 */
export const WEBVIEW_BASE_STYLES = `
:root {
  color-scheme: light dark;
  --agx-bg: var(--vscode-editor-background);
  --agx-fg: var(--vscode-editor-foreground);
  --agx-fg-muted: var(--vscode-descriptionForeground);
  --agx-border: var(--vscode-panel-border, var(--vscode-contrastBorder, transparent));
  --agx-border-strong: var(--vscode-contrastActiveBorder, var(--vscode-focusBorder));
  --agx-focus: var(--vscode-focusBorder);
  --agx-link: var(--vscode-textLink-foreground);
  --agx-surface: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  --agx-runtime: var(--vscode-focusBorder);
  --agx-success: var(--vscode-testing-iconPassed, var(--vscode-charts-green));
  --agx-warning: var(--vscode-editorWarning-foreground, var(--vscode-charts-yellow));
  --agx-error: var(--vscode-editorError-foreground, var(--vscode-errorForeground));
  --agx-ai: var(--vscode-charts-purple, var(--vscode-textLink-foreground));
  --agx-font-body: var(--vscode-font-family);
  --agx-font-code: var(--vscode-editor-font-family);
  --agx-type-sm: var(--vscode-font-size, 13px);
  --agx-space-1: 4px;
  --agx-space-2: 8px;
  --agx-space-3: 12px;
  --agx-radius: 4px;
}
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--agx-bg);
  color: var(--agx-fg);
  font-family: var(--agx-font-body);
  font-size: var(--agx-type-sm);
}
code, .agx-code { font-family: var(--agx-font-code); }
a { color: var(--agx-link); }
.agx-muted { color: var(--agx-fg-muted); }
.agx-toolbar {
  display: flex;
  align-items: center;
  gap: var(--agx-space-2);
  padding: var(--agx-space-2) var(--agx-space-3);
  border-bottom: 1px solid var(--agx-border);
}
.agx-footer {
  padding: var(--agx-space-2) var(--agx-space-3);
  border-top: 1px solid var(--agx-border);
  color: var(--agx-fg-muted);
}
.agx-badge {
  display: inline-block;
  padding: 0 var(--agx-space-2);
  border: 1px solid var(--agx-border-strong);
  border-radius: var(--agx-radius);
  color: var(--agx-fg);
  background: var(--vscode-badge-background, transparent);
}
.agx-badge[data-state="ai"] { border-color: var(--agx-ai); border-style: dashed; }
.agx-badge[data-state="success"] { border-color: var(--agx-success); }
.agx-badge[data-state="warning"] { border-color: var(--agx-warning); }
.agx-badge[data-state="error"] { border-color: var(--agx-error); }
.agx-button {
  font: inherit;
  padding: var(--agx-space-1) var(--agx-space-2);
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: var(--agx-radius);
  cursor: pointer;
}
.agx-button:hover { background: var(--vscode-button-hoverBackground); }
:focus-visible { outline: 2px solid var(--agx-focus); outline-offset: 1px; }
.agx-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
body.vscode-high-contrast, body.vscode-high-contrast-light {
  --agx-border: var(--vscode-contrastBorder);
  --agx-border-strong: var(--vscode-contrastActiveBorder);
}
body.vscode-high-contrast .agx-badge,
body.vscode-high-contrast-light .agx-badge,
body.vscode-high-contrast .agx-button,
body.vscode-high-contrast-light .agx-button {
  border-width: 2px;
}
@media (forced-colors: active) {
  .agx-badge, .agx-button { border: 2px solid ButtonText; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

// ---- Message protocol ----------------------------------------------------------------

/** A validator returns the typed message, or undefined when the raw value is invalid. */
export type MessageValidator<T> = (raw: Readonly<Record<string, unknown>>) => T | undefined;

export type MessageSchemas<M extends { readonly type: string }> = {
  readonly [K in M["type"]]: MessageValidator<Extract<M, { type: K }>>;
};

export type MessageValidation<M> =
  { readonly ok: true; readonly message: M } | { readonly ok: false; readonly reason: string };

/**
 * Validates an untrusted message crossing the webview boundary (either direction).
 * Rejects non-objects, oversized payloads, unknown types and schema violations.
 */
export function validateMessage<M extends { readonly type: string }>(
  schemas: MessageSchemas<M>,
  raw: unknown,
): MessageValidation<M> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "message must be an object" };
  }
  const record = raw as Record<string, unknown>;
  const type = record["type"];
  if (typeof type !== "string") {
    return { ok: false, reason: "message type must be a string" };
  }
  if (!Object.prototype.hasOwnProperty.call(schemas, type)) {
    return { ok: false, reason: "unknown message type" };
  }
  let size: number;
  try {
    size = JSON.stringify(record).length;
  } catch {
    return { ok: false, reason: "message is not serializable" };
  }
  if (size > MAX_WEBVIEW_MESSAGE_BYTES) {
    return { ok: false, reason: "message is too large" };
  }
  const validator = (schemas as Record<string, MessageValidator<M>>)[type];
  const message = validator?.(record);
  return message === undefined
    ? { ok: false, reason: `invalid ${type} message` }
    : { ok: true, message };
}

export const field = {
  /** Bounded string matching an optional pattern. */
  string(value: unknown, max = 256, pattern?: RegExp): string | undefined {
    if (typeof value !== "string" || value.length === 0 || value.length > max) return undefined;
    return pattern === undefined || pattern.test(value) ? value : undefined;
  },
  integer(value: unknown, min: number, max: number): number | undefined {
    return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
      ? value
      : undefined;
  },
  oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    return typeof value === "string" && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : undefined;
  },
} as const;

/** Canonical node ids look like `scripts[0]/statements[1]`. */
export const NODE_ID_PATTERN = /^[A-Za-z0-9_.[\]/-]{1,200}$/;

// ---- Document rendering -------------------------------------------------------------

export interface WebviewDocumentOptions {
  readonly title: string;
  readonly nonce: string;
  readonly cspSource: string;
  /** Trusted, already-escaped markup for `<body>`. Must contain a landmark. */
  readonly body: string;
  /** Component styles appended after the base styles. */
  readonly styles?: string;
  /** Component script (runs after the client runtime). */
  readonly script?: string;
  /** Message types the page may post to the host; enforced client-side too. */
  readonly outboundTypes?: readonly string[];
  readonly lang?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON safe to embed inside an inline `<script>` element. */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Client runtime injected before the component script. Exposes `agorix.post(type, fields)`
 * (allowlisted outbound types only) and `agorix.on(type, handler)` for host messages.
 */
function clientRuntime(outboundTypes: readonly string[]): string {
  return `const agorix = (() => {
  const vscodeApi = acquireVsCodeApi();
  const outbound = new Set(${escapeJsonForScript(outboundTypes)});
  const handlers = new Map();
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (typeof data !== "object" || data === null || typeof data.type !== "string") return;
    const handler = handlers.get(data.type);
    if (handler) handler(data);
  });
  return {
    post(type, fields) {
      if (!outbound.has(type)) throw new Error("Blocked outbound webview message: " + type);
      vscodeApi.postMessage(Object.assign({}, fields, { type }));
    },
    on(type, handler) { handlers.set(type, handler); },
    getState: () => vscodeApi.getState(),
    setState: (state) => vscodeApi.setState(state),
  };
})();`;
}

export function renderWebviewDocument(options: WebviewDocumentOptions): string {
  const csp = buildContentSecurityPolicy({ nonce: options.nonce, cspSource: options.cspSource });
  const script = `${clientRuntime(options.outboundTypes ?? [])}\n${options.script ?? ""}`;
  return `<!doctype html>
<html lang="${escapeHtml(options.lang ?? "en")}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
  <style nonce="${options.nonce}">${WEBVIEW_BASE_STYLES}${options.styles ?? ""}</style>
</head>
<body>
${options.body}
  <script nonce="${options.nonce}">${script}</script>
</body>
</html>`;
}
