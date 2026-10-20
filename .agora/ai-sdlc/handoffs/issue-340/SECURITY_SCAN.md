# Issue 340 Security Scan Evidence

- `scripts/security-baseline.mjs` (part of `pnpm verify`): PASS; scanned built client bundle, safety documents and 493 text files.
- CI `security-baseline` and `dependency-scan` jobs: success on PR #350.
- Runtime checks: full CSP/COOP/CORP/X-Frame-Options/Permissions-Policy on every tested path; `/__dev/` returns 404; only loopback binding.
