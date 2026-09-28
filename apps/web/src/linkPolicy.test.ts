import { describe, expect, it } from "vitest";
import {
  ALLOWED_EXTERNAL_LINK_HOSTS,
  classifyExternalLink,
  EXTERNAL_LINK_REL,
  externalLinkProps,
  isAllowedExternalLink,
} from "./linkPolicy.js";

const ALLOWED_HREF = `https://${ALLOWED_EXTERNAL_LINK_HOSTS[0] ?? "github.com"}/Modern-Ash/agorix`;

describe("external link policy", () => {
  it("treats site-relative paths as internal", () => {
    for (const href of ["/", "/docs/safety", "#top", "/a?b=c#d"]) {
      expect(classifyExternalLink(href).kind, href).toBe("internal");
    }
  });

  it("allows only hosts on the allowlist", () => {
    expect(classifyExternalLink(ALLOWED_HREF)).toEqual({
      kind: "external",
      href: ALLOWED_HREF,
      host: ALLOWED_EXTERNAL_LINK_HOSTS[0],
    });
    expect(isAllowedExternalLink(ALLOWED_HREF)).toBe(true);
  });

  it("normalizes host case before comparing", () => {
    expect(isAllowedExternalLink("https://GITHUB.com/Modern-Ash/agorix")).toBe(true);
  });

  it("blocks every other host", () => {
    for (const href of [
      "https://example.com",
      "https://evil.github.com.attacker.test",
      "https://notgithub.com",
      "https://github.com.evil.test",
    ]) {
      expect(classifyExternalLink(href).kind, href).toBe("blocked");
    }
  });

  it("blocks script-bearing and local protocols", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://evil.test/abc",
    ]) {
      expect(classifyExternalLink(href).kind, href).toBe("blocked");
    }
  });

  it("blocks protocol-relative URLs pointing off the allowlist", () => {
    expect(classifyExternalLink("//example.com").kind).toBe("blocked");
    expect(classifyExternalLink(`//${ALLOWED_EXTERNAL_LINK_HOSTS[0]}`).kind).toBe("external");
  });

  it("blocks bare hostnames, free text and empty input", () => {
    for (const href of ["github.com", "see the docs", "http s://x", "  ", ""]) {
      expect(classifyExternalLink(href).kind, href).toBe("blocked");
    }
  });

  it("blocks unparseable URLs instead of guessing", () => {
    expect(classifyExternalLink("https://").kind).toBe("blocked");
  });

  it("emits safe anchor props for allowlisted links", () => {
    expect(externalLinkProps(ALLOWED_HREF)).toEqual({
      href: ALLOWED_HREF,
      rel: EXTERNAL_LINK_REL,
      target: "_blank",
    });
    expect(EXTERNAL_LINK_REL).toContain("noopener");
    expect(EXTERNAL_LINK_REL).toContain("noreferrer");
  });

  it("refuses to render props for anything not allowlisted", () => {
    for (const href of ["javascript:alert(1)", "https://example.com", "/local"]) {
      expect(() => externalLinkProps(href), href).toThrow(/non-allowlisted/);
    }
  });

  it("keeps the allowlist frozen and minimal", () => {
    expect(Object.isFrozen(ALLOWED_EXTERNAL_LINK_HOSTS)).toBe(true);
    expect(ALLOWED_EXTERNAL_LINK_HOSTS.length).toBeGreaterThan(0);
  });
});
