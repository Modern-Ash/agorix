# Test Strategy

## Unit/regression

- Keep existing React static rendering checks for required regions.
- Keep editor model, persistence, i18n, runtime and tutor regression tests unchanged unless labels require updates.

## E2E

- Add tablet landscape viewport tests proving World and Code are both visible and the Action Palette is not a left rail.
- Add tablet portrait viewport tests proving World appears before Code and Code remains inspectable.
- Add touch target measurements for Run, Step, Stop and Reset.
- Add orientation/state preservation test: add/edit a block, resize from portrait to landscape and verify generated code remains intact.
- Preserve existing smoke flows for locale, persistence, tutor hints, mission completion and reduced motion.

## Commands

- `pnpm format:check`
- `pnpm --filter @agorix/web test`
- `pnpm --filter @agorix/web build`
- `pnpm --filter @agorix/web test:e2e`
