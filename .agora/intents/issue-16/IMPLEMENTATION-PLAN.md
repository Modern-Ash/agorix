---
schema: "agora/implementation-plan/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Implementation plan: text projection

1. Re-read `PROGRAMMING_MODEL.md` text-projection example and `program-model`
   schema (`schema.ts`): triggers `onStart`; statements `move|turn|repeat|if`;
   expressions `touchingGoal|booleanLiteral|numericLiteral`.
2. Add `@agorix/program-model` workspace dependency to
   `packages/code-generator/package.json` (same pattern as `persistence`).
3. Implement `project.ts`:
   - `formatNumber(n: number): string` — deterministic, `-0` → `"0"`.
   - `UnsupportedNodeError` class (`nodeId`, `nodeType`).
   - `projectProgram(program: ProjectProgram): ProjectionResult` — pure walker
     emitting educational TS/JS-like text with `whenStarted(() => { … });`,
     `sprite.move/turn`, `repeat(count, () => { … });`, `if (cond) { … }`,
     `sprite.touchingGoal()`, literals; builds `mapping` with path node ids
     (`scripts[i]`, `scripts[i]/statements[j]`, `/body[k]`, `/then[k]`,
     `/condition`, `/trigger`).
   - Fixed format: two-space indent, one statement per line, trailing newline.
4. Export public surface from `index.ts` (keep `PACKAGE_NAME`).
5. Write `fixtures.ts` + `project.test.ts` covering:
   - documented example snapshot (exact `code` string);
   - full-coverage fixture: every trigger/statement/expression op;
   - nested `repeat`/`if` structures;
   - deterministic: same input twice ⇒ identical `code` + `mapping`;
   - mapping ranges: every `start/end` within `code.length`, non-empty for
     emitted nodes, and `code.slice(start, end)` matches expected snippet for
     at least one nested case;
   - `UnsupportedNodeError` for unknown statement/expression/trigger `type`
     (cast through `unknown`), asserting `nodeId`/`nodeType`;
   - no mutation of input program (deep freeze / structural compare);
   - empty `if.then` / empty script statements still well-formed.
6. Run `pnpm test` (workspace), `pnpm lint`, `pnpm build` as real evidence;
   record test-suite evidence + criterion stages through `verified`.
7. Register artifacts (domain-model, architecture, implementation-plan,
   test-strategy), attach developer approval, transition
   construction → operations when gate `construction-verified` is clean.
