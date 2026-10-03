# Input parity matrix (issue #201)

## Purpose

Scratch-familiar direct manipulation must stay usable on tablets and accessible without drag. This matrix defines, for each critical block operation, the pointer, touch, keyboard/non-drag and screen-reader path. It extends [INTERACTION_MODEL.md](INTERACTION_MODEL.md) and the drag grammar from #198-#200. Every path commits the same canonical transaction, so the canonical program never depends on the input method.

## Matrix

| Operation            | Pointer                                                   | Touch                                          | Keyboard / non-drag                                                      | Screen reader                                                                                          |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Add                  | Click palette button, or drag palette tool to a snap slot | Tap palette button (drag optional)             | Focus palette button, Enter/Space; new block takes focus                 | Status: "{name} added at position {n} of {total}."                                                     |
| Reorder              | Drag block to a snap slot, or Up/Down buttons             | Up/Down buttons (44px)                         | `Alt+ArrowUp` / `Alt+ArrowDown` on the block, or Up/Down buttons         | Status: "{name} moved to position {n} of {total}."; block described as "Position n of total, level l." |
| Delete               | Delete button                                             | Delete button (44px)                           | `Delete` on the block, or Delete button; focus moves to neighbour/parent | Status: "{name} deleted. {total} blocks left."; focus falls back to the palette when empty             |
| Duplicate            | Duplicate button                                          | Duplicate button (44px)                        | `Ctrl/Cmd+D` on the block, or Duplicate button; copy takes focus         | Status: "{name} duplicated. Copy is at position ..."                                                   |
| Inline edit          | Click number field, type, blur/Enter                      | Tap field (numeric keypad), Enter/blur commits | Tab to field, type, Enter commits, Escape cancels                        | Field labelled "{block} {field}"; status: "{name} {field} set to {value}."                             |
| Nest                 | Drag onto "Drop here" slot, or Nest button                | Nest button (44px)                             | `Alt+ArrowRight` (into previous container), or Nest button               | Status: "{name} nested inside {parent}, position ..."                                                  |
| Outdent              | Drag out of container, or Outdent button                  | Outdent button (44px)                          | `Alt+ArrowLeft`, or Outdent button                                       | Status: "{name} moved out of {parent}, position ..."                                                   |
| Navigate             | Click block                                               | Tap block                                      | `ArrowUp` / `ArrowDown` moves focus between blocks (no mutation)         | Shortcut hint exposed via `aria-describedby`; `aria-keyshortcuts` on each block face                   |
| Insert at a position | Drag palette tool to a snap slot                          | Add (appends), then Up/Down/Nest buttons       | Add (appends), then `Alt+Arrow` shortcuts                                | Position announced after each step                                                                     |

## Requirements mapping

- 44px targets: block action buttons, block faces, numeric fields and palette tools are at least 44px (`.block-card .block-actions button`). Asserted in Playwright.
- No hover-only state: block actions are always rendered and visible (opacity >= 0.7 without hover). Drop slots are drag-only affordances and are `aria-hidden`; each has a button/keyboard equivalent above.
- Drag handles on touch: HTML5 drag-and-drop is a pointer convenience. Touch users are never required to drag; every drag operation has a button path.
- Orientation: React state and canonical persistence are independent of viewport; Playwright asserts the canonical hash is unchanged across portrait and landscape and across input methods.
- Virtual keyboard: the numeric field scrolls itself into view on focus (`scrollIntoView({ block: "nearest" })`); commit is on Enter/blur with Escape to cancel, so no hidden Apply button is needed.
- Focus: after add, move, duplicate, nest and outdent focus follows the affected block; after delete it moves to the same-index neighbour, then the previous block, then the parent, then the first palette tool.
- Live announcements: a single polite `role="status"` region announces add, move, delete, duplicate, nest, outdent and value edits in the active locale (en/es).
- Reduced motion: the global `prefers-reduced-motion` rule removes transitions and animations; asserted in Playwright.
- Stylus: treated as pointer where the platform provides pointer events; nothing requires it.

## Invariants

- All paths call the same canonical transaction (`commitProjection`); no path mutates the program invisibly.
- AI proposals are not touched by this matrix: they stay proposals until the learner accepts, rejects or modifies them via the existing explicit controls.

## Known gaps

- Touch-driven drag (pointer-event based) is not implemented; HTML5 drag-and-drop is unreliable on some touch browsers, hence the always-available buttons.
- Palette add always appends; positioned insert is add followed by reorder/nest.
- Screen-reader testing is semantic (accessible name/description/status assertions); no manual VoiceOver/TalkBack pass is recorded.
