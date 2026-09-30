<!-- agora-ai-sdlc:deterministic-operations/v1 -->

# Operational readiness — issue-87

Work: `issue-87-delivery/issue-87` · revision 1 · stage `operations`.

This artifact is non-authoritative preparation produced by the executor. Agora Flow
owns registration, gate evaluation and every lifecycle decision.

## Scope of change under review

Issue #87 delivers the structured `ProgramProposal` protocol in
`packages/proposals`. The uncommitted delta on branch `ai-sdlc/issue-87` at base
HEAD `385c711` is exactly two files:

| Path | Change |
| --- | --- |
| `packages/proposals/src/index.ts` | Adds `assertAllowedKeys` per operation type; every operation now rejects unexpected fields |
| `packages/proposals/src/index.test.ts` | Adds fixtures and 6 tests covering insert/change/remove, accept-commits-candidate, prose-independent diff, provider/code-payload rejection, nested path handling, PII/provider-free JSON round-trip |

No other product surface, dependency, manifest or configuration file changed. No
new runtime dependency was introduced.

## Deployment surface

- **POC target:** local-only. No hosted environment, account, server or migration
  exists for this repository state. "Deployment" for this Work is a green local
  build plus merge of the branch into `main` through a reviewed PR.
- **Build topology:** pnpm workspace. `pnpm build` runs `tsc -p` per package and
  `tsc && vite build` for `apps/web`. The proposals package is a build-time
  TypeScript library; it emits no deployable artifact of its own.
- **Client output:** `apps/web/dist` (index.html, one CSS and one JS bundle).
  The proposals package is reachable from the web bundle only through existing
  import paths; this change adds no new browser entry point.
- **Persistence:** browser `localStorage` behind `packages/persistence` with
  `agorix:` key prefix and a versioned schema. This change does not alter the
  stored program schema, so no data migration and no rollback of stored projects
  is required.
- **Provider boundary:** unchanged. `apps/tutor-api` and `packages/provider-runtime`
  are untouched; no provider credential is required to build, test or run the
  core learning flow.

## Deterministic verification

Verified tree state is **base HEAD `385c711` plus the uncommitted delta** described
above (2 files, +208 lines, both under `packages/proposals`). The delta is not
committed, so HEAD alone does not reproduce these results and `HEAD` does not
contain the behaviour under review. This is stated so a reviewer can reproduce the
exact tree, not only the commit id.

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm lint` | 0 | eslint clean, `--max-warnings=0` |
| `pnpm tsc --noEmit` | 0 | whole-workspace typecheck clean |
| `pnpm test` | 0 | 30 files, 488 tests passed |
| `pnpm build` | 0 | all packages and `apps/web` vite build succeeded |
| `pnpm security:check` | 0 | `security baseline: PASS` (4 bundle files, 4 safety docs, 191 text files) |

Per-package: `packages/proposals` 17/17 tests passed.
Full command output: `logs/deployment.log` and `logs/security-scan.log`.

### Executed verification report (current)

`aisdlc verify --swarm issue-87-delivery --work issue-87 --run` was executed in the
current operations iteration and persisted at
`.agora/ai-sdlc/verification/issue-87/VERIFICATION.json`
(sha256 `cfd0b350e20b839dd0c4260923d0fca1fe1c9ee02bcfe72304e81b4cbe903f50`):

- `executed: true`, `all_executed_commands_passed: true`
- `head`: `385c7119bded2aa3a5c9a2a792306314d2cd5e43`
- `pnpm build` -> passed, exit 0, 7.258 s
- `pnpm test` -> passed, exit 0, 1.485 s, 30 files / 488 tests

This is the allowlisted deterministic subset. It corroborates the `deployment`
evidence row recorded in Core from
`repo://.agora/ai-sdlc/operations/issue-87/logs/deployment.log`.

### Re-verification in the current operations iteration

All five gates were re-executed from scratch in this iteration against the
identical tree delta (2 files, +208 lines, `packages/proposals`) and the identical
base HEAD, and all exit 0:

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm lint` | 0 | eslint clean, `--max-warnings=0` |
| `pnpm tsc --noEmit` | 0 | whole-workspace typecheck clean |
| `pnpm test` | 0 | 30 files, 488 tests passed |
| `pnpm build` | 0 | all packages and `apps/web` vite build succeeded |
| `pnpm security:check` | 0 | `security baseline: PASS (scanned 4 built client bundle file(s); inspected 4 safety document(s); inspected 191 text file(s))` |

The `logs/deployment.log` and `logs/security-scan.log` under this directory were
rewritten by this iteration to match these results, so their digests changed and
`EVIDENCE-INDEX.md` carries the current values.

### Verification history and stability

`VERIFICATION.json` has now been regenerated on the same tree state and the same
base HEAD across five operations iterations. Every run reports
`executed: true` and `all_executed_commands_passed: true`; only elapsed times
differ. Digest chain, oldest to newest:
`416f9395…` -> `1ce45d37…` -> `5516e576…` -> `cfd0b350…` (current).

The `security:check` runs across all iterations produced byte-identical scan
counts (4 built bundle files, 4 safety documents, 191 text files), so the security
baseline is stable rather than marginal.

### Drift check performed in this iteration

Before re-running anything, this iteration confirmed the recorded artifacts still
described the live tree: HEAD is still `385c7119bded2aa3a5c9a2a792306314d2cd5e43`,
the product delta is still exactly 2 files / +208 lines under `packages/proposals`
(`src/index.ts` +16, `src/index.test.ts` +192), and the digests of both artifacts
and both logs matched the values indexed in `EVIDENCE-INDEX.md`. No drift.
`gh pr list --head ai-sdlc/issue-87 --state all` returns an empty list, so the
"uncommitted delta, no PR" residual risk below is still current and has not been
resolved by any intervening human action. All five gates were then re-run and all
exited 0 with identical totals (30 files / 488 tests; 4/4/191 scan counts),
confirming the recorded `deployment` and `security-scan` evidence still reproduces.

No transient probe was added in this iteration, so no residue check was required;
`git status` after the gate re-run still shows exactly the recorded 2-file product
delta.

## Acceptance-criteria coverage (proposed, not yet accepted)

Prepared for the human decision on criterion `source-issue`; the executor does not
record criterion stages.

| # | Criterion | Prepared evidence |
| --- | --- | --- |
| AC-001 | stale proposal cannot apply to changed base | `packages/proposals/src/index.test.ts` — `programSemanticHash` base binding; existing parse/review tests |
| AC-002 | unknown operation rejected | `assertOperation` switch has no default accept; new unexpected-field test rejects `openAiThreadId` and `source: "alert(1)"` with `INVALID_PROPOSAL` |
| AC-003 | resulting program must validate | `appendStatement`/`replaceStatement` call `validateProgram`; accept-commits-candidate test asserts equality with the previewed candidate |
| AC-004 | deterministic diff generated independently from model prose | "derives the same diff and candidate regardless of model prose or review order" test compares diff, projection, candidate and semantic hash across two proposals with different `purpose`/`rationale` |
| AC-005 | proposal serializable/auditable without PII | "round-trips the proposal itself through JSON without PII or provider identity" asserts regex absence of `email\|school\|address\|name\|age\|openAi\|anthropic\|thread` |
| AC-006 | no provider SDK types leak into protocol | domain package imports only workspace packages; `assertAllowedKeys` fails closed on provider-named fields |
| AC-007 | tests cover insert/change/remove/stale/invalid | added test asserts diff kinds `added`/`changed`/`removed`; stale and invalid paths covered by existing and new tests |
| AC-008 | integrates with UI boundary from #75 | re-checked this iteration, source-verified. Web boundary: `createWebProposalCardView` is exported from `packages/proposals/src/index.ts:259` and called at `apps/web/src/App.tsx:425`, alongside `acceptProposal`/`rejectProposal` at lines 653/663. Studio boundary: `extensions/vscode/src/studioCore.ts` imports and re-exports `createProposalReview`, `acceptProposal`, `rejectProposal` and the `ProgramProposal`/`ProposalReview` types (lines 4-10, 48, 98-116). **Correction to the earlier row in this file:** `createStudioProposalDiffView` is exported and unit-tested but is **not** consumed by `studioCore.ts` — `grep` over the repo finds it only in `packages/proposals/src/{index.ts,index.test.ts}`. `git show HEAD:extensions/vscode/src/studioCore.ts` also has zero occurrences, so this is a pre-existing state, not a regression from this delta. The delta changes neither signature and the package stays UI-framework-free. |

`aisdlc verify` reports `mechanically_satisfied: false` for every criterion. That
is expected: the deterministic matcher is keyword-based and does not resolve
these behavioral criteria. Command success is not criterion satisfaction.

## Source-verified conformance against issue #87 (new in this iteration)

The table above covers the issue's eight `Acceptance` checkboxes. This section
covers the two other normative blocks in the issue body — `Protocol requirements`
and `Supported initial operations` — which no earlier iteration reconciled
against source. The issue text was read from GitHub in this iteration
(`gh issue view 87`); it is still `OPEN` with all eight checkboxes unticked.

### Protocol requirements

| Required by issue | Present | Where | Verdict |
| --- | --- | --- | --- |
| schema/version | yes | `PROGRAM_PROPOSAL_SCHEMA_VERSION` (`index.ts:6`), validated `index.ts:177-179` | met |
| proposal id | yes | `ProgramProposal.id` (`index.ts:19`), `assertBoundedString` 1-120 at `index.ts:180` | met |
| base program version/hash | yes (hash only) | `baseProgramHash` (`index.ts:20`), bound via `assertFreshBase` `index.ts:408-417` | met |
| capability/source metadata | yes | `ProposalSource { kind, capability? }` `index.ts:12-15`, `assertSource` `index.ts:434-442` | met |
| pedagogical purpose | yes | `purpose` (`index.ts:22`), 1-240 chars at `index.ts:183` | met |
| affected canonical node ids | yes | `affectedNodeIds` (`index.ts:23`), `assertStringArray` `index.ts:511-516` | met |
| structured operations/patch | yes | `ProposalOperation` union `index.ts:28-48`, validated `index.ts:444-480` | met |
| child-facing rationale | yes | `rationale` (`index.ts:24`), 1-800 chars at `index.ts:184` | met |
| **optional concept tags** | **no** | absent from `ProgramProposal`; not in the top-level allowlist `index.ts:167-176` | **gap — see below** |
| no executable code payload as authority | yes | `assertPlainObject`/`assertAllowedKeys` reject undeclared keys; operations carry validated `Statement` values | met |

### Finding P-1 — optional concept tags cannot be carried (fail-closed, not fail-open)

The issue lists "optional concept tags" among the fields a proposal must include.
No such field exists in `ProgramProposal`, and because the top-level validation is
a strict key allowlist, a proposal that *does* carry one is rejected rather than
ignored. Executed proof in this iteration: a transient conformance probe was
added to `packages/proposals/src`, run under Vitest, and removed in the same
iteration (`git status` confirms the tree is back to the recorded 2-file delta).
It asserted the accepted key set and probed four plausible tag key names:

```text
CONCEPT_TAG_PROBE {"conceptTags":"REJECTED INVALID_PROPOSAL",
                   "concept_tags":"REJECTED INVALID_PROPOSAL",
                   "concepts":"REJECTED INVALID_PROPOSAL",
                   "tags":"REJECTED INVALID_PROPOSAL"}
accepted proposal keys: affectedNodeIds, baseProgramHash, id, operations,
                        purpose, rationale, schema, source
```

Repo-wide search finds no `conceptTags` symbol anywhere outside this artifact.

Security impact is favourable — the fail-closed allowlist is the control that
makes AC-006 hold — but it means the requirement is unmet *and* unextendable
without a deliberate change to the protocol contract. This is a product decision:
either add the optional field to `ProgramProposal` and its allowlist, or record
that concept tagging is deliberately deferred out of #87. The executor does not
make that call and does not widen scope.

### Finding P-2 — `reorder` is listed by the issue but not implemented

The issue's `Supported initial operations` lists five candidates "such as": insert
node/subtree, replace allowed field/value, replace bounded subtree, remove node,
and **reorder allowed nodes**. The protocol defines four operations
(`appendStatement`, `replaceStatement`, `replaceStatementField`,
`removeStatement`) and no reorder operation exists. Executed proof:

```text
REORDER_PROBE {"reorderStatements":"REJECTED UNKNOWN_OPERATION",
               "moveStatement":"REJECTED UNKNOWN_OPERATION",
               "reorder":"REJECTED UNKNOWN_OPERATION"}
```

"such as" grants latitude over the bounded set, and reorder is not part of the
issue's `Acceptance` checklist, so this is not necessarily a defect. It is
nonetheless a visible divergence between the issue text and the delivered
protocol, and `reorder` is a live learner-facing capability in
`docs/product/INTERACTION_MODEL.md` and
`docs/product/TRANSPARENT_PROGRAMMING_UX.md`. A human should confirm deferral
explicitly before accepting criterion `source-issue`; an unremarked gap is the
kind of thing that surfaces later as "the issue said so".

### Application rules 1-8

All eight are implemented in source: schema validation (`parseProgramProposal`,
`index.ts:162-164`), base-hash verification (`assertFreshBase` at
`index.ts:200`, re-checked at `index.ts:238` and `index.ts:252`), operation
validation against the allowed model (`assertOperation`), candidate computation
(`applyProposalOperations` `index.ts:284-335`), canonical validation with
`INVALID_CANDIDATE` wrapping (`index.ts:327-334`), deterministic diff derived
from projections rather than prose (`createProposalReview` `index.ts:195-220`),
learner decision gating, and mutation only after accept (`acceptProposal` /
`modifyProposal`; `rejectProposal` returns the accepted program unchanged).

## Residual risk and open clarifications

- **Engine warning.** The workspace declares `node >=22 <23`; the local shell runs
  node 20.19.0. pnpm emits `WARN Unsupported engine` and continues. All commands
  still exit 0. Not introduced by this Work; recorded for transparency.
- **Reviewer separation.** This Work's construction and this operations
  preparation were produced by `project:ai-opencode`. An independent reviewer
  (different agent or human) has not yet reviewed the delta. AGENTS.md asks for
  this where practical; the human gate is where it is resolved.
- **Node-id addressing.** Nested `body[n]` paths are supported; an unsupported
  segment raises `UNSUPPORTED_PATH`. The supported addressing grammar is
  implemented in `packages/proposals` and is not extended by this change.
- **Uncommitted delta, no PR.** Re-confirmed in this iteration: the entire
  product change for this Work is still uncommitted on `ai-sdlc/issue-87`
  (`git status` shows `packages/proposals/src/{index.ts,index.test.ts}` modified,
  nothing staged, no new commit on top of `385c711`). No PR exists for this
  Work. Every result recorded above therefore describes a tree a reviewer can only
  reproduce from a dirty worktree, and the `VERIFICATION.json` `head` field
  points at a commit that does not contain the behaviour under review. Both
  rollback Procedures A and B assume a merged branch. Committing and opening the
  linked PR is the prerequisite for any merge, and is outside this iteration's
  authority (`git.read` only; no `git.write` capability in the execution
  requirements). This is flagged as a delivery blocker for the human, not as a
  gate failure: Core reported no git-policy issue.
- **Protocol gap vs. issue text (P-1).** "Optional concept tags" from the issue's
  `Protocol requirements` is not representable: the strict top-level key allowlist
  rejects a proposal that carries one. Fail-closed, but the requirement is
  unmet. Needs a human product decision (add the field, or record deliberate
  deferral); not a security defect and not fixable without a contract change.
- **Scope divergence vs. issue text (P-2).** `reorder` appears in the issue's
  suggested operation set and is not implemented. Permissible under "such as",
  but it should be an explicit human deferral rather than an unremarked gap,
  especially since reorder is a live learner-facing capability in the product
  docs.
- **Open clarifications:** none recorded in Core for this Work. The two findings
  above are prepared for the human and are deliberately not raised as Core
  clarifications, since opening one is a governance action outside this
  iteration's authority.

## Readiness determination

The change is a contained, additive hardening of one domain package plus its
tests. Every deterministic gate available without credentials is green at the
recorded base HEAD, the security baseline passes, and no schema, dependency,
deployment target or provider boundary moved. All eight `Acceptance` checkboxes
map to source-verified behaviour, and application rules 1-8 are implemented.

Two divergences from the issue's non-acceptance normative text (P-1 concept tags,
P-2 reorder) were identified in this iteration. Neither is a security regression
and neither is in the `Acceptance` checklist, so neither blocks delivery on its
own — but both should be consciously accepted or deferred by the human rather
than discovered later.

The change is **not yet deliverable as recorded**: the delta is uncommitted and
no PR exists, so the green results above are not reproducible from the recorded
`head` commit alone. That, plus the remaining human steps, is what blocks merge:

1. Commit the `packages/proposals` delta on `ai-sdlc/issue-87` and open the PR
   linked to issue #87 (human or explicitly delegated executor; not done here).
2. Resolve P-1 and P-2 above — accept or defer explicitly.
3. Accept criterion `source-issue` at stage `accepted` (human decision).

### Prepared for the `completion` gate in this iteration

- Artifacts `operational-readiness` (this file) and `rollback-procedure`
  (`ROLLBACK-PROCEDURE.md`) were registered in Core against this revision, both
  produced by `project:ai-opencode`, both pointing at their repository paths.
- Evidence `deployment` (success) and `security-scan` (success) were recorded in
  Core against this revision, produced by `project:ai-opencode`, each referencing
  its re-run log under `logs/`.

Both registrations carry observed facts only. No approval was recorded, no
criterion stage was set, no lifecycle transition was attempted and no git write
was performed. Step 3 — the human-owned `accepted` stage for criterion
`source-issue` — remains the open blocker for the gate.
