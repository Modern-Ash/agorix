# Web security and child-safety baseline (POC)

The enforceable baseline for the Agorix POC: child-safety and web-security constraints that are
checked in CI, not intentions. Issue #30 owns the controls below; AI-output-specific validation is
split off to [#100](https://github.com/Modern-Ash/agorix/issues/100) and
[#103](https://github.com/Modern-Ash/agorix/issues/103) and is **not** covered here.

Related safety documents: [CHILD_SAFETY_PRIVACY.md](CHILD_SAFETY_PRIVACY.md) holds the product-level
privacy rules; [AI_OUTPUT_VALIDATION.md](AI_OUTPUT_VALIDATION.md) holds the #100/#103 output
validation contract.

## How the baseline is enforced

| Control                         | Enforced by                                                     | Command                   |
| ------------------------------- | --------------------------------------------------------------- | ------------------------- |
| Static baseline scan            | `scripts/security-baseline.mjs` (rules below)                   | `pnpm security:check`     |
| Scanner self-test               | `scripts/security-baseline.test.mjs`                            | `pnpm test`               |
| Runtime operation allowlist     | `packages/runtime/src/operations.ts`                            | `pnpm test`               |
| Security headers in dev/preview | `apps/web/src/securityHeaders.ts` via `apps/web/vite.config.ts` | `pnpm test`, `pnpm build` |
| Static-host headers             | `apps/web/public/_headers`, `apps/web/index.html` meta fallback | `pnpm test`, `pnpm build` |
| External link policy            | `apps/web/src/linkPolicy.ts`                                    | `pnpm test`               |
| Dependency scanning             | `pnpm audit --audit-level=high` in `.github/workflows/ci.yml`   | CI `dependency-scan`      |

`pnpm security:check` is dependency-free and runs from a clean checkout; it needs no provider
credentials, no network access and no child data.

## Control rules

### 1. No secrets in source, fixtures or bundles (`secret-scan`)

Provider, cloud and token patterns are denied repository-wide. A suppression must be attributed and
justified inline (`// agora-allowlist: <reason>`, min. 10 characters) or per file
(`// agora-allowlist-file: <reason>` in the first 20 lines). No suppression reason may be empty, and
the scanner's own self-test file is the only file-level suppression.

### 2. No provider secrets in client code (`no-client-secrets`)

`AGORIX_TUTOR_API_KEY`, `AGORIX_TUTOR_AUTH_TOKEN` and `AGORIX_TUTOR_AUTH_HEADER` must never appear in
`apps/web` or `apps/mobile`, including the Vite config (build-time env injection is the classic
bundle leak). Shipped client code under `apps/web/src/`, `apps/web/index.html` and
`apps/web/public/` must not read environment variables at all. If `apps/web/dist` exists, its bundles
are scanned for provider key patterns too.

### 3. No arbitrary or generated code execution (`no-eval`)

Denied in first-party source (`apps/`, `packages/`, `extensions/`): `eval`, the `Function`
constructor, string-bodied timers, `document.write`, raw HTML sinks
(`.innerHTML =`/`.outerHTML =`/`dangerouslySetInnerHTML`), dynamic `vm`/`child_process`/
`worker_threads` imports, `importScripts`, and runtime WebAssembly compilation.

Generated textual code is a display and learning projection only; it is never executed as learner
program source. The canonical program model is the only thing the runtime executes.

### 4. Runtime operation allowlist

`packages/runtime/src/operations.ts` names every statement, expression and trigger the interpreter
may execute. The allowlist is checked both per node during execution and for the whole validated
program before the first world mutation; an unlisted node type fails closed with
`RuntimeExecutionError`. Adding a program-model node type is not enough to make it executable — the
allowlist entry and its test are the release gate.

### 5. No POC account or PII domain fields (`no-pii-domain-fields`)

`packages/persistence/` and `packages/platform-contract/` must not declare account, contact, school,
address, birth-date, precise-location or credential fields. Project metadata (`createdAt`,
`updatedAt`, `missionProgress`, `hintLevel`, `locale`) stays allowed.

### 6. No prohibited POC features (`no-prohibited-features`)

Denied in first-party source: geolocation, user media and `MediaRecorder`, outbound WebSocket and
`sendBeacon`, direct messaging, social-graph mutation, and public publishing. There is no public
sharing, chat, DM or precise-location requirement in the POC.

### 7. Governed external links (`external-links`)

Every outbound link in `apps/web/src/` must route through `apps/web/src/linkPolicy.ts`
(`rel="noopener noreferrer"`, allowed schemes and hosts, `target="_blank"` handling). Raw anchors,
`href`, `window.open`, `location` navigation and `import.meta.env` base-URL reads are denied, so a
learner project cannot navigate the shell to an unreviewed destination.

### 8. Security headers where deployed

`apps/web/src/securityHeaders.ts` is the single source of truth for the CSP, COOP/CORP,
`Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options` and
`X-Permitted-Cross-Domain-Policies` values. The Vite dev/preview servers emit them, and static hosts
get them from `apps/web/public/_headers`; `apps/web/index.html` carries a `meta` fallback for hosts
that ignore `_headers` (`frame-ancestors` still requires a response header). A test fails if the
mirrors drift from the source of truth.

### 9. Curated bundled starter assets

Starter missions, sprites and sounds are bundled and version-controlled. No runtime asset is fetched
from a third-party CDN or from learner-controlled URLs, so the client works offline and no external
host can change what a child sees.

## Security review checklist

Run before any release or review of a change that touches the client, the runtime, provider
adapters or packaging. Each item is a yes/no answer, not a judgement call.

- [ ] `pnpm security:check` passes with no findings and no unexplained allowlist suppressions.
- [ ] `pnpm lint`, `pnpm tsc --noEmit`, `pnpm test` and `pnpm build` pass.
- [ ] `pnpm audit --audit-level=high` reports no high or critical advisory.
- [ ] No provider secret identifier or environment read was added under `apps/web` or `apps/mobile`.
- [ ] No new execution sink (`eval`, `Function`, string timer, raw HTML, dynamic import of
      `vm`/`child_process`) was introduced in first-party source.
- [ ] No new runtime operation was executed without an allowlist entry, its test and its doc row.
- [ ] Every new outbound link goes through `linkPolicy`, with a reviewed host and scheme.
- [ ] New or changed headers exist in `securityHeaders.ts` and in every mirror
      (`_headers`, `index.html` meta, dev/preview server).
- [ ] New persisted or contract fields are project metadata only — no account, PII or location field.
- [ ] No new geolocation, media capture, socket, chat, DM, social or publishing capability.
- [ ] No new external asset origin; bundled starter assets remain curated and offline-capable.
- [ ] No child personal data appears in source, fixtures, logs or screenshots.
- [ ] Any deviation is recorded in the registry below with an ADR or issue reference.
- [ ] Repository build, tests and core learning flow still work with no provider credentials.

## Deviations

Every deviation from this baseline needs an explicit ADR (see `docs/architecture/adr/`) or a tracked
issue reference. A deviation without one is a `adr-deviations` finding.

| Control | Reason                                      | ADR/Issue |
| ------- | ------------------------------------------- | --------- |
| none    | No deviations recorded for the POC baseline | none      |
