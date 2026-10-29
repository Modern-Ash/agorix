# Audit before retiring `/advanced`

Date: 2026-10-29. Decision: **keep the route for now**. This is a product and compatibility audit, not an approval to keep two learner experiences indefinitely.

The approved Kids design says the prototype replaces the old Web editor. The advanced level belongs inside the Kids map and keeps its visual language; `/advanced` is a parked editor, not that level. Kids' three-stage advanced journey has automated browser coverage. The older editor is still loaded by `apps/web/src/main.tsx` and included in the production smoke.

| Retirement check               | Current evidence                                                                                                                                                                                                                                        | Result                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Main learner journey           | `/` opens Kids; `apps/web/e2e/kids-advanced-journey.spec.ts` covers missions, three stages, Ori review, runtime and code projections                                                                                                                    | Covered by automation; learner validation evidence must be checked separately |
| Existing creative capabilities | `docs/product/SCRATCH_CAPABILITY_AUDIT.md` records general Kids scene progress and remaining gaps. The older editor exposes actor, look, sound, event, variable and code controls. Kids has several of these but not every general authoring operation. | Do not claim full functional parity yet                                       |
| Saved work                     | The older editor uses its account/default-project store; Kids uses `agorix.kids.projects.v1/v2`. There is no verified import/migration journey from all older projects into Kids.                                                                       | Retiring the route could strand saved projects                                |
| Deep links and regression      | `apps/web/e2e/kids-shell.spec.ts` and the production smoke explicitly check `/advanced`.                                                                                                                                                                | Route removal requires test and link updates                                  |
| Account entry                  | The old editor has `AccountUi`; Kids has `AdultAccountCard` under Adultos, but the `adultLink` flag and server mail service are currently off.                                                                                                          | Complete the private adult rollout first                                      |

## Exit workflow

1. Inventory the older editor's general operations and stored project formats against a current Kids free-scene build. Record each missing operation as a bounded issue, without duplicating domain packages.
2. Provide a tested import or export bridge for old local and account projects, with explicit user choice and no silent program mutation. Keep `.agorix` portability and canonical runtime equivalence.
3. Validate Kids with a learner and an adult on tablet and desktop; record actual findings. Automated tests alone do not establish usability or learning outcomes.
4. After owner review, announce the old route's sunset, keep a reversible release, update the production smoke and documentation, and only then remove the route and its old UI bundle. Preserve projects and account data.

This audit does not affect Ori MIG-04 authorization. Account registration, Kids local projects and legacy account projects remain separate until a reviewed integration joins them.
