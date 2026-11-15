# Ori in Agorix Studio (VS Code): gap audit and integration contract

Issue #1619. This document distinguishes the VS Code extension from the Kids
"Studio" scene in the Web app. It is the product and architecture input for
#1621, #1620, #1623 and #1622. Status: design contract; the VS Code Ori journey
has not shipped.

## Learner outcome

Ori is the LLM prepared to teach children programming. In the VS Code surface,
the learner directs a bounded task, asks Ori for help when useful, inspects a
suggestion, predicts, decides, runs the canonical program and explains the
observed result. Ori's words never prove behavior or complete a mission.

## Baseline audit

| Capability                    | Web/Kids evidence                                                                                                                                | VS Code evidence                                                                                                                | Gap                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical project and runtime | `apps/web/src/kids/screens/EditorScreen.tsx`; `@agorix/persistence`, `@agorix/runtime`                                                           | `extensions/vscode/src/studioCore.ts`, `crossSurfaceCompatibility.test.ts`                                                      | Shared semantics already exist. Preserve the existing project envelope.                                                                                                                                               |
| Ori teaching response         | `apps/web/src/kids/kidsOriRemote.ts` calls `/api/tutor/ori`; `KidsOriChat.tsx` calls `/api/tutor/chat`                                           | `commands/companion.ts` creates deterministic turns; provider requests currently feed `build` through `studioProposalSource.ts` | Explain/debug/challenge/reflect do not yet use the Ori teaching service.                                                                                                                                              |
| Ori for the Kids Studio scene | `apps/tutor-api/src/server.ts` exposes `/api/tutor/studio/ori`; `packages/ori-agent/src/studio.ts` constrains one move/turn for a selected actor | No extension consumer                                                                                                           | This route accepts only Kids scene scripts (`studio-actor-*`) and an actor ID. It is not a general VS Code endpoint.                                                                                                  |
| Proposal review               | Kids editor reviews offers before canonical mutation; Web has an experimental server review widget                                               | VS Code has proposal sessions, diff, explicit apply/reject and hash freshness                                                   | Reuse Studio review controls, but connect a validated Ori response and retain its provenance. Do not treat the experimental Web widget as a shared authorization boundary.                                            |
| Project ownership             | Web has browser-local projects and optional account copies                                                                                       | VS Code can open local `.agorix` and authenticated server projects                                                              | Local help may use a bounded local snapshot. Server-owned proposal application needs authenticated project identity, current revision and a trusted server decision; local files cannot impersonate an owned project. |
| Offline path                  | Kids has deterministic Ori offers; `/api/tutor/studio/ori` has a fallback for its restricted scene                                               | Studio has built-in proposals and deterministic Companion turns                                                                 | Preserve the existing Studio fallback. Distinguish a real Ori model response from local deterministic help internally; do not imply the model responded when it did not.                                              |
| Release evidence              | Web has Kids and Ori tests                                                                                                                       | `docs/product/STUDIO_RELEASE_GATE.md` marks the older Web/Studio contract green                                                 | No VS Code Ori journey, installed-extension test or pedagogical acceptance evidence is covered by that green status.                                                                                                  |

The private account pilot under development in the primary checkout is not part
of the committed baseline audited here. Its flags and release state must be
verified before claiming any Web/Studio parity in #1622.

## Shared teaching contract

Use the provider-neutral Learning Companion contract in
`docs/architecture/LEARNING_COMPANION.md` and the existing Studio proposal
pipeline. Ori is the pedagogical identity; the model and provider remain
adapters. Do not route VS Code through the restricted Kids Studio scene API.

The request contains only:

- mission ID/version, learning target and locale;
- a validated, bounded canonical program snapshot and semantic hash;
- selected canonical node IDs, never a VS Code URI or file path;
- deterministic runtime observations and errors relevant to that selection;
- current hint level and the learner's current, explicitly submitted intent.

Keep account/session/project identifiers in a separate transport envelope when
server authorization needs them. Never place them inside `ProjectProgram` or
send unrelated project history, child identity, contact details or raw logs to
the model. Bound request bytes, response bytes and latency. Server and client
validate structured output, safe text and proposal scope. Model output is data,
never source to execute.

The response distinguishes `question`, `hint`, `explanation`, `challenge` and
`proposal`. It includes supported canonical node/evidence references,
provenance, and uncertainty where relevant. A proposal is a
`ProgramProposal` anchored to the request hash, with operations and rationale;
the learner can inspect, reject or modify it. For owned projects, the server
must recheck identity, revision and authorization before applying an accepted
proposal. Local project review remains explicit and hash-bound.

## VS Code interaction

- Use the current Companion commands, Workbench, code editor, Inspector and
  native diff. Do not introduce another canonical program or a second chat
  history as product authority.
- A selected node or failed step can focus a request. Show the runtime fact
  beside Ori's interpretation and offer a link back to the node/step.
- Silence remains the default. No model call occurs on ambient presence alone.
  Help level, learner agreements and request budgets apply to every Ori action.
- The learner may predict before choosing a proposal and compare that
  prediction with a fresh deterministic run afterward. Reflection is invited,
  not a condition for basic execution or completion.
- Use the project locale for child-facing copy; support keyboard and screen
  reader review of every operation and decision.

## Failure contract

AI disabled, no endpoint, no account where authorization is required, timeout,
invalid or unsafe output, exhausted budget, stale hash/revision, duplicate
decision and server conflict must leave the accepted program unchanged. The
editor and runtime continue to work. A deterministic hint or proposal may be
offered only when its scope can be proved locally. Never label fallback text as
a model answer. A rejected or modified proposal is not silently reissued.

## Delivery and proof

1. #1621 adds the secure Ori transport/adapter and deterministic fallback.
2. #1620 adds evidence-grounded child-facing help in the IDE surfaces.
3. #1623 connects Ori proposals to explicit review and authorized mutation.
4. #1622 proves Web → Studio → Web semantic equivalence and the full learner
   journey, updates the release matrix by implemented/default/experimental
   state, and records human pedagogical review. No efficacy claim follows from
   automated tests alone.

Each increment needs deterministic success and failure tests and an independent
PR. The product release gate requires CI plus human review; it does not follow
from this design document.
