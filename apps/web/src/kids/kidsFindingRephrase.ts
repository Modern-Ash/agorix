import { toProviderFinding, type Finding } from "@agorix/run-evidence";
import type { Locale } from "../i18n.js";
import type { AgeBand } from "./kidsAgeBand.js";
import { findingSentence } from "./kidsRunFindings.js";
import { ORI_BROWSER_TIMEOUT_MS } from "./oriRequestBudget.js";

/**
 * Asking the tutor server for another way to say what Ori noticed. Only the provider-safe finding
 * and its local sentence travel, with the names the learner chose taken out of the sentence. The
 * local sentence stays on screen whatever happens here.
 */
export type RephraseResult =
  | { readonly status: "ok"; readonly text: string }
  | { readonly status: "unavailable" }
  | { readonly status: "failed" };

/** The local sentence without anything between quotation marks: a message name is the learner's. */
export function neutralSentence(finding: Finding, locale: Locale, band: AgeBand): string {
  return findingSentence(finding, locale, band)
    .replace(/\s?«[^»]*»/g, "")
    .replace(/\s?“[^”]*”/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

export async function requestFindingRephrase(
  finding: Finding,
  locale: Locale,
  band: AgeBand,
  fetchImpl: typeof fetch = fetch,
): Promise<RephraseResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORI_BROWSER_TIMEOUT_MS);
  try {
    const response = await fetchImpl("/api/tutor/run-finding/rephrase", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        version: "agorix/run-finding-rephrase/v1",
        locale,
        band,
        finding: toProviderFinding(finding),
        local: neutralSentence(finding, locale, band),
      }),
    });
    // No tutor host, no model or the host is down: the button is not offered again this session.
    if ([404, 502, 503, 504].includes(response.status)) return { status: "unavailable" };
    if (!response.ok) return { status: "failed" };
    const raw = await response.text();
    if (raw.length > 2048) return { status: "failed" };
    const parsed: unknown = JSON.parse(raw);
    const text =
      parsed && typeof parsed === "object" ? (parsed as { text?: unknown }).text : undefined;
    return typeof text === "string" && text.length > 0 && text.length <= 200
      ? { status: "ok", text }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
