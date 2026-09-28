/**
 * External link policy for the web client (issue #30,
 * docs/safety/WEB_SECURITY_BASELINE.md).
 *
 * The POC has no outbound links at all. This module exists so that the first one
 * is a reviewed decision: an explicit allowlist, safe `rel` values, and a
 * classifier that keeps user/program text from ever becoming a live URL.
 *
 * The `external-links` rule in `scripts/security-baseline.mjs` fails if a link
 * surface appears in `apps/web/src` without routing through this module.
 */

export const ALLOWED_EXTERNAL_LINK_HOSTS: readonly string[] = Object.freeze([
  "github.com",
  "docs.agorix.app",
]);

export const EXTERNAL_LINK_REL = "noopener noreferrer";

export type ExternalLinkDecision =
  | { readonly kind: "internal"; readonly href: string }
  | { readonly kind: "external"; readonly href: string; readonly host: string }
  | { readonly kind: "blocked"; readonly href: string; readonly reason: string };

const BLOCKED_PROTOCOLS: Readonly<Record<string, string>> = Object.freeze({
  javascript: "javascript: URLs are never navigable in Agorix.",
  data: "data: URLs are never navigable in Agorix.",
  vbscript: "vbscript: URLs are never navigable in Agorix.",
  file: "file: URLs are never navigable in Agorix.",
  blob: "blob: URLs are never navigable in Agorix.",
});

function isInternal(href: string): boolean {
  // `//host` is protocol-relative, not site-relative, so it must not be internal.
  return (href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#");
}

/**
 * Classifies a candidate href. Anything not on the allowlist is blocked rather
 * than opened, and unparseable input is blocked rather than guessed.
 */
export function classifyExternalLink(href: string): ExternalLinkDecision {
  const trimmed = href.trim();

  if (trimmed === "") {
    return { kind: "blocked", href: trimmed, reason: "Empty href." };
  }

  if (isInternal(trimmed)) {
    return { kind: "internal", href: trimmed };
  }

  const protocolMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  const protocol = protocolMatch?.[1]?.toLowerCase() ?? null;

  if (protocol !== null && protocol !== "http" && protocol !== "https") {
    const reason = BLOCKED_PROTOCOLS[protocol] ?? `Protocol "${protocol}" is not allowed.`;
    return { kind: "blocked", href: trimmed, reason };
  }

  if (protocol === null && !trimmed.startsWith("//")) {
    return {
      kind: "blocked",
      href: trimmed,
      reason: "Only absolute http(s) URLs or site-relative paths are allowed.",
    };
  }

  let host: string;
  try {
    host = new URL(protocol === null ? `https:${trimmed}` : trimmed).hostname.toLowerCase();
  } catch {
    return { kind: "blocked", href: trimmed, reason: "URL could not be parsed." };
  }

  if (!ALLOWED_EXTERNAL_LINK_HOSTS.includes(host)) {
    return {
      kind: "blocked",
      href: trimmed,
      reason: `Host "${host}" is not on the external link allowlist.`,
    };
  }

  return { kind: "external", href: trimmed, host };
}

export function isAllowedExternalLink(href: string): boolean {
  return classifyExternalLink(href).kind === "external";
}

/** Props every outbound anchor must carry, so the opened page gets no opener. */
export function externalLinkProps(href: string): {
  href: string;
  rel: typeof EXTERNAL_LINK_REL;
  target: "_blank";
} {
  const decision = classifyExternalLink(href);
  if (decision.kind !== "external") {
    throw new Error(`Refusing to render a non-allowlisted external link: ${decision.href}`);
  }
  return { href: decision.href, rel: EXTERNAL_LINK_REL, target: "_blank" };
}
