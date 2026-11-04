# OpenCode native smoke evidence — operator record

This record must be filled from an **actual pinned-version OpenCode runtime**. Do not mark any check as passed based solely on mocked tests or a self-declared isolation flag.

## Environment (fill in before running)
- OpenCode version / commit: NOT VERIFIED
- Runtime image digest: NOT VERIFIED
- Node version: NOT VERIFIED
- Disposable workspace identifier: NOT VERIFIED
- Effective config source and timestamp: NOT VERIFIED
- Network egress policy evidence: NOT VERIFIED
- Filesystem mounts and permissions evidence: NOT VERIFIED
- Secret/credential absence evidence: NOT VERIFIED

## Execution
Run `npm test` and `npm run check` first. In a separately isolated environment, run `ORI_OPENCODE_SMOKE=I_HAVE_VERIFIED_ISOLATION npm run smoke:opencode` only after independently checking isolation.

| Gate | Result | Evidence |
| --- | --- | --- |
| Effective permission default deny | NOT RUN | |
| No permissive agent overrides | NOT RUN | |
| MCP disabled | NOT RUN | |
| Shell denied by runtime | NOT RUN | |
| Read/write/edit denied by runtime | NOT RUN | |
| Network egress restricted | NOT RUN | |
| Session create/message/delete | NOT RUN | |
| Hint passes pedagogical guard | NOT RUN | |
| No project mutation | NOT RUN | |
| Timeout/cancellation | NOT RUN | |

## Decision
**BLOCKED** for child-facing use until every gate has independent evidence and educator/security review.

The OpenCode adapter remains experimental. Agorix changes, if any, target only `integration/ori`.
