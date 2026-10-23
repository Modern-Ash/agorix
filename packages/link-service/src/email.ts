import { LinkError } from "./types.js";

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trim, NFKC, lower-case. Dots and plus-tags are NOT collapsed: two spellings are two addresses.
 * Throws a generic INVALID_EMAIL (never echoes the input).
 */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") throw new LinkError("INVALID_EMAIL", "Invalid email");
  const value = raw.normalize("NFKC").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (
    value.length < 3 ||
    value.length > 254 ||
    at < 1 ||
    local.length > 64 ||
    !SIMPLE_EMAIL.test(value) ||
    domain.includes("..") ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    hasControlCharacter(value)
  ) {
    throw new LinkError("INVALID_EMAIL", "Invalid email");
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}
