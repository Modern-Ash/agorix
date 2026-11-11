import type { Locale } from "../i18n.js";

/**
 * A list as the Data panel shows it: the items one after another as plain text, shortened by
 * characters so a long list, or one full of words, never takes over a small screen. The words are
 * a child's own and are only ever put on the screen as text, never as markup, never sent anywhere.
 */
export const LIST_DISPLAY_MAX_CHARS = 120;

export function listDisplay(
  items: readonly (number | string)[],
  locale: Locale,
  maxChars = LIST_DISPLAY_MAX_CHARS,
): string {
  if (items.length === 0) return "—";
  const shown: string[] = [];
  let used = 0;
  for (const item of items) {
    const text = String(item);
    const cost = text.length + (shown.length > 0 ? 2 : 0);
    // Always show at least the first item, even when it alone is longer than the limit.
    if (shown.length > 0 && used + cost > maxChars) break;
    shown.push(text);
    used += cost;
  }
  const more = items.length - shown.length;
  const tail = more > 0 ? (locale === "es" ? ` … y ${more} más` : ` … and ${more} more`) : "";
  return `${shown.join(", ")}${tail}`;
}
