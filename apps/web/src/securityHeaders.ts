/**
 * Web security headers for the Agorix web client (issue #30,
 * docs/safety/WEB_SECURITY_BASELINE.md).
 *
 * Single source of truth: consumed by the Vite dev/preview server and mirrored
 * into `public/_headers` for static hosts. `securityHeaders.test.ts` fails if the
 * mirror drifts.
 *
 * This module is server/deployment configuration. It is never imported by client
 * code, and it must never contain a provider secret — the `client-secrets` rule
 * in `scripts/security-baseline.mjs` enforces that independently.
 */

export type WebSecurityEnvironment = "development" | "production";

const BASE_CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
];

/**
 * Feature permissions stay closed. `geolocation` and `media` are the POC
 * child-safety constraints from docs/safety/CHILD_SAFETY_PRIVACY.md expressed as
 * a browser-enforced control rather than a review convention.
 */
export const WEB_SECURITY_PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "usb=()",
  "xr-spatial-tracking=()",
].join(", ");

const STANDARD_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Content-Security-Policy": "",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": WEB_SECURITY_PERMISSIONS_POLICY,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
});

function cspFor(environment: WebSecurityEnvironment): string {
  const directives = [...BASE_CSP_DIRECTIVES];
  if (environment === "development") {
    // Vite HMR uses a websocket, and the React Fast Refresh preamble is inline.
    directives[5] = "connect-src 'self' ws: wss:";
    directives[1] = "script-src 'self' 'unsafe-inline'";
  } else {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function webSecurityHeaders(
  environment: WebSecurityEnvironment = "production",
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {
    ...STANDARD_SECURITY_HEADERS,
    "Content-Security-Policy": cspFor(environment),
  };
  return Object.freeze(headers);
}

/** Directives the baseline requires; asserted by tests so they cannot be dropped. */
export const REQUIRED_CSP_DIRECTIVES: readonly string[] = Object.freeze([
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
]);

/** Header names the baseline requires on every deployed response. */
export const REQUIRED_SECURITY_HEADERS: readonly string[] = Object.freeze([
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
]);

/**
 * `<meta http-equiv>` fallback for static hosts that ignore `_headers`. CSP via
 * meta cannot express `frame-ancestors`, so that directive is dropped here and
 * remains a response-header requirement.
 */
export const CSP_META_FALLBACK = cspFor("production")
  .split("; ")
  .filter((directive) => directive !== "frame-ancestors 'none'")
  .join("; ");

/** Static-host `_headers` body, generated from the same constants. */
export function staticHostHeadersFile(): string {
  const headers = webSecurityHeaders("production");
  const lines = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
  return [
    "/*",
    "  Static-host header mirror for the Agorix web client.",
    "  Generated from apps/web/src/securityHeaders.ts — apps/web/src/securityHeaders.test.ts",
    "  fails if this file drifts. See docs/safety/WEB_SECURITY_BASELINE.md.",
    "*/",
    "/*",
    ...lines,
    "",
  ].join("\n");
}

/** `<meta http-equiv>` fallback content for `index.html`. */
export function cspMetaFallbackHtml(): string {
  return CSP_META_FALLBACK;
}
