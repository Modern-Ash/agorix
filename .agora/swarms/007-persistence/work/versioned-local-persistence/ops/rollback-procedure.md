# Rollback procedure — issue #28

1. Revert PR #47 (`git revert -m 1 <merge-commit>`) on `main`; run `pnpm verify`.
2. Data: persisted projects live only in the learner's browser under `agorix:*` keys. After a revert the app no longer reads them; they are inert and can be cleared by removing those keys. No server-side data to restore.
3. Forward-incompatible data: a build that predates a schema bump must not read newer data; the versioned store fails safely instead of loading it.
