# Worlds visual assets and licensing

Status for the four starter Worlds (`space.trailhead`, `ocean.reef`, `robots.workshop`,
`city.crossing`), as presented by `apps/web` (issue #202). Contract: `docs/product/WORLDS.md`.

## Inventory

| Asset                                             | Source / creation method                                                                | License                                                  | Attribution | Reduced-motion alternative                        | Localization status |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------- | ------------------------------------------------- | ------------------- |
| Sprite and goal glyphs                            | Unicode emoji characters rendered by the learner's system emoji font; no files shipped. | Characters are not licensed art; font is the platform's. | None        | Static glyphs; position jumps instead of gliding. | Language-neutral    |
| Stage backgrounds, lines, goal and sprite colors  | Original flat SVG shapes and CSS color tokens in `apps/web/src/App.css`.                | Same license as the repository.                          | None        | Static fills.                                     | Language-neutral    |
| World badge, route label, success and retry marks | Original text and Unicode symbols (`★`, `↻`) with i18n copy.                            | Same license as the repository.                          | None        | Static; meaning carried by text and shape.        | English, Spanish    |
| Path trail and goal ring                          | Original SVG primitives drawn from runtime observations.                                | Same license as the repository.                          | None        | Static; no pulse.                                 | Language-neutral    |

No third-party, generated or Scratch-derived artwork is included. Agorix World identity comes from
the `Agorix World` badge, per-World palettes, the World route label and runtime-grounded feedback,
not from Scratch characters, sprites, sounds or the Scratch cat.

## Replacement guidance

Schools or families can replace glyphs in `WORLD_GLYPHS` (`apps/web/src/App.tsx`) and colors under
`[data-world]` in `apps/web/src/App.css`. Replacement art must not change runtime math, hit boxes,
mission predicates or canonical program state, and needs alt text from `WorldCopy`.

## Adding shipped art later

Record source, license, attribution, modification notes, localization status, reduced-motion
alternative and replacement guidance per `WORLDS.md`. Generated art also records tool/provider,
prompt summary, date and editor, without child data or school identifiers.

## Feedback provenance

World feedback text comes from World copy chosen by runtime state (`reachedGoal`, run status) and is
labelled as a runtime fact. Model or AI output is never rendered inside the World as observed fact.
