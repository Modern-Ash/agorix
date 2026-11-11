# Lists that hold numbers or words

Decided (owner, 2026-11-11): **one kind of list that holds numbers or words, as Scratch does.** This replaces the first proposal, which kept word lists apart. It says what that means for the model and for the child, the rules that keep a child's words safe, what it touches, and the increments. Nothing is built yet.

## What exists

- **Word values** (#1319): up to three text variables, each at most 20 letters with no control characters, empty at the start, shown in the same "Data after Play" panel as the numbers.
- **Lists:** up to three, empty at the start in the scene, up to 100 items, **numbers only**, with add, remove at, insert at, replace at, item of and length.
- **Privacy rules that already hold:** a word the child writes stays on the device. The input Ori's model sees is built from block kinds and closed choices only. Findings sent to a provider carry kinds and counts only. A typed answer is kept only in the local input log of the run.

## What changes

A list item may be a **number or a word** (a word: at most 20 letters, no control characters, the same rule as a word variable). The list statements and reporters stay the same (`listAdd`, `listRemoveAt`, `listInsertAt`, `listReplaceAt`, `listItem`, `listLength`); what widens is what they may hold and carry:

- The value of an add, insert or replace may be a number or a word (a word typed into the block, a word variable, a join).
- `listItem` gives back whatever the item is.
- Because Scratch lists are mixed too, the importer and the exporter map them one to one.

### One rule for using a number as a word and a word as a number

The cost of mixed lists is that an item can land where the other kind was expected. The runtime decides it in **one place**, with Scratch's rules, so no block has to ask:

- A number used as a word is written with its digits ("12").
- A word used as a number is its value if it reads as a number ("12"), and 0 if it does not.
- Two items are equal when they are the same number, or the same word letter for letter ignoring capitals; a number and a word are equal only if the word reads as that number.

The Studio checks (`checkedNumber`, `checkedText`) accept `listItem` in both kinds of slot, and the four code views write the item as the plain value, since the target languages also coerce or hold mixed lists.

## Rules for a child's words (decided with the first proposal, unchanged)

- **A list never puts a child's text in the program.** It is empty at the start, so the items exist only while the program runs. A word typed into an add block is part of the program like a word typed into a "say" block today; the list's contents are not. A scene exported as `.agorix` or `.sb3` carries the list's name and no items. (The core model may hold starting items; the Studio refuses them, as it does for numbers.)
- **No text in the trace as a string a model reads.** The trace records that an item was added and, for a word, its length, as it does for a typed answer. A finding or anything sent out carries kinds and counts only.
- **Where the words appear:** the same "Data after Play" panel, as plain text (never as markup), the first items shown and "and N more" after a fixed number of characters. No new surface.
- **Where the words come from:** what the child types (an ask block's answer, kept in a word variable), another word variable, or a short word typed into the block. Never Ori, a file or the network. (A Scratch import brings a list's items only as far as the scene's starting rule allows: empty.)
- **Moderation is out of scope**, as for word variables: the scene bounds length and characters, it does not judge words.

## Caps (as recommended; say if you want others)

At most **3 lists** (unchanged), **100 items** (unchanged), **20 letters** per word. The panel shortens a long list by characters, not by item count, so a list of numbers keeps showing as it does today.

## What it touches

The program model and validator (items may be words, with the word rule), the runtime and its world state (the item type, the one coercion rule, the trace without text), the stage's Data panel, the block editor and the Studio palette (an add block that takes a number or a word, with tooltips and accessibility), the four code views, Ori's findings (a list nothing was ever added to), the Scratch importer (`data_*list` blocks) and the Scratch exporter (lists are not written today). No new statement kinds, so the proposals pack map and the closed idea contract do not change.

## Increments, each a reviewable change

1. Model, validator and runtime: mixed items, the coercion rule, the word rule, the trace without text, with tests for success and failure, and the existing numeric lists unchanged. No interface.
2. The four code views and the block editor, with the correspondence tests.
3. The Studio: the add block with a number or a word, the Data panel, tooltips, accessibility, keyboard.
4. Ori's finding and the Scratch importer.
5. The Scratch exporter, so a scene with a list round-trips.

## Risks to name

- **Mixed lists make comparisons and arithmetic depend on the one coercion rule.** It is the same rule Scratch uses, written and tested in one function, but a child who adds "3" and 3 to a list will see them behave alike. That is Scratch's behaviour and the point of choosing it.
- **A child's words are shown back in a panel.** The rules above keep them on the device and out of every finding, but this is the first list whose contents can be child text, so it gets the privacy review the typed answer got (#1304) before increment 3.
