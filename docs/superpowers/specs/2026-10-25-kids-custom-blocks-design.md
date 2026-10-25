# Kids custom blocks, "Mis bloques" (design)

Issue #538, iteration 4 (procedures; extensions and media tools stay separate). Date: 2026-10-25. Status: **approved by the owner on 2026-10-25 with the decisions below.**

## Goal

A child in Escena libre can turn blocks they already built into one named block of their own and use it in any character's script, like Scratch's "My Blocks". The canonical program stays the single source of truth; the deterministic runtime proves what ran; Ori may only suggest using a block the child already made, and the child reviews it.

## Non-goals (version 1)

- Parameters, return values, and "run without screen refresh".
- Procedures defined inside procedures.
- Extensions, plugins, or any code supplied by someone else (kept for the extensions design).
- Sharing or discovering blocks (ADR 0009 still excludes it); `.agorix` export/import keeps them as part of the project.
- Ori creating, renaming or deleting a block.

## Child journey

1. The child builds a few blocks, picks **Crear bloque con los últimos N**, and types a name.
2. The blocks become one **Mis bloques** entry; the script shows a call to it in their place (undo restores the originals).
3. Any character can add **Usar: <name>** from the palette. Playing runs the body, and the trace shows `<name>` with its inner steps.
4. The child can rename a block or delete it only when no script still calls it (the delete button explains why it is disabled).

## Canonical model

- `Script.procedures?: readonly Procedure[]` (per character) with `Procedure { id: "proc-1"…, name, body: Statement[] }`.
- New statement `callProcedure { procedureId }`.
- Limits (`limits.ts`): at most 20 procedures per script, body 1–20 statements, name 1–20 characters from the same allowed set as variable names, call depth at most 16 (enforced at run time).
- Node ids for inner steps are `procedures[i]/body[j]`, so traces, code mappings and Ori context can point at them. The existing `MAX_PROGRAM_NODES` (500) and `MAX_NESTING_DEPTH` apply to the program as a whole, procedure bodies included.

## Runtime

- `callProcedure` executes the body in the calling actor's context. It adds one step for the call and the body's own steps, so the step budget and the 60 virtual-second budget cover procedures with no new loophole.
- An id the script does not define fails validation. Depth over 16 ends the run as `budget-exceeded`.
- Determinism: no new state; a call equals pasting the body, which a test proves by running both and comparing traces except for the call step.
- Multi-actor: `statementAtNodeId` and the trace understand `procedures[...]` paths so a `broadcast` or `goToLayer` inside a body still takes effect.

## Projections and blocks

- Agorix Code: `define <name>` / `<name>`; Python: `def <identifier>():` plus a call; TypeScript: a function plus a call. Names pass through the same identifier sanitizer variables use so a child name cannot break generated code.
- Block adapter: `procedures_define` and `procedures_call`; round-trip test as for every other statement.
- Java and Lua stay on their documented subsets and report an unsupported-node diagnostic.

## Safety and privacy

- A block name is child-entered text. It is validated (length, allowed characters), never executed, and never sent to Ori or any provider: Ori context carries the procedure id and the statement types only, the same rule already used for variable names.
- Import of `.agorix` re-runs the full validator, including the limits above; a malformed or oversized procedure list rejects the whole import with a child-readable message and changes nothing.
- No new network, storage key, or adult flag. The creative tools already default on (#539); this feature ships behind no extra flag, but the adult Ori switch still controls suggestions.

## Ori

Ori may propose a `callProcedure` for a block that exists, as an ordinary reviewable proposal (appendStatement). It cannot create or edit a procedure. The no-AI path is unchanged.

## Testing

- Validator: limits, name rules, unknown id. Runtime: recursion that terminates, and runaway recursion ending as `budget-exceeded`.
- Runtime: body executes in order, equals the pasted body, budget exhaustion inside a body, broadcast and layer change inside a body in a multi-actor run.
- Projections and blocks: Agorix Code, Python, TypeScript, block round-trip.
- Studio model: create from the last N blocks, undo, delete in use offers inlining, rename, limit failure.
- Browser (mobile, axe): create, use, play, reload, reopen, export/import.

## Rollout

Delivered in slices that each keep `main` green: (1) model, validator and runtime; (2) projections and blocks; (3) Studio authoring; (4) Ori proposal support and docs. Each slice updates `SCRATCH_CAPABILITY_AUDIT.md` and distinguishes implemented code from what a child sees by default.

## Owner decisions (2026-10-25)

1. **Scope: per character, as in Scratch.** A block belongs to the character that made it and is stored on that character's script (`Script.procedures`), so a script sent to the runtime carries its own blocks. Other characters cannot call it.
2. **Limits: Scratch-compatible, with a safety net.** Recursion is allowed, as in Scratch, but a call chain deeper than 16 ends the run as `budget-exceeded`, and every step still counts against the existing step and virtual-time budgets. Up to 20 blocks per character, bodies up to 20 statements. Parameters (up to three numbers) arrive in a later slice.
3. **Deleting a block in use: improved over Scratch.** The child is offered to replace each call with the block's contents, or to cancel; nothing is deleted silently.

The acyclic-graph rule drafted above is dropped because recursion is allowed; the depth cap replaces it.

## Parameters (version 2) — approved by the owner on 2026-10-25

Decision 2 above promised "up to three numbers" for a later slice. This section is the design for it. Decisions are recorded at the end; slices ship in the order below.

### Child journey

1. When making a block the child can add **up to three numbers** and titles each one (for example **lado**). A block with numbers shows them next to its title: **Cuadrado (lado)**.
2. Inside the block, the **Mover**, **Girar** and **Esperar** blocks (and any block that already takes a value, such as a variable or a list position) get a choice **fijo / número: lado**. Choosing a number replaces the fixed value.
3. Every time the child uses the block they pick the numbers for that use (**Usar: Cuadrado 3**). Different uses can pass different numbers; a block can pass its own number to another block.
4. Playing shows the call with the numbers it received, and the code shows them as ordinary function arguments.

### Canonical model

- `Procedure.params?: { id: "p1" | "p2" | "p3", name }[]` (0 to 3). Names follow the existing 1–20 character rule, are unique inside the block, and are never sent to Ori.
- Expression `{ type: "param", paramId }` works in every place an expression already works.
- `move.steps`, `turn.degrees` and `wait.seconds` accept either a number (today) or `{ param: "p1" }`. These three are the only motion and time fields in version 2; other fields stay fixed numbers and are listed in the audit as open.
- `callProcedure.args?: Expression[]` must have exactly as many entries as the block has numbers. A block with no numbers has no `args` key, so every saved project is unchanged.
- The validator rejects: a number used outside the block that declares it, a call with the wrong number of arguments, more than three numbers, duplicate titles, and any argument that is not an expression. An import that breaks one of these is rejected as a whole, as today.
- Limits: arguments count toward `MAX_PROGRAM_NODES`; recursion depth stays at 16; nothing else new.

### Runtime

- A call evaluates its arguments in the **caller's** context, then runs the body with those values. A number read inside the body gives the value of the innermost call. Calls can nest and recurse, each with its own values.
- A number placed in `move.steps`, `turn.degrees` or `wait.seconds` is **clamped to the same range the validator allows for a fixed value** (`MOVE_STEPS`, `TURN_DEGREES`, `WAIT_SECONDS`); a non-finite value counts as the nearest bound. It never stops the run and never throws, so a child can try big numbers safely; the step and virtual-time budgets still end runaway programs.
- Equivalence test: a call with arguments produces the same world and the same trace (apart from the call step) as the body written inline with those values.
- The trace of the call step records the argument values, so replay and Ori's explanation can say what was passed.

### Projections and blocks

- Agorix Code: `define Cuadrado with lado` and `Cuadrado 3`; Python and TypeScript: a function with parameters and a call with arguments. Titles pass through the same identifier sanitizer as variables and procedure names, and a number cannot shadow a variable name in the generated code.
- Block adapter: `procedures_call` takes inputs `arg1` to `arg3`; a number used in a field is an input block `procedures_param` in place of the field. Round-trip tests as for every other statement. Java and Lua stay on their documented subsets and report an unsupported-node diagnostic.

### Studio

- **Make a block** gains **Números** (0 to 3) with a title each. Existing blocks can add or remove numbers; removing one that is used asks the child to keep it or replace its uses with a fixed value.
- The **Mis bloques** card shows each block's contents with the **fijo / número** choice on the blocks that accept it.
- The palette entry **Usar: <title>** shows one picker per number (same pickers as the fixed block uses); numbers from an enclosing block and variables are offered too.
- Undo, import/export and the 60-block scene limit work exactly as they do for blocks without numbers.

### Ori

Version 2 keeps Ori's contract unchanged: it may suggest only blocks **without** numbers, by id, as today. Suggesting arguments needs its own review of what a child sees and is a separate slice.

### Safety and privacy

Number titles are child-entered text: validated, never executed, never sent to Ori or any provider. The number values are plain numbers in the program. No new network, storage key or flag. The creative tools already default on (#539); this ships without an extra flag.

### Slices (each keeps `main` green)

A. model, validator and runtime (with the equivalence and clamping tests). B. projections and blocks. C. Studio authoring. D. docs and audit; Ori arguments stay open. **Status: A–D implemented in PR #726; when Ori suggestions of own blocks (PR #725) merge, they must list only blocks without numbers.**

### Owner decisions (2026-10-25)

1. **Fields that accept a number: the recommended set, "the more interactive the better".** `move.steps`, `turn.degrees`, `wait.seconds`, every expression slot, and, because the owner asked for more interactivity, also `repeat.count` (a block that draws a shape needs "how many times"). Rounded to a whole number and kept between 1 and 1000.
2. **Out of range: clamp and keep running**, as in the Runtime section.
3. **Where a call gets its numbers: fixed numbers only in version 2.** The model stores them as `args: numericLiteral[]`, so a later version can allow other expressions without changing saved projects. A block therefore cannot pass its own number to another block yet.

### Model notes from the build

- A bound field keeps its fixed value (`steps: 40, stepsFrom: "p1"`). The fixed value stays valid and is what any consumer that ignores numbers reads, so this change adds no union type to existing fields.
- A bound field takes the value **in its own unit** (steps, degrees, seconds, repetitions). The Studio call picker shows the unit of the first field that uses the number.
- Number ids are positional (`p1`, `p2`, `p3` with no gaps) so `args[i]` fills `params[i]`.
