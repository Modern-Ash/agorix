# Full creative editor in Map missions (#1184)

Map missions use the same creative scene editor as Crear. The learner can change objects, costumes, backdrops, sounds and any enabled block family while working toward a fixed curriculum goal. The goal, hints and Map progress remain part of the mission context.

## Project and migration

- One `studio-*` project is recorded for each world and mission. Its canonical program and creative state are the source of truth for the mission run.
- The first actor starts at the mission's original coordinates. The mission target is a fixed `reachCell` scene goal, rendered on stage. A cell goal only succeeds after a runtime step reaches it; placing the actor on the target and running an empty script does not count.
- On first open, supported saved blocks from the earlier `kids.<world>.<mission>` project are copied into the scene. The older project is retained as a backup. If conversion would lose a block, the learner stays in the old editor.
- Projects and deep links route a mission scene back to its Map context. The Projects list shows the scene as a mission rather than a second free scene.
- An off switch for `fullMissionStudio` restores the old editor if a deployment needs to roll back. It leaves saved projects intact.

## Learner authority and evidence

Ori's block idea remains a proposal until the learner accepts it. `Jugar` runs the canonical multi-actor project; only that runtime trace can complete the fixed goal. The completed scene and Map progress are saved locally. Hints persist with the project, and the code view derives from the same canonical program.

## Verification

Unit tests cover first creation, migration without deletion, goal identity, and no-step evaluation. Browser journeys cover the full editor on entry, an unsuccessful and successful run, Map progress after reload, Ori's unaccepted proposal, project reopening, and object/backdrop persistence on a phone. The old editor journeys remain under the rollback switch while their compatibility path is still supported.
