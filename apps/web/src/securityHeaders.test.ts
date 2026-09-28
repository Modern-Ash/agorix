import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CSP_META_FALLBACK,
  REQUIRED_CSP_DIRECTIVES,
  REQUIRED_SECURITY_HEADERS,
  staticHostHeadersFile,
  webSecurityHeaders,
  WEB_SECURITY_PERMISSIONS_POLICY,
} from "./securityHeaders.js";

const repoFile = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

function csp(headers: Readonly<Record<string, string>>): string {
  const value = headers["Content-Security-Policy"];
  expect(value).toBeDefined();
  return value ?? "";
}

describe("web security headers", () => {
  it("sets every required header in both environments", () => {
    for (const environment of ["development", "production"] as const) {
      const headers = webSecurityHeaders(environment);
      for (const name of REQUIRED_SECURITY_HEADERS) {
        expect(headers[name], `${environment} ${name}`).toBeTruthy();
      }
    }
  });

  it("keeps the required CSP directives in both environments", () => {
    for (const environment of ["development", "production"] as const) {
      const policy = csp(webSecurityHeaders(environment));
      for (const directive of REQUIRED_CSP_DIRECTIVES) {
        expect(policy, `${environment} ${directive}`).toContain(directive);
      }
    }
  });

  it("denies framing, plugins, base-tag rewriting and form submission", () => {
    const policy = csp(webSecurityHeaders("production"));
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'none'");
    expect(webSecurityHeaders("production")["X-Frame-Options"]).toBe("DENY");
  });

  it("allows no inline or remote script in production", () => {
    const policy = csp(webSecurityHeaders("production"));
    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("keeps production connect-src same-origin only", () => {
    expect(csp(webSecurityHeaders("production"))).toContain("connect-src 'self';");
  });

  it("relaxes only dev server directives, never the deny directives", () => {
    const production = csp(webSecurityHeaders("production"));
    const development = csp(webSecurityHeaders("development"));
    expect(development).toContain("ws:");
    expect(development).toContain("script-src 'self' 'unsafe-inline'");
    for (const directive of ["object-src 'none'", "form-action 'none'", "frame-ancestors 'none'"]) {
      expect(development).toContain(directive);
    }
    expect(production).not.toContain("ws:");
  });

  it("upgrades insecure requests in production only", () => {
    expect(csp(webSecurityHeaders("production"))).toContain("upgrade-insecure-requests");
    expect(csp(webSecurityHeaders("development"))).not.toContain("upgrade-insecure-requests");
  });

  it("closes geolocation, camera and microphone in the browser", () => {
    const headers = webSecurityHeaders("production");
    expect(headers["Permissions-Policy"]).toBe(WEB_SECURITY_PERMISSIONS_POLICY);
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("microphone=()");
  });

  it("sends no referrer and no cross-origin opener", () => {
    const headers = webSecurityHeaders("production");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("returns a frozen header map", () => {
    expect(Object.isFrozen(webSecurityHeaders("production"))).toBe(true);
  });

  it("defaults to the production policy", () => {
    expect(webSecurityHeaders()).toEqual(webSecurityHeaders("production"));
  });

  it("mirrors the same policy into the static-host _headers file", () => {
    const committed = repoFile("../public/_headers");
    const generated = staticHostHeadersFile();
    expect(committed.trimEnd()).toBe(generated.trimEnd());
  });

  it("keeps the index.html meta fallback in sync and never weakens it", () => {
    const html = repoFile("../index.html");
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    const meta = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(meta).toBe(CSP_META_FALLBACK);
    for (const directive of REQUIRED_CSP_DIRECTIVES.filter((d) => d !== "frame-ancestors 'none'")) {
      expect(meta).toContain(directive);
    }
  });

  it("serves the headers from the vite dev and preview servers", () => {
    const config = repoFile("../vite.config.ts");
    expect(config).toContain("webSecurityHeaders");
    expect(config).toContain("server");
    expect(config).toContain("preview");
  });
});
