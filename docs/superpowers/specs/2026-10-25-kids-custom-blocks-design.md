# Kids custom blocks, "Mis bloques" (design)

Issue #538, iteration 4 (procedures; extensions and media tools stay separate). Date: 2026-10-25. Status: **proposed, awaiting owner approval; no code yet.**

## Goal

A child in Escena libre can turn blocks they already built into one named block of their own and use it in any character's script, like Scratch's "My Blocks". The canonical program stays the single source of truth; the deterministic runtime proves what ran; Ori may only suggest using a block the child already made, and the child reviews it.

## Non-goals (version 1)

- Parameters, return values, and "run without screen refresh".
- Recursion, mutual recursion, or procedures defined inside procedures.
- Extensions, plugins, or any code supplied by someone else (kept for the extensions design).
- Sharing or discovering blocks (ADR 0009 still excludes it); `.agorix` export/import keeps them as part of the project.
- Ori creating, renaming or deleting a block.

## Child journey

1. The child builds a few blocks, picks **Crear bloque con los últimos N**, and types a name.
2. The blocks become one **Mis bloques** entry; the script shows a call to it in their place (undo restores the originals).
3. Any character can add **Usar: <name>** from the palette. Playing runs the body, and the trace shows `<name>` with its inner steps.
4. The child can rename a block or delete it only when no script still calls it (the delete button explains why it is disabled).

## Canonical model

- `ProjectProgram.procedures?: readonly Procedure[]` with `Procedure { id: "proc-1"…, name, body: Statement[] }`.
- New statement `callProcedure { procedureId }`.
- Limits (`limits.ts`): at most 8 procedures, body 1–6 statements, name 1–20 characters from the same allowed set as variable names, call depth at most 3, and the call graph must be acyclic (checked by the validator, not only at run time).
- Node ids for inner steps are `procedures[i]/body[j]`, so traces, code mappings and Ori context can point at them. The existing `MAX_PROGRAM_NODES` (500) and `MAX_NESTING_DEPTH` apply to the program as a whole, procedure bodies included.

## Runtime

- `callProcedure` executes the body in the calling actor's context. It adds one step for the call and the body's own steps, so the step budget and the 60 virtual-second budget cover procedures with no new loophole.
- Unknown id, a cycle, or depth over 3 fails closed before any world mutation, like every other allowlist failure.
- Determinism: no new state; a call equals pasting the body, which a test proves by running both and comparing traces except for the call step.
- Multi-actor: `statementAtNodeId` and the trace understand `procedures[...]` paths so a `broadcast` or `goToLayer` inside a body still takes effect.

## Projections and blocks

- Agorix Code: `define <name>` / `<name>`; Python: `def <identifier>():` plus a call; TypeScript: a function plus a call. Names pass through the same identifier sanitizer variables use so a child name cannot break generated code.
- Block adapter: `procedures_define` and `procedures_call`; round-trip test as for every other statement.
- Java and Lua stay on their documented subsets and report an unsupported-node diagnostic.

## Safety and privacy

- A block name is child-entered text. It is validated (length, allowed characters), never executed, and never sent to Ori or any provider: Ori context carries the procedure id and the statement types only, the same rule already used for variable names.
- Import of `.agorix` re-runs the full validator, including acyclicity and the limits above; a malformed or oversized procedure list rejects the whole import with a child-readable message and changes nothing.
- No new network, storage key, or adult flag. The creative tools already default on (#539); this feature ships behind no extra flag, but the adult Ori switch still controls suggestions.

## Ori

Ori may propose a `callProcedure` for a block that exists, as an ordinary reviewable proposal (appendStatement). It cannot create or edit a procedure. The no-AI path is unchanged.

## Testing

- Validator: limits, name rules, unknown id, direct and indirect cycles, depth 4.
- Runtime: body executes in order, equals the pasted body, budget exhaustion inside a body, broadcast and layer change inside a body in a multi-actor run.
- Projections and blocks: Agorix Code, Python, TypeScript, block round-trip.
- Studio model: create from the last N blocks, undo, delete refused while called, rename, 8-block-limit failure.
- Browser (mobile, axe): create, use from a second character, play, reload, reopen, export/import.

## Rollout

Delivered in slices that each keep `main` green: (1) model, validator and runtime; (2) projections and blocks; (3) Studio authoring; (4) Ori proposal support and docs. Each slice updates `SCRATCH_CAPABILITY_AUDIT.md` and distinguishes implemented code from what a child sees by default.

## Open questions for the owner

1. Should a block belong to the project (any character can use it) or to the character that made it, as in Scratch? This draft chooses project-wide for simplicity.
2. Is a limit of 8 blocks and depth 3 right for the 8–12 age range?
3. Should deleting a block that is still used offer to inline it (replace each call with the body) instead of refusing?
