# Ori educator CLI — executable smoke and lint baseline

This increment repairs the inherited ESLint failure in the merged educator CLI by importing `process` explicitly from `node:process`.

The executable smoke tests build the CLI and its local report parser into a temporary Node ESM bundle, then run it in a child process with synthetic input. The tests verify successful redacted output, rejection of incomplete A/B ratings, and exclusive file creation (no overwrites).

No network access, child data, database, Kids route or production deployment is involved. Temporary files are deleted after each test.

The smoke is a test-only bundle; the documented CLI command continues to use the regular TypeScript build output. A future release should additionally validate that exact production build command end to end.

All six Ori Integration CI jobs must pass before merging into `integration/ori`.
