<!-- agora-ai-sdlc:construction/v1 -->

# Logical Design — issue-99

## Why a separate `ProvenanceLabel` component instead of inline strings

The four provenance kinds recur across multiple, currently-unrelated parts
of `App.tsx` (proposal card, acceptance message, mission run-state, tutor
availability). A single component keeps the glyph/text/aria-label/
`data-provenance` contract consistent — a new call site can't accidentally
introduce a fifth, inconsistent way of marking "this is an AI suggestion."

## Why `data-provenance` rather than only visible text

`data-provenance="<kind>"` gives a stable, machine-readable hook independent
of the localized visible text, which is what both the Playwright
integration test and any future automated accessibility/consistency check
should assert against, rather than parsing translated copy.

## Scope note: Agorix Studio (AC-008) deferred

`extensions/vscode` is a separate surface with its own UI, currently a
minimal editor-integration shell (see `extensions/vscode/src/extension.ts`).
Adding progressive disclosure of technical diagnostics there is real work —
deciding what a "diagnostics panel" looks like in VS Code, whether it reads
`ProviderRuntimeDiagnostics` from `@agorix/provider-runtime` (issue #96),
and how it's toggled — that deserves its own issue and review rather than a
speculative addition folded into this web-focused slice.
