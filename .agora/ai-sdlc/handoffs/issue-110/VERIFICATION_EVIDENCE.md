# Verification evidence — issue #110

Environment: local Node v20.19.0, pnpm 9.15.9. The repository declares Node >=22 <23, so commands emitted an engine warning but completed.

Commands run successfully:

- `pnpm format:check` — passed.
- `pnpm lint` — passed.
- `pnpm test` — 15 test files passed, 141 tests passed.
- `pnpm build` — passed for workspace packages and web Vite bundle.
- `pnpm --filter @agorix/web test:e2e` — 8 Playwright smoke tests passed.

Coverage highlights:

- English and Spanish product locale selection.
- Locale fallback from unsupported tags.
- First Mission localized content and feedback.
- Deterministic Learning Companion Spanish hints and structured-field stability.
- Locale persisted as metadata only; canonical program equality is asserted before/after locale switch.
- Web UI localized controls, evidence labels and README/translation docs.
