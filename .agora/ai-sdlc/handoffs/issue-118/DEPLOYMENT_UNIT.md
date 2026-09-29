# Deployment Unit

## Unit

Agorix Web application shell in `apps/web`.

## Runtime impact

- Static Vite/React web app build.
- No backend, provider, credential or data migration change.
- No package dependency change planned.

## Rollout and rollback

- Rollout through normal PR, CI and merge to `main`.
- Rollback by reverting the PR that changes `apps/web/src/App.tsx`, `apps/web/src/App.css`, `apps/web/src/i18n.ts` and Playwright tests.

## Verification boundary

The deployment unit is considered ready when unit/build checks and Playwright tablet coverage pass in CI.
