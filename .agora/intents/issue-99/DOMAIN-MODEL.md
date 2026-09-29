<!-- agora-ai-sdlc:construction/v1 -->

# Domain Model — issue-99 (child-facing AI provenance UX)

## New

- `apps/web/src/ProvenanceLabel.tsx` — `ProvenanceKind = "suggestion" | "accepted" | "runtime-fact" | "unavailable"`. Renders a glyph+text badge with `data-provenance` and a matching `aria-label`, from localized `provenance*` i18n keys.
- `apps/web/src/i18n.ts` — four new keys (`provenanceSuggestion`, `provenanceAccepted`, `provenanceRuntimeFact`, `provenanceUnavailable`), en/es.

## Wired into `App.tsx`

- Proposal card → `kind="suggestion"`.
- `proposalMessage === proposalAccepted` → `kind="accepted"`.
- Mission run-state message, when `status` is `complete`/`retry`/`stopped` (i.e. a real `createMissionRunFeedback` outcome) → `kind="runtime-fact"`.
- Tutor panel before any hint/proposal response → `kind="unavailable"`.

## Deferred

Agorix Studio (`extensions/vscode`) progressive disclosure (AC-008) — see `PLAN.md` scope note.
