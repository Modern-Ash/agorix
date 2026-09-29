# Test strategy — issue #110

- Curriculum unit tests cover locale normalization, complete EN/ES First Mission content, fallback and localized feedback.
- Tutor unit tests cover Spanish deterministic hints, unsupported-locale fallback and unchanged structured fields.
- Web unit tests cover catalog completeness, fallback, localized render, metadata-only locale persistence and canonical program equality.
- Playwright smoke covers selecting Spanish in the UI and confirming the stored program remains unchanged while metadata records locale.
- Repository verification should include `pnpm test` and `pnpm build`; e2e may be run when browser dependencies are available.
