# Lists of words: a design to decide

Not built. Today a list holds **numbers only**. A child who comes from Scratch will want lists of words (names, a shopping list, a quiz with several answers), and the Scratch importer and exporter leave them out for that reason. This says what exists, what a word list would touch, and the four decisions that are the owner's, with a recommendation for each. Nothing is written until they are decided.

## What exists

- **Word values** (#1319): up to three text variables, each at most 20 letters with no control characters, empty at the start. A child sets them with a short word, with another word variable, or with what they type (`askText`). They show in the same "Data after Play" panel as the numbers.
- **Number lists:** up to three, empty at the start, up to 100 numbers, with add, remove at, insert at, replace at, item of and length.
- **Privacy rules that already hold:** a word the child writes stays on the device. The input Ori's model sees is built from block kinds and closed choices only (`createOriStudioInput`), never values. Findings sent to a provider carry kinds and counts only. A typed answer is kept only in the local input log of the run so a replay is exact.

## The new thing a word list would be

A list whose items are words of the same kind as a word variable (at most 20 letters, no control characters). It is empty at the start, like every list and word value in the scene, so **a word list never puts a child's text in the program**: the items exist only while the program runs. That is different from a word typed into a "say" block, which is part of the program today. Exporting a scene (`.agorix` or `.sb3`) therefore carries the list's name and no items.

## Decisions

**1. A separate kind of list, or one list that holds numbers or words?**
Recommended: **separate** (`wordLists`, next to `textVariables`, as word variables are next to number variables). The scene already splits numbers and words this way, so a block never has to ask "is this item a number or a word?", the validator and the runtime keep one type per list, and the code views can write the item type plainly. The cost is a second set of blocks for the child. The alternative (typed lists) is closer to Scratch but spreads a "number or word" check through every block, reporter and projection.

**2. How big?**
Recommended: **up to 3 word lists** (their own count, not shared with the number lists), **up to 20 items** each, **each item up to 20 letters**. Smaller than the number lists on purpose: a child's text takes room on a small screen and is read, not summed. The panel shows the first 10 items and "and N more".

**3. How do words get in?**
Recommended: from what the child **types** (the answer of an ask block, stored in a word variable, then "add this word to the list"), from **another word variable**, and from a **short word typed into the block** (the same allowance as a word variable today). No word comes from Ori, a file or the network.

**4. Where does the child's text appear?**
Recommended: **the same "Data after Play" panel** that already shows word variables, as plain text (never as markup), truncated as above. No new surface, no text in the trace as a string the model reads (the trace records that a word was added and its length, as it does for a typed answer), no text in a finding or in anything sent out.

## What it touches

A word list needs its own statements and reporters in every layer, which is why it is a design and not a slice: the program model and validator, the runtime and its world state, the stage and the Data panel, the block editor, the four code views, the proposals pack map, the Studio palette and its tooltips, Ori's findings (a list nothing was ever added to, as `wordNeverSet` does for a word), the Scratch importer (`data_*list` blocks on a word list) and the Scratch exporter (lists are not written today). About a dozen packages and folders.

## Increments, each a reviewable change

1. Model, validator and runtime, no interface: the list, the blocks, the caps, the failure paths.
2. The four code views and the block editor, with the correspondence tests.
3. The Studio: palette, the Data panel, tooltips, accessibility, keyboard.
4. Ori's finding and the Scratch importer.
5. The Scratch exporter, so a scene with a word list round-trips.

## What I need from the owner

Pick, or change, the four recommendations above. If the answer to 1 is "typed lists", the plan changes shape (one list type, a "number or word" check in every block) and I would write that variant before building.

## Risks to name

- **A child's words are shown back in a panel.** The rules above keep them on the device and out of every finding, but this is the first list whose contents are child text, so it deserves the same privacy review the typed answer got (#1304).
- **Moderation is out of scope.** The scene does not judge what a child types; it only bounds its length and characters. If that is not acceptable for lists, it is not acceptable for word variables either, and that is a separate decision.
