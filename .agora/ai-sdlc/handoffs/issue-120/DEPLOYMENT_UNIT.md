# Deployment Unit

## Unit

Agorix Web interaction model and product documentation.

## Runtime impact

- Static React/Vite web shell changes.
- Product documentation addition.
- No backend, database, credential or provider integration changes.

## Rollback

Revert the PR that changes `docs/product/INTERACTION_MODEL.md`, `apps/web/src/App.tsx`, `apps/web/src/App.css`, `apps/web/src/i18n.ts` and Playwright tests.

## Verification boundary

Ready when local verification and CI pass, including Playwright touch/no-drag interaction coverage.
