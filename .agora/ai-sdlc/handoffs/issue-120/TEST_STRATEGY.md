# Test Strategy

## Unit/static

- Existing static render checks must include Action Palette and explicit numeric apply/cancel controls.
- i18n completeness must pass for new labels.

## Playwright

- Touch/no-drag First Mission: add Move via Action Palette, set value, apply, run and complete.
- Reorder: add Move and Turn, reorder with Down/Up buttons, verify generated code order changes.
- Virtual keyboard: focus numeric field in tablet portrait, verify Apply/Cancel stay visible.
- EN/ES: switch locale and complete an edit path with Spanish labels.
- Preserve #118 tablet landscape/portrait/orientation tests.

## Commands

- `pnpm format:check`
- `pnpm test`
- `pnpm --filter @agorix/web test`
- `pnpm --filter @agorix/web build`
- `pnpm --filter @agorix/web test:e2e`
