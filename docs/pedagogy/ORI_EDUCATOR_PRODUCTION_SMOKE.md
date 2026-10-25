# Ori educator report CLI — production build smoke

The existing test suite verifies a temporary test bundle. This CI gate verifies the **actual compiled TypeScript output** used by the documented CLI.

The `Build` job runs `pnpm build`, then executes:

```bash
cd apps/tutor-api
node scripts/ori-educator-production-smoke.mjs
```

The smoke creates synthetic paired ratings in a temporary directory, runs `scripts/ori-educator-report.mjs` against its actual `dist/oriEducatorReportJson.js` import, checks the redacted output, verifies that an existing report is not overwritten, and rejects incomplete ratings. Temporary files are removed even on failure.

This is an executable CI gate, not a demonstration of educational effectiveness. It uses no real educator identities, child data, network calls or production routes. All six Ori Integration CI jobs remain required.
