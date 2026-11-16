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

## The wider subset (built)

The parser now also reads every block whose parts are only words and numbers: motion (`bounce on edge`, `point in direction`, `point towards`, `set/change x/y`, `glide to`, `go to random position | mouse pointer | "actor"` and the `glide N secs to` forms, `set rotation style`, the layer blocks), looks (`set/change size`, `switch costume/backdrop`, graphic effects), sound (`play sound`, `stop all sounds`, volume), `stop`, `reset timer`, `delete this clone`, `show`/`hide` of a variable, the whole pen pack and the whole music pack, and the other hats (`when actor clicked`, `when backdrop switches to`, `when N seconds have passed`, `when I start as a clone`, `when loudness is over`). A script that uses the pen or music blocks declares the pack itself. Every one has a round-trip test (program to text to the same program), and the canonical validator still judges each value (a colour, a drum, a size the scene offers).

## Conditions and expressions (built)

Expressions are read by `parseExpression`. Every operation with two sides is written inside brackets, so there is no precedence to guess: `(score + 2)`, `(score > 3)`, `((a > 1) and not key Space is down)`. A quoted word is a variable when one of that name is declared, and a piece of text otherwise (a text that equals a variable's name would read back as the variable, and then the program is not offered for text editing, because the round trip would not be exact). Understood: arithmetic and `mod`, comparisons and `=`, `and`, `or`, `not`, `join`, `length of`, `letter N of`, `contains`, the math functions, `random` and `random whole number`, the number and word variables (and `stage` ones, with `text "name" = "words"`), the sensors (`key K is down`, `touching goal | mouse | "actor" | color C | edge`, `mouse is down`, distances, positions, timer, loudness, costume and backdrop number, the clock), used in `set`, `change`, `if`/`else`, `repeat until`, `wait until` and `say ... + expression`. A line the reader cannot make sense of is `badExpression` with its line, and a bracket left open is named as such.

## Lists (built)

`list "name" = 1, "two", 3` (or `stage list`, an empty list is `list "name" =`) followed by `show "name"` when it is visible. Blocks: `add X to "list"`, `delete all of`, `remove item N of`, `insert item N of "list" with X`, `replace item N of "list" with X`, `show`/`hide "list"`. Reporters: `item N of "list"`, `length of "list"`, `"list" contains X`, `item # of X in "list"`. A quoted name is a list only where a list is expected (or where a declared list name is followed by `contains`, or after `length of`); a text equal to a list's name there would read as the list, and such a program is not offered for text editing. A hand-typed list in the Studio gets the next `studio-list-N`.

## Custom blocks (built)

`define name with size, turns` (or `define shared name`) followed by the indented body, written before the script that owns it; shared blocks come first. `call name with 40, size` calls one: each argument is a fixed number or one of the block's own numbers. Inside a block, a number's name stands in `move`, `turn`, `wait N seconds`, `repeat N times` and in expressions. The text does not show the fixed number such a block keeps beside its own number, so the reader assumes the palette's (move 40, turn 90, wait 1, repeat 3); a program whose block keeps another one is simply not offered for text editing. Ids: the base's by name, else `proc-S-N` and `shared-N`. A call may reach a block defined later.

## Ask, broadcast and copies (built)

`ask text PROMPT → "name"` and `ask PROMPT → "name"` (the prompt is the catalog id), `broadcast "message"` (with ` and wait`), and `make N copies (spread|fall|follow)` (with ` that run their own script`). `broadcast` is now shown in the text too; before, it was not projected at all.

Still block-only, and therefore a program that has one is not offered for text editing: `next costume` (the text only shows how many costumes, not which, so it cannot be read back) and a property of another character (the text shows a variable by id, not by name).

## Next

1. Show `next costume` and a variable of another character by name, so they can be read back.
2. Python and TypeScript stay display-only for now; Agorix Code is the language designed to be read both ways.
