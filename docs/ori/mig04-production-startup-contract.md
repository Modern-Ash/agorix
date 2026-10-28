# MIG-04 production startup composition and compatibility

The integrated host can now be started through `startOriMig04ProductionStartup`, which accepts the existing TutorServer options plus explicit, trusted AuthService, project context, rollout and PostgreSQL dependencies. The integration retains the existing TutorServer feature options instead of constructing a stripped-down replacement. The production entrypoint `main.ts` continues to use the legacy listener by default.

## Fail-closed deployment contract

- `AGORIX_ORI_MIG04_HOST=integrated` **does not** activate the new host: `main.ts` rejects this request until a trusted deployment provider is wired in code. There is no silent fallback to legacy behavior.
- `AGORIX_ORI_MIG04_PILOT` remains forbidden except when explicitly `0`.
- Unix-socket startup is rejected by the integrated composition rather than silently switching transport.
- A durable PostgreSQL connection and a shared AuthService are mandatory; no in-memory session fallback.
- Existing TutorServer configuration is passed through to preserve legacy endpoints and policy hooks.

## Remaining blockers for #1007

Provide the real shared AuthService account/session repository and web cookie contract, connect project selection/logout/account deletion hooks, and invoke the integrated startup from the production entrypoint after verifying socket compatibility. Then run authenticated propose/decision/apply and cross-owner E2E tests. Until then, keep the pilot disabled and the legacy startup unchanged.
