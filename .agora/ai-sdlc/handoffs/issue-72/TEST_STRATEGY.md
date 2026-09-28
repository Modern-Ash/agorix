# Test Strategy - Issue #72

## Deterministic checks

- `git diff --check -- AGENTS.md docs/architecture/SYSTEM_DESIGN.md docs/architecture/AI_TUTOR.md docs/architecture/LEARNING_COMPANION.md`
- `rg -n "AI proposes|learner decides|Runtime proves|learner explains|silent|invisibly|canonical program|LanguageProjection|Learning Companion|provider adapter|runtime evidence|ProgramProposal|proposal validation|preview / diff|credentials|provider SDK|child|privacy|generated provider|never executed|arbitrary learner code" AGENTS.md docs/architecture/SYSTEM_DESIGN.md docs/architecture/AI_TUTOR.md docs/architecture/LEARNING_COMPANION.md`
- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- local diff secret/PII scan

## Results

- Formatting: passed.
- Lint: passed.
- Tests: 15 files, 136 tests passed.
- Build: passed.
- Diff secret/PII scan: passed.

## Environment note

Local Node was `v20.19.0` while the repo declares `>=22 <23`. pnpm emitted an unsupported-engine warning, but checks completed successfully.
