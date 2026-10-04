# Accounts, Projects and Undo/Redo Release Gate

Issue #193 is the release gate for the account/project epic under #185. It records
the verification boundary for security, legacy migration, Undo/Redo, concurrency
and cross-surface E2E coverage.

## Automated Evidence

Run:

```sh
pnpm --filter @agorix/release-gate test
pnpm verify
```

The release gate package proves the account/project integration without requiring
a production auth UI:

- passwords are never persisted in plaintext and scrypt parameters are asserted;
- invalid auth failures are generic;
- register and sign-in rate limits are deterministic;
- session rotation, expiry and logout invalidation are covered;
- cookie posture and CSRF requirements are recorded for the HTTP layer;
- project endpoints resolve a session before every operation;
- IDOR is covered with account B using account A's exact project id;
- malformed and oversized projects are rejected before durable write;
- project logs contain ids/events, not raw `ProjectProgram` payloads;
- account-specific caches clear on logout and remain isolated by account;
- legacy `agorix:default-project` loads anonymously and imports only after an
  explicit action;
- failed imports preserve local work;
- imported server project semantic hash equals the legacy local hash;
- Undo/Redo covers add, delete, reorder, field edit, reset/clear and accepted AI
  proposal;
- rejected proposals, Run/Step and selection changes do not create history;
- stale revision and offline/reconnect paths fail with explicit conflict instead
  of silent overwrite.

Existing Web Playwright specs cover the browser shell portions of the required
matrix:

- `apps/web/e2e/smoke.spec.ts` covers local persistence, import/export,
  Undo/Redo, accepted/rejected proposal behavior, Run/Step non-mutation,
  tablet layouts and EN/ES locale switching.
- `apps/web/e2e/input-parity.spec.ts` covers desktop shortcut and tablet/touch
  input parity.
- `apps/web/e2e/adoption-gate.spec.ts` remains the human-observation gate and
  does not claim a real participant has run until filled in.

## Scenario Matrix

| Required scenario                         | Automated evidence                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| register -> create project -> edit/reload | `@agorix/release-gate` auth/project endpoint create/get/update                  |
| logout -> protected unavailable -> login  | session invalidation and endpoint auth resolution tests                         |
| A/B authorization isolation               | IDOR test using account A's exact project id from account B                     |
| legacy local -> explicit import           | legacy `ProjectStore` load plus explicit endpoint create                        |
| edit sequence -> Undo/Redo exact state    | block-editor history release matrix                                             |
| accepted AI proposal -> Undo/Redo         | canonical proposal-shaped transaction in release matrix plus Web smoke coverage |
| rejected AI proposal -> unchanged history | release matrix no-op transaction plus Web smoke coverage                        |
| Undo -> new edit -> Redo disabled         | release matrix branch test                                                      |
| Run/Step -> history unchanged             | release matrix no-op transaction plus Web smoke coverage                        |
| stale revision conflict                   | in-memory project repository conflict test through endpoint facade              |
| offline/reconnect conflict-safe           | local-only edit then stale save conflict test                                   |
| tablet controls + desktop shortcuts       | existing Web smoke and input parity specs                                       |
| EN/ES critical flows                      | existing locale switch smoke plus release-gate manifest assertion               |

## Known Limitations

- The current repository implements account/project service packages and an
  integration release gate, but the Web product has not yet shipped a real
  account UI or HTTP server endpoints for these flows.
- Cookie flags and CSRF are documented requirements for the HTTP integration
  layer. The release gate asserts the policy, not a deployed HTTP framework.
- No production child-account legal compliance is claimed. External product,
  privacy and legal review remains required before production child accounts.
- Human adoption evidence remains pending until a real participant session is
  executed and documented in `docs/product/ADOPTION_USABILITY_CHECKLIST.md`.
