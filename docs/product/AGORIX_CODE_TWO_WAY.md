# Agorix Code, both ways (#1613, #1614)

Decision (owner, 2026-11-16): text should become blocks as well as blocks becoming text, as simply as possible.

## What stays true

- The canonical program is the only thing that runs. Text is **read** into the canonical program by a parser; the text itself is never executed, and the result must pass the same validator as any program.
- A text edit is the learner's own change, not an AI change, so it does not go through a proposal; it is one visible, undoable step like any block edit, and the blocks and the text stay two views of the same program.
- Nothing about this needs AI or credentials.

## Why a grammar, not a model

A language model is not used to read the text:

- the text is the learner's own words, and **no learner text leaves the device**; sending it to a model to be understood would break that;
- the project must work without AI, and a grammar gives the same answer every time;
- Agorix Code is small and regular (one statement a line, two-space indentation), which is what a grammar is good at.

A model could help later in a narrow way: explaining a syntax error in words. That would use only the closed error code and the line number the parser already gives, never the learner's text, and it would go through Ori's usual path. It is not built.

## The simple version (v1, this change)

`parseAgorixCode(text, base?)` in `packages/agorix-code/src/parse.ts`:

- Understands the beginner subset: variable declarations (with `show`), the three hats (`when start`, `when key "K" pressed`, `when message "M" received`), and `move`, `turn`, `go to`, `wait`, `say`/`think` (with `for N seconds`), `show`, `hide`, `set`, `change`, `repeat`, `forever`, `if key K is down` with `else`.
- Reading the text a program was shown as, with that program as `base`, gives back **the same program**: variables are found by name, the n-th script keeps the n-th script's id. An edit keeps what it did not touch.
- Anything else is **refused with a code and a line number** (`unknownLine`, `badIndent`, `badNumber`, `badText`, `unknownName`, `elseWithoutIf`, `emptyBody`, `tooDeep`, `tooLong`, `notValid`, `emptyText`), never guessed. A program that uses more than the subset stays editable with blocks; the text view of it stays read-only.
- Limits: 20,000 characters, 400 lines, 12 levels deep, checked before anything is read.

## The editable Code tab (built)

In the Agorix Code tab of the Studio, "Editar el texto" opens the text. It says "Se entiende" or the first problem as "Línea N: …" (es and en), and "Aplicar" is on only when the text reads into a program the scene accepts; it is applied as one undoable step (`recordCanonicalTransaction`). The button is offered only when the program is editable as text: reading the text it is shown as must give back exactly the program, so an edit can never drop a block the text did not show. Otherwise the tab says to edit with blocks. A variable typed by hand gets the next free `studio-var-N`; changing which characters exist is not possible from text (a script the scene has no character for is refused as `notValid`).

## Next

1. Widen the subset a block family at a time (sounds, pen, lists, custom blocks, sensors), each with the round-trip test on every statement it adds.
2. Python and TypeScript stay display-only for now; Agorix Code is the language designed to be read both ways.
