# Kids v2: default availability (#524, #538)

## Owner decision, 2026-10-24

Enable all implemented creative Kids flags by default while the team debugs the complete experience. This supersedes the staged child-facing rollout below. A new browser now enables duplicate, zoom, context menu, shortcuts, puzzle shape, age bands, custom images, sound library, adult-supplied custom audio, Ori float, tutorial, and advanced operations. The adult Ori and custom-image controls still work. Account linking (`adultLink`) remains off because its verification service has no configured link secret or working SMTP; exposing a dead linking action would be misleading. Public sharing/remix stays excluded by ADR 0009. The requested Scratch capability parity is tracked in #538 and is not completed by switching flags on.

Ori stays visible on every Kids screen when adult suggestions are enabled. Outside programming editors, the floating surface gives a short contextual prompt from local, fixed copy; in the editor it opens a reviewable program proposal when one exists. The advanced editors retain their existing bounded "ask Ori" proposal controls. Presence does not imply a model request on every screen.

An existing browser with an explicit `agorix.kids.flags.v1` list keeps that local choice, including `[]`; the owner may change settings in Adultos. The real learner sessions #389/#413 remain pending and must not be inferred from automated tests.

The table below records the original staged plan and risks for debugging; its staged approval criteria no longer govern the creative defaults.

The v2 implementation is available in `main`. Availability and the default experience are separate decisions. The learner session in #389 has not happened; #413 cannot claim learner validation without its findings.

## Current production state

`apps/web/src/kids/kidsFlags.ts` defines the 13 flags. A fresh browser uses all except `adultLink`. An explicit list in `agorix.kids.flags.v1` replaces that default, including `[]` to disable it in that browser. Production ignores `?kidsv2=...`; the query parameter is for local development. Older saved projects and `.agorix` files are not changed by a flag choice.

| Flag           | Intended release stage      | Evidence already in the repo                                                         | Decision or gate still needed                                                                                                                        |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customImages` | 0: on now                   | `kids-custom-art`, `kids-images-panel`, `kids-image`; fresh-browser production smoke | Approved in #501/#524/#531. The child may add a local explorer or backdrop; only the adult changes the flag or overrides/removes bundled art.        |
| `duplicate`    | 1: editing                  | `kids-duplicate-block`, `kids-golden`                                                | Learner feedback #389/#413; check accidental duplication on tablet.                                                                                  |
| `zoom`         | 1: editing                  | `kids-editor-interactions`, `kids-golden`                                            | Learner feedback; check touch placement and orientation.                                                                                             |
| `contextMenu`  | 1: editing                  | `kids-editor-interactions`, `kids-golden`                                            | Learner feedback; check long-press discoverability.                                                                                                  |
| `shortcuts`    | 1: editing                  | `kids-editor-interactions`, `kids-golden`                                            | Learner feedback; preserve typing and touch behavior.                                                                                                |
| `soundLibrary` | 2: creative tools           | `kids-sounds`, `kids-golden`                                                         | Learner feedback; verify sound controls on tablet.                                                                                                   |
| `advancedOps`  | 2: advanced tools           | `kids-advanced-score-arithmetic`, `kids-golden`                                      | Learner feedback on advanced progression.                                                                                                            |
| `oriFloat`     | 3: learning flow            | `kids-ori-float`, `kids-golden`                                                      | Learner feedback; check that Ori never covers an action.                                                                                             |
| `tutorial`     | 3: learning flow            | `kids-tutorial`, `kids-golden`                                                       | Learner feedback; observe whether it helps without coaching.                                                                                         |
| `ageBands`     | 3: learning flow            | `kids-age-band`, `kids-age-palette`, `kids-age-code`, `kids-golden`                  | Adult review of band choice and learner feedback on the resulting palette and code tabs.                                                             |
| `customAudio`  | 4: adult local media        | `kids-sounds`, `kids-golden`                                                         | #501 allows adult-supplied local audio, but default activation awaits learner feedback and a release decision. No child upload.                      |
| `adultLink`    | independent account release | `kids-adult-link`, `kids-golden`                                                     | Configure `AGORIX_LINK_SECRET` and working SMTP; complete a real verification, six-digit link and unlink check. The server feature is currently off. |
| `puzzleShape`  | hold                        | `kids-puzzle-shape`, `kids-golden`                                                   | Product design decision: `docs/product/DESIGN_SYSTEM.md` does not adopt permanent Scratch-style puzzle styling by default.                           |

The automated `kids-golden` journey runs with every flag off and with every flag on at phone, tablet and landscape sizes. That protects compatibility, not learner acceptance. Record #389 findings and review them against #413 before claiming pedagogical validation.

## Release checks for a stage

1. Confirm the owner decision and update the table, default list and tests in one PR. For `adultLink`, first verify server mail delivery and a full adult verification/link/unlink journey; no child email or account is introduced.
2. Run `pnpm verify`, `pnpm format:check`, the relevant Playwright specs and `kids-golden` with flags off and on. Check reload and old saved data. A fresh browser must see exactly the approved defaults without editing storage.
3. After merge and separate deployment approval, run `pnpm deploy:web` and the public smoke. Record the served `/version.json` SHA and findings. Keep the previous Web image for rollback.

## Rollback and data

For one device, the adult can switch off `customImages` in Adultos. The stored flag list can also be set to `[]` to disable every v2 flag in that browser; do not clear project or image storage. For a broad release rollback, deploy a reviewed commit with the previous default list (or use `pnpm rollback:web` for the previous Web image). Existing devices with an explicit flag list keep that choice; a future broad rollout needs a separate global override before claiming that an image rollback disables every already-opted-in device. Neither rollback deletes `agorix.kids.*.v1` projects or `.agorix` exports.
