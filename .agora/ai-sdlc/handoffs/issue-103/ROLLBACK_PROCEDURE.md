# Issue 103 Rollback Procedure

## Rollback Scope

Revert the issue #103 commit or PR merge commit affecting:

- `docs/safety/PRIVACY_THREAT_MODEL.md`
- `docs/safety/CHILD_SAFETY_PRIVACY.md`
- `docs/safety/WEB_SECURITY_BASELINE.md`
- `scripts/security-baseline.mjs`
- `scripts/security-baseline.test.mjs`
- issue #103 Agora handoff and evidence artifacts

## Rollback Steps

1. Revert the issue #103 commit or the eventual merge commit.
2. Run `pnpm install --frozen-lockfile` if dependencies are absent.
3. Run `pnpm build`.
4. Run `pnpm test`.
5. Run `node scripts/security-baseline.mjs`.
6. Confirm the safety docs no longer reference `PRIVACY_THREAT_MODEL.md` unless
   another change keeps that document in the release.

## Risk

Rollback removes the explicit local/remote AI privacy threat model and the
machine-checked learner-free-text logging guard. The pre-rollback baseline still
has general child-safety and web-security controls, but issue #103's outbound
data-flow justification and logs allowlist/denylist would no longer be present.

