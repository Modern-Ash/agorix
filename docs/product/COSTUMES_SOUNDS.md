# Costumes and sounds: first slice (issue #301)

Scratch separates Code, Costumes and Sounds. Agorix adopts the same mental model in small steps.

## Decision (first slice)

| Question        | Decision                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Costumes        | **Library only.** A learner switches the sprite among the built-in looks (see [ASSET_LIBRARY.md](ASSET_LIBRARY.md)). No paint editor and no image upload yet: uploads need size, type and content-safety rules we have not written. |
| Sounds          | **Library only.** A learner attaches built-in sounds to the project and can preview them. Sounds are synthesized tones, so nothing is bundled or fetched. No recording or upload yet.                                               |
| Playback blocks | Later. A sound is attached to the project but no block plays it yet; this slice makes the asset model and the place for it exist.                                                                                                   |
| Surface         | **Web first.** Studio (VS Code) keeps ignoring `metadata.actors`; it round-trips untouched.                                                                                                                                         |
| AI              | Not involved. Everything works with AI off.                                                                                                                                                                                         |

## Where things live

- The sprite pane under the stage has three tabs: **Properties**, **Costumes**, **Sounds**
  (Code stays in its own panel, always visible, as in a Scratch workspace).
- Costumes tab: one tile per look plus "Default"; the active look is highlighted and the stage
  updates immediately.
- Sounds tab: one checkbox per library sound (attach/detach) and a Play preview button.

## Persistence

`metadata.actors.items[].costume` (one id) and `metadata.actors.sounds` (up to 16 unique ids).
Both are optional, strict-validated, and preserved through local storage and `.agorix`
export/import. Unknown ids degrade to the default look / are listed but inert.
