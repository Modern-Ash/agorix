import type { Locale } from "./i18n.js";
import { t } from "./i18n.js";

/**
 * The five states issue #99 requires the learner be able to tell apart:
 * an AI proposal not yet applied, an accepted (now-canonical) change, a
 * deterministic runtime-observed fact, an unavailable AI state, and plain
 * learner-authored content (which needs no badge — its absence *is* the
 * signal, per "AI proposal/suggestion" being the thing that must stand out).
 */
export type ProvenanceKind = "suggestion" | "accepted" | "runtime-fact" | "unavailable";

const GLYPH: Record<ProvenanceKind, string> = {
  suggestion: "✨",
  accepted: "✓",
  "runtime-fact": "▶",
  unavailable: "⏸",
};

/**
 * A small, icon+text badge — never color alone (AC: "status does not rely
 * on color alone") — that marks whether text the learner is reading is an
 * AI proposal, an already-accepted change, a runtime-observed fact, or an
 * unavailable-AI state. `data-provenance` makes the distinction
 * machine-testable; the visible text plus glyph carry it for sighted users,
 * and `aria-label` carries it for screen readers without relying on the
 * glyph alone.
 */
export function ProvenanceLabel({
  kind,
  locale,
}: {
  readonly kind: ProvenanceKind;
  readonly locale: Locale;
}) {
  const label = t(locale, provenanceLabelKey(kind));
  return (
    <span
      className={`provenance-badge provenance-${kind}`}
      data-provenance={kind}
      aria-label={label}
    >
      <span aria-hidden="true">{GLYPH[kind]}</span> {label}
    </span>
  );
}

function provenanceLabelKey(kind: ProvenanceKind) {
  switch (kind) {
    case "suggestion":
      return "provenanceSuggestion" as const;
    case "accepted":
      return "provenanceAccepted" as const;
    case "runtime-fact":
      return "provenanceRuntimeFact" as const;
    case "unavailable":
      return "provenanceUnavailable" as const;
  }
}
