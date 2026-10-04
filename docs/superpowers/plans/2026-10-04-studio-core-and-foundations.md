# Studio core and foundations (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the foundational charter, the public-benefit commitment, ADR 0007, and the three headless packages (`interaction-core`, `agent-workflow`, `studio-protocol`) that Web and Studio will both consume.

**Architecture:** Docs first (they constrain everything). Then three small, pure TypeScript packages that follow the existing `packages/*` conventions (workspace package, `src/index.ts` entry, colocated `*.test.ts`, vitest). They import only `@agorix/block-editor` types/functions already in the repo; none imports DOM, `vscode` or provider code.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`), vitest, pnpm workspaces, prettier.

**Spec:** `docs/superpowers/specs/2026-10-04-studio-refactor-design.md` (decisions D2, D4, D5, D6, D7). Web, Studio, density levels and the cross-surface gate are separate later plans (Phases 3-5).

## Global Constraints

- Domain packages must not import UI framework code, provider SDKs, browser-only APIs, Capacitor APIs or VS Code APIs (AGENTS.md architecture invariant).
- Build, tests and core behavior must not require provider credentials.
- The canonical program is the only authority; UIs emit intents, never mutate the program.
- No intent, message or workflow event may apply an AI proposal; only the learner's accept/modify decision does, and rejecting leaves the program unchanged.
- Every drag intent has a keyboard equivalent that yields the identical `WorkspaceChange` (`docs/product/INPUT_PARITY_MATRIX.md`).
- Identifiers crossing the protocol match `/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/` (same as `STUDIO_TOKEN_PATTERN`); never paths or free text.
- Complete-solution assistance (level 5) only after an explicit learner request following repeated failure (`PEDAGOGY.md`).
- Mission completion comes from runtime evidence only, never from AI judgment.
- Docs pass `pnpm format:check`; code passes `pnpm lint`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A proposal dropped on any slot, node or canvas must resolve to `reviewProposal` and never to an accept; dropping it on the agent resolves to nothing.
- Invalid drag/drop pairs and malformed ids return `undefined` instead of throwing.
- Keyboard moves at the list edges (Alt+ArrowUp at index 0, Alt+ArrowDown at the last index) produce no intent instead of an out-of-range index.
- Inserting a non-statement block (e.g. `event_on_start`) via an intent must surface the existing `BlockEditorAdapterError` rather than corrupt the workspace.
- The workflow reducer rejects out-of-order events (cannot reach `run` without a proposal decision; `completed` only enters via `runObserved`) and a rejected proposal leaves the learner at the proposal stage.
- Protocol parsers return `undefined` for junk, wrong schema, unknown types, oversize/odd ids and objects with extra `__proto__` keys.
- With `aiEnabled: false` no offer is ever allowed and the effective assistance level is 0.

---

## File structure

| Path                                                            | Responsibility                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/FOUNDATIONS.md`                                           | Philosophical-pedagogical charter                                     |
| `docs/product/PUBLIC_BENEFIT.md`                                | Free-for-institutions commitment and its design requirements          |
| `docs/architecture/adr/0007-shared-core-and-two-experiences.md` | ADR amending 0006                                                     |
| `packages/interaction-core/src/anchors.ts`                      | `AgentAnchorRef` validation                                           |
| `packages/interaction-core/src/intents.ts`                      | `Intent`, `DragSource`, `DropTarget`, `resolveDrop`, `intentToChange` |
| `packages/interaction-core/src/keyboard.ts`                     | `keyboardIntent`                                                      |
| `packages/interaction-core/src/index.ts`                        | public exports                                                        |
| `packages/agent-workflow/src/loop.ts`                           | Director/Auditor state machine                                        |
| `packages/agent-workflow/src/assistance.ts`                     | ladder, agreements, offer gating                                      |
| `packages/agent-workflow/src/index.ts`                          | public exports                                                        |
| `packages/studio-protocol/src/index.ts`                         | versioned host/UI messages and parsers                                |

---

### Task 1: Foundational charter

**Files:**

- Create: `docs/FOUNDATIONS.md`
- Modify: `README.md` (add one link line near the other doc links), `docs/product/PRODUCT_INTENT.md` (add a "Foundations" pointer under Vision), `AGENTS.md` (add `docs/FOUNDATIONS.md` to the required reading in "Mandatory workflow" step 1)

**Interfaces:**

- Consumes: none.
- Produces: `docs/FOUNDATIONS.md` as the highest-ranking doc; later docs link to it.

- [ ] **Step 1: Verify the OECD-EC framework status**

Run a web search for "OECD European Commission AI Literacy Framework primary secondary final". Record in the doc whether the cited version is a review draft (May 2025) or the final edition, with the URL. Do not claim "final" without a source.

- [ ] **Step 2: Write `docs/FOUNDATIONS.md`**

```markdown
# Agorix foundations

This document is the philosophical and pedagogical charter of Agorix. Product, architecture and curriculum documents derive from it. When they conflict, this document wins until it is amended by an ADR.

## Why Agorix exists

Children now grow up with AI that can write programs for them. If it does, they stop being authors. Agorix exists so a child can use AI as a collaborator and still be the author of what they build, and can always tell what they decided from what AI only suggested.

> AI proposes. Child decides. Runtime proves. Child explains.

> Nothing happens under the rug.

## Beliefs

1. **Authorship.** The learner creates. AI assists, proposes, challenges and explains. No AI-originated change enters the accepted program invisibly.
2. **AI is a fallible collaborator.** It is useful and sometimes wrong. Learners learn to direct it, to predict before trusting, and to verify.
3. **Evidence over eloquence.** The deterministic runtime, not fluent language, proves behavior and mission completion.
4. **Mistakes are material.** Failed predictions and surprising results are where learning happens. The agent never plants bugs to teach critique.
5. **Support is temporary.** Scaffolding is visible, attributable and removable, and it shrinks as the learner grows.
6. **Silence is respect.** The agent's default is to say nothing; it offers only when evidence justifies it.
7. **Equity.** Agorix works offline, without an account, on modest devices, in the learner's language, and without paid AI.
8. **Privacy over engagement.** Child safety and privacy outrank personalization and convenience.

## Lineage

| Source                                                                                                                     | What Agorix takes from it                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papert, constructionism                                                                                                    | People learn best by building something they care about and can share. Basis of "the learner creates".                                                |
| Resnick, four Ps (projects, passion, peers, play) and the creative learning spiral (imagine, create, play, share, reflect) | Basis of the Web experience: a Scratch native to AI.                                                                                                  |
| Vygotsky, Wood, Bruner and Ross, scaffolding and the zone of proximal development                                          | Basis of the hint ladder (levels 0-5) and gradual release of responsibility.                                                                          |
| Sentance, PRIMM (predict, run, investigate, modify, make)                                                                  | Basis of "predict before run" and reading code before writing it; maps to the Director/Auditor loop.                                                  |
| UNESCO, AI Competency Framework for Students                                                                               | Four dimensions (human-centred mindset, ethics of AI, AI techniques and applications, AI system design) and three levels (understand, apply, create). |
| OECD and European Commission, AI Literacy Framework for primary and secondary education                                    | Four domains: engaging with, creating with, managing and designing AI. (Record the verified edition and URL here.)                                    |
| AI4K12, five big ideas                                                                                                     | Perception, representation and reasoning, learning, natural interaction, societal impact.                                                             |

Agorix's own contribution is **authorship plus evidence**: a visible boundary between proposal, accepted program and executed result, enforced by the product rather than taught as advice.

## Mapping the progression

| Agorix stage | PRIMM               | UNESCO level | OECD-EC domain                |
| ------------ | ------------------- | ------------ | ----------------------------- |
| Explore      | Predict, Run        | Understand   | Engaging with AI              |
| Connect      | Investigate         | Understand   | Engaging with AI              |
| Translate    | Investigate, Modify | Apply        | Creating with AI              |
| Collaborate  | Modify              | Apply        | Creating with AI, Managing AI |
| Create       | Make                | Create       | Creating with AI, Managing AI |
| Critique     | Make                | Create       | Managing AI, Designing AI     |

This mapping is a starting hypothesis to validate with educators, not a certification claim.

## The two experiences

- **Agorix Web** is a Scratch native to AI: projects, play and peers first, with the agent as a companion character whose suggestions are ghost blocks the child can drag in or ignore.
- **Agorix Studio** is an IDE-native workspace in the style of spec-driven tools: the learner states intent, reviews a plan, builds in bounded steps, predicts, runs, compares and explains.

Both are views of one shared core. The same program has the same meaning on both.

## Commitments and limits

- No hidden AI code, no hidden program mutation.
- Core learning works with AI disabled.
- No mission is completed by AI judgment.
- No personal data is requested to personalize support.
- No provider or model is a product dependency.
- The agent never claims behavior the runtime has not observed.
- Reflection never blocks basic completion.

Public benefit commitments are in [`product/PUBLIC_BENEFIT.md`](./product/PUBLIC_BENEFIT.md).
```

- [ ] **Step 3: Add the links**

In `README.md`, next to the other doc links, add: `- [Foundations](docs/FOUNDATIONS.md)`. In `docs/product/PRODUCT_INTENT.md`, directly under `## Vision`, add: `The philosophical charter is [`../FOUNDATIONS.md`](../FOUNDATIONS.md).` In `AGENTS.md` step 1 of "Mandatory workflow", append: ` Read docs/FOUNDATIONS.md for product philosophy.`

- [ ] **Step 4: Format and check**

Run: `pnpm prettier --write docs/FOUNDATIONS.md README.md docs/product/PRODUCT_INTENT.md AGENTS.md && pnpm format:check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/FOUNDATIONS.md README.md docs/product/PRODUCT_INTENT.md AGENTS.md
git commit -m "docs: add foundational philosophical-pedagogical charter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Public benefit commitment

**Files:**

- Create: `docs/product/PUBLIC_BENEFIT.md`

**Interfaces:**

- Consumes: `docs/FOUNDATIONS.md`.
- Produces: the requirements list ADR 0007 cites.

- [ ] **Step 1: Write `docs/product/PUBLIC_BENEFIT.md`**

```markdown
# Public benefit commitment

Agorix is shared free with foundations and educational institutions. This document says what that means and what it requires of the product. It derives from [`../FOUNDATIONS.md`](../FOUNDATIONS.md).

## Commitment

1. **Free software.** Source code and repository documentation stay under Apache-2.0 (ADR 0002). Anyone can self-host.
2. **Free hosted service for institutions.** Modern Ash intends to operate a hosted Agorix at no charge to verified educational institutions and foundations, funded by donations or grants.
3. **Remote AI off by default.** The hosted service must not depend on paid remote model calls. Remote AI is an explicit, opt-in tier.
4. **No tiers that gate learning.** There is no paid tier that unlocks pedagogy. Core learning is never behind a paywall.

The hosted service is a commitment of intent, bounded by funding. It does not change the license and is not a service-level agreement.

## What this requires of the product

| Requirement                   | Consequence                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Near-zero AI cost             | Deterministic (System 0) and local tiers first; LAYA decides whether a model is needed; per-session budget degrades to deterministic answers. |
| Offline and local-first       | Projects, runtime, missions and deterministic help work without a network.                                                                    |
| No mandatory account          | A learner or class can start with no sign-up. Accounts are optional sync.                                                                     |
| Modest devices                | Core surfaces run on low-end hardware; no feature requires a GPU or a large local model.                                                      |
| Languages and accessibility   | i18n and keyboard/screen-reader paths are release conditions, not extras.                                                                     |
| Educator evidence without PII | Exportable, aggregate or pseudonymous evidence for teachers; never names, emails, free text or raw model output.                              |
| Self-hostable                 | An institution can run Agorix on its own infrastructure with no provider credentials.                                                         |

## Educator tooling boundary

Educator tools (evidence export, class-level deployment, content selection) are allowed. Classroom surveillance, ranking children, and any engagement-maximizing mechanic are not. `PRODUCT_INTENT.md` records "classroom administration" as a POC non-goal; ADR 0007 narrows that non-goal to administration and surveillance, not to educator evidence.

## Open decisions

- Verification process for institutions and foundations.
- Who funds hosting and the opt-in remote AI tier, and under what terms.
```

- [ ] **Step 2: Format and check**

Run: `pnpm prettier --write docs/product/PUBLIC_BENEFIT.md && pnpm format:check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/product/PUBLIC_BENEFIT.md
git commit -m "docs: add public benefit commitment for institutions and foundations

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ADR 0007 and gate/intent amendments

**Files:**

- Create: `docs/architecture/adr/0007-shared-core-and-two-experiences.md`
- Modify: `docs/product/STUDIO_RELEASE_GATE.md` (the "Canonical program" row, "Studio UX"/"Intentional difference" cells), `docs/product/PRODUCT_INTENT.md` (non-goals line), `docs/architecture/adr/0006-studio-agent-and-canvas.md` (Status line)

**Interfaces:**

- Consumes: Tasks 1-2 docs.
- Produces: the decision record the three packages cite.

- [ ] **Step 1: Write the ADR**

```markdown
# ADR 0007: Shared core and two experiences

## Status

Accepted. Amends ADR 0006.

## Context

Studio shipped as a code-first, tree-view surface and the Web app is block-first. The product direction is now a rich, graphical, agent-present Studio in the style of spec-driven tools, and a Web app that behaves like a Scratch native to AI, both on one core, shared free with institutions ([`FOUNDATIONS.md`](../../FOUNDATIONS.md), [`PUBLIC_BENEFIT.md`](../../product/PUBLIC_BENEFIT.md)).

## Decision

1. **Shell.** Studio stays a VS Code extension with webview/custom-editor UI, using only public APIs so the same VSIX runs in VS Code forks via Open VSX. A fork or standalone app is a later distribution option.
2. **Shared headless core.** Existing domain packages remain the core. Three new platform-neutral packages are added: `@agorix/interaction-core` (drag intents, anchors, keyboard parity), `@agorix/agent-workflow` (Director/Auditor state machine, assistance ladder, agent agreements) and `@agorix/studio-protocol` (versioned host/UI messages). They import no DOM, VS Code or provider code.
3. **UIs emit intents.** A UI never mutates the program. The host converts intents to canonical transactions.
4. **Agent panel is structured.** Amends ADR 0006 item 4: Studio may have an agent panel made of plan, tasks, proposals with diff and predictions. It is not a free-form transcript and free text is secondary.
5. **Studio no longer excludes block-style editing.** The canvas is a projection of the canonical program (ADR 0006) and a co-equal editor. `STUDIO_RELEASE_GATE.md` is updated accordingly.
6. **Educator tooling.** The `PRODUCT_INTENT.md` non-goal "classroom administration" is narrowed to administration and surveillance. Educator evidence export and deployment tools without PII are allowed.

## Consequences

- A new block, signal or agent mode appears in Web and Studio from one change.
- Web and Studio can be built in parallel against the core.
- The same edit sequence must yield the same semantic hash on both surfaces (cross-surface gate, later plan).
- Reordering of epic #242: anchors and canvas precede agent depth.
```

- [ ] **Step 2: Amend the gate, intent and ADR 0006**

In `STUDIO_RELEASE_GATE.md`, in the "Canonical program" row replace the Intentional difference cell text `Studio does not expose Scratch-like block editing` with `Studio exposes a canvas projection (ADR 0006, ADR 0007); edits flow through the same canonical transactions`. In `PRODUCT_INTENT.md` Non-goals, replace `- classroom administration;` with `- classroom administration and surveillance (educator evidence export without PII is allowed, see ADR 0007);`. In ADR 0006 under `## Status`, append a line: `Amended by [ADR 0007](./0007-shared-core-and-two-experiences.md).`

- [ ] **Step 3: Format and check**

Run: `pnpm prettier --write docs && pnpm format:check`
Expected: PASS. If prettier rewrites unrelated docs, run `git diff --stat` and `git checkout` those files; keep only the files edited in this task.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: ADR 0007 shared core and two experiences; amend gate and intent

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `interaction-core` scaffold and anchors

**Files:**

- Create: `packages/interaction-core/package.json`, `packages/interaction-core/tsconfig.json`, `packages/interaction-core/vitest.config.ts`, `packages/interaction-core/src/anchors.ts`, `packages/interaction-core/src/anchors.test.ts`, `packages/interaction-core/src/index.ts`

**Interfaces:**

- Consumes: none.
- Produces: `ANCHOR_KINDS`, `AnchorKind`, `AgentAnchorRef { kind; id }`, `createAnchorRef(kind, id)` (throws `RangeError`), `parseAnchorRef(value: unknown): AgentAnchorRef | undefined`, `PACKAGE_NAME`.

- [ ] **Step 1: Scaffold the package**

`packages/interaction-core/package.json`:

```json
{
  "name": "@agorix/interaction-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@agorix/block-editor": "workspace:*"
  },
  "devDependencies": {
    "@agorix/program-model": "workspace:*"
  }
}
```

`packages/interaction-core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`packages/interaction-core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "node_modules/**"],
  },
});
```

Run: `pnpm install`
Expected: workspace links created; `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write the failing test**

`packages/interaction-core/src/anchors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ANCHOR_KINDS, createAnchorRef, parseAnchorRef } from "./anchors.js";

describe("agent anchors", () => {
  it("creates an anchor for every kind with a safe id", () => {
    for (const kind of ANCHOR_KINDS) {
      expect(createAnchorRef(kind, "node:main_0")).toEqual({ kind, id: "node:main_0" });
    }
  });

  it("rejects ids that are paths, free text or too long", () => {
    for (const id of ["", "/etc/passwd", "has space", "a".repeat(65), ".hidden"]) {
      expect(() => createAnchorRef("node", id)).toThrow(RangeError);
    }
  });

  it("parses unknown input without throwing", () => {
    expect(parseAnchorRef({ kind: "error", id: "E_RUN_1" })).toEqual({
      kind: "error",
      id: "E_RUN_1",
    });
    for (const junk of [null, 3, "x", {}, { kind: "nope", id: "a" }, { kind: "node", id: 4 }]) {
      expect(parseAnchorRef(junk)).toBeUndefined();
    }
  });

  it("ignores extra keys such as __proto__ when parsing", () => {
    const parsed = parseAnchorRef(JSON.parse('{"kind":"node","id":"a","__proto__":{"x":1}}'));
    expect(parsed).toEqual({ kind: "node", id: "a" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @agorix/interaction-core test`
Expected: FAIL (`./anchors.js` not found).

- [ ] **Step 4: Implement**

`packages/interaction-core/src/anchors.ts`:

```ts
export const ANCHOR_KINDS = [
  "node",
  "error",
  "worldEntity",
  "evidenceRow",
  "paletteItem",
  "missionGoal",
] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export interface AgentAnchorRef {
  readonly kind: AnchorKind;
  readonly id: string;
}

/** Mirrors STUDIO_TOKEN_PATTERN: opaque bounded identifier, never a path or free text. */
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export function isAnchorKind(value: unknown): value is AnchorKind {
  return typeof value === "string" && (ANCHOR_KINDS as readonly string[]).includes(value);
}

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function createAnchorRef(kind: AnchorKind, id: string): AgentAnchorRef {
  if (!isAnchorKind(kind) || !isSafeId(id)) {
    throw new RangeError("invalid agent anchor");
  }
  return { kind, id };
}

export function parseAnchorRef(value: unknown): AgentAnchorRef | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { kind, id } = value as { kind?: unknown; id?: unknown };
  if (!isAnchorKind(kind) || !isSafeId(id)) {
    return undefined;
  }
  return { kind, id };
}
```

`packages/interaction-core/src/index.ts`:

```ts
/** Pure drag/keyboard intents and agent anchors shared by Web and Studio. No DOM, no VS Code. */
export const PACKAGE_NAME = "@agorix/interaction-core";

export type { AgentAnchorRef, AnchorKind } from "./anchors.js";
export {
  ANCHOR_KINDS,
  createAnchorRef,
  isAnchorKind,
  isSafeId,
  parseAnchorRef,
} from "./anchors.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @agorix/interaction-core test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/interaction-core pnpm-lock.yaml
git commit -m "feat(interaction-core): scaffold package with agent anchors

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Drag intents, drop resolution and keyboard parity

**Files:**

- Create: `packages/interaction-core/src/intents.ts`, `packages/interaction-core/src/intents.test.ts`, `packages/interaction-core/src/keyboard.ts`, `packages/interaction-core/src/keyboard.test.ts`
- Modify: `packages/interaction-core/src/index.ts`

**Interfaces:**

- Consumes: `parseAnchorRef`, `createAnchorRef`, `isSafeId` from Task 4; from `@agorix/block-editor`: `BlockType`, `StatementContainerPath`, `StatementLocation`, `WorkspaceChange`, `createDefaultBlock`, `createStarterWorkspace`, `applyWorkspaceChange`, `BlockEditorAdapterError`.
- Produces:
  - `type AgentVerb = "explain" | "debug" | "challenge"`
  - `interface InsertionPoint { container: StatementContainerPath; index: number }`
  - `type DragSource` = `{kind:"palette";blockType}` | `{kind:"block";nodeId;location}` | `{kind:"evidence";rowId;nodeId}` | `{kind:"codeSelection";nodeIds}` | `{kind:"proposal";proposalId}`
  - `type DropTarget` = `{kind:"slot";to:InsertionPoint}` | `{kind:"agent";verb}` | `{kind:"node";nodeId}` | `{kind:"canvas"}`
  - `type Intent` = `insertBlock` | `moveBlock` | `deleteBlock` | `askAgent` | `revealNode` | `highlightNodes` | `reviewProposal`
  - `resolveDrop(source, target): Intent | undefined`
  - `intentToChange(intent, newBlockId: () => string): WorkspaceChange | undefined`
  - `type KeyChord = "Alt+ArrowUp" | "Alt+ArrowDown" | "Delete"`; `interface FocusedBlock { location: StatementLocation; siblingCount: number }`; `keyboardIntent(chord, focus): Intent | undefined`

- [ ] **Step 1: Write the failing tests**

`packages/interaction-core/src/intents.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  createStarterWorkspace,
  type BlockWorkspaceSnapshot,
} from "@agorix/block-editor";
import {
  intentToChange,
  resolveDrop,
  type DragSource,
  type DropTarget,
  type Intent,
} from "./intents.js";

const script = { kind: "script", scriptIndex: 0 } as const;
const slot = (index: number): DropTarget => ({ kind: "slot", to: { container: script, index } });
let counter = 0;
const newId = () => `block:test_${(counter += 1)}`;

function workspaceWithMoves(): BlockWorkspaceSnapshot {
  const empty = createStarterWorkspace();
  const first = intentToChange(
    { type: "insertBlock", blockType: "motion_move", to: { container: script, index: 0 } },
    newId,
  );
  const second = intentToChange(
    { type: "insertBlock", blockType: "motion_turn", to: { container: script, index: 1 } },
    newId,
  );
  if (first === undefined || second === undefined) {
    throw new Error("expected changes");
  }
  return applyWorkspaceChange(applyWorkspaceChange(empty, first).workspace, second).workspace;
}

describe("resolveDrop", () => {
  it("turns a palette drop on a slot into an insert intent", () => {
    expect(resolveDrop({ kind: "palette", blockType: "motion_move" }, slot(0))).toEqual({
      type: "insertBlock",
      blockType: "motion_move",
      to: { container: script, index: 0 },
    });
  });

  it("turns a block drop on a slot into a move and on the agent into askAgent", () => {
    const source: DragSource = {
      kind: "block",
      nodeId: "node:a",
      location: { container: script, index: 0 },
    };
    expect(resolveDrop(source, slot(1))).toEqual({
      type: "moveBlock",
      from: { container: script, index: 0 },
      to: { container: script, index: 1 },
    });
    expect(resolveDrop(source, { kind: "agent", verb: "debug" })).toEqual({
      type: "askAgent",
      verb: "debug",
      about: { kind: "node", id: "node:a" },
    });
  });

  it("jumps from evidence to the causing node and highlights code selections", () => {
    expect(
      resolveDrop({ kind: "evidence", rowId: "row:1", nodeId: "node:b" }, { kind: "canvas" }),
    ).toEqual({ type: "revealNode", nodeId: "node:b" });
    expect(
      resolveDrop({ kind: "codeSelection", nodeIds: ["node:a", "node:b"] }, { kind: "canvas" }),
    ).toEqual({ type: "highlightNodes", nodeIds: ["node:a", "node:b"] });
  });

  it("never resolves a proposal drop into anything but a review intent", () => {
    const source: DragSource = { kind: "proposal", proposalId: "prop:1" };
    const targets: DropTarget[] = [slot(0), { kind: "node", nodeId: "node:a" }, { kind: "canvas" }];
    for (const target of targets) {
      expect(resolveDrop(source, target)).toEqual({ type: "reviewProposal", proposalId: "prop:1" });
    }
    expect(resolveDrop(source, { kind: "agent", verb: "explain" })).toBeUndefined();
  });

  it("returns undefined for invalid pairs and malformed ids instead of throwing", () => {
    expect(
      resolveDrop({ kind: "palette", blockType: "motion_move" }, { kind: "canvas" }),
    ).toBeUndefined();
    expect(
      resolveDrop(
        { kind: "block", nodeId: "/etc/passwd", location: { container: script, index: 0 } },
        { kind: "agent", verb: "explain" },
      ),
    ).toBeUndefined();
    expect(
      resolveDrop({ kind: "codeSelection", nodeIds: [] }, { kind: "agent", verb: "explain" }),
    ).toBeUndefined();
  });

  it("produces no intent type that can accept a proposal", () => {
    const types: Intent["type"][] = [
      "insertBlock",
      "moveBlock",
      "deleteBlock",
      "askAgent",
      "revealNode",
      "highlightNodes",
      "reviewProposal",
    ];
    expect(types.some((type) => /accept|apply/i.test(type))).toBe(false);
  });
});

describe("intentToChange", () => {
  it("maps block mutations to canonical workspace changes and others to undefined", () => {
    const workspace = workspaceWithMoves();
    const change = intentToChange(
      { type: "deleteBlock", location: { container: script, index: 0 } },
      newId,
    );
    expect(change).toEqual({ type: "deleteBlock", location: { container: script, index: 0 } });
    if (change === undefined) {
      throw new Error("expected change");
    }
    expect(applyWorkspaceChange(workspace, change).program.scripts[0]?.statements).toHaveLength(1);
    expect(intentToChange({ type: "revealNode", nodeId: "node:a" }, newId)).toBeUndefined();
    expect(intentToChange({ type: "reviewProposal", proposalId: "p" }, newId)).toBeUndefined();
  });

  it("surfaces the block-editor error when a non-statement block is inserted", () => {
    const change = intentToChange(
      { type: "insertBlock", blockType: "event_on_start", to: { container: script, index: 0 } },
      newId,
    );
    if (change === undefined) {
      throw new Error("expected change");
    }
    expect(() => applyWorkspaceChange(createStarterWorkspace(), change)).toThrow(
      BlockEditorAdapterError,
    );
  });
});
```

`packages/interaction-core/src/keyboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyWorkspaceChange, createStarterWorkspace } from "@agorix/block-editor";
import { programSemanticHashForTest } from "./testing.js";
import { intentToChange, resolveDrop } from "./intents.js";
import { keyboardIntent } from "./keyboard.js";

const script = { kind: "script", scriptIndex: 0 } as const;
let counter = 0;
const newId = () => `block:kb_${(counter += 1)}`;

function seeded() {
  let workspace = createStarterWorkspace();
  for (const [index, blockType] of (
    ["motion_move", "motion_turn", "motion_move"] as const
  ).entries()) {
    const change = intentToChange(
      { type: "insertBlock", blockType, to: { container: script, index } },
      newId,
    );
    if (change === undefined) {
      throw new Error("expected change");
    }
    workspace = applyWorkspaceChange(workspace, change).workspace;
  }
  return workspace;
}

describe("keyboard parity", () => {
  it("moves with Alt+Arrow exactly like dragging to the adjacent slot", () => {
    const workspace = seeded();
    const location = { container: script, index: 1 };
    const keyboard = keyboardIntent("Alt+ArrowDown", { location, siblingCount: 3 });
    const drag = resolveDrop(
      { kind: "block", nodeId: "node:x", location },
      { kind: "slot", to: { container: script, index: 2 } },
    );
    expect(keyboard).toEqual(drag);
    if (keyboard === undefined) {
      throw new Error("expected intent");
    }
    const viaKeyboard = intentToChange(keyboard, newId);
    const viaDrag = intentToChange(drag!, newId);
    expect(viaKeyboard).toEqual(viaDrag);
    if (viaKeyboard === undefined) {
      throw new Error("expected change");
    }
    const result = applyWorkspaceChange(workspace, viaKeyboard);
    expect(programSemanticHashForTest(result.program)).toBe(
      programSemanticHashForTest(applyWorkspaceChange(workspace, viaDrag!).program),
    );
  });

  it("moves up and deletes with the documented chords", () => {
    const location = { container: script, index: 2 };
    expect(keyboardIntent("Alt+ArrowUp", { location, siblingCount: 3 })).toEqual({
      type: "moveBlock",
      from: location,
      to: { container: script, index: 1 },
    });
    expect(keyboardIntent("Delete", { location, siblingCount: 3 })).toEqual({
      type: "deleteBlock",
      location,
    });
  });

  it("produces no intent at the list edges", () => {
    expect(
      keyboardIntent("Alt+ArrowUp", { location: { container: script, index: 0 }, siblingCount: 3 }),
    ).toBeUndefined();
    expect(
      keyboardIntent("Alt+ArrowDown", {
        location: { container: script, index: 2 },
        siblingCount: 3,
      }),
    ).toBeUndefined();
  });
});
```

`packages/interaction-core/src/testing.ts` (test-only helper, not exported from the index):

```ts
import { validateProgram, type ProjectProgram } from "@agorix/program-model";

/** Stable semantic key for parity assertions. */
export function programSemanticHashForTest(program: ProjectProgram): string {
  return JSON.stringify(validateProgram(program));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @agorix/interaction-core test`
Expected: FAIL (`./intents.js`, `./keyboard.js` not found).

- [ ] **Step 3: Implement**

`packages/interaction-core/src/intents.ts`:

```ts
import {
  createDefaultBlock,
  type BlockType,
  type StatementContainerPath,
  type StatementLocation,
  type WorkspaceChange,
} from "@agorix/block-editor";
import { createAnchorRef, isSafeId, parseAnchorRef, type AgentAnchorRef } from "./anchors.js";

export type AgentVerb = "explain" | "debug" | "challenge";

export interface InsertionPoint {
  readonly container: StatementContainerPath;
  readonly index: number;
}

export type DragSource =
  | { readonly kind: "palette"; readonly blockType: BlockType }
  | { readonly kind: "block"; readonly nodeId: string; readonly location: StatementLocation }
  | { readonly kind: "evidence"; readonly rowId: string; readonly nodeId: string }
  | { readonly kind: "codeSelection"; readonly nodeIds: readonly string[] }
  | { readonly kind: "proposal"; readonly proposalId: string };

export type DropTarget =
  | { readonly kind: "slot"; readonly to: InsertionPoint }
  | { readonly kind: "agent"; readonly verb: AgentVerb }
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "canvas" };

/**
 * Closed set of learner intents. There is deliberately no intent that accepts or applies a
 * proposal: dropping a proposal only ever opens review; acceptance is an explicit decision
 * handled by the host, never a gesture.
 */
export type Intent =
  | { readonly type: "insertBlock"; readonly blockType: BlockType; readonly to: InsertionPoint }
  | { readonly type: "moveBlock"; readonly from: StatementLocation; readonly to: InsertionPoint }
  | { readonly type: "deleteBlock"; readonly location: StatementLocation }
  | { readonly type: "askAgent"; readonly verb: AgentVerb; readonly about: AgentAnchorRef }
  | { readonly type: "revealNode"; readonly nodeId: string }
  | { readonly type: "highlightNodes"; readonly nodeIds: readonly string[] }
  | { readonly type: "reviewProposal"; readonly proposalId: string };

function ask(verb: AgentVerb, about: AgentAnchorRef | undefined): Intent | undefined {
  return about === undefined ? undefined : { type: "askAgent", verb, about };
}

export function resolveDrop(source: DragSource, target: DropTarget): Intent | undefined {
  switch (source.kind) {
    case "palette":
      if (target.kind === "slot") {
        return { type: "insertBlock", blockType: source.blockType, to: target.to };
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "paletteItem", id: source.blockType }));
      }
      return undefined;
    case "block":
      if (target.kind === "slot") {
        return { type: "moveBlock", from: source.location, to: target.to };
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "node", id: source.nodeId }));
      }
      return undefined;
    case "evidence":
      if (target.kind === "canvas" || target.kind === "node") {
        return isSafeId(source.nodeId) ? { type: "revealNode", nodeId: source.nodeId } : undefined;
      }
      if (target.kind === "agent") {
        return ask(target.verb, parseAnchorRef({ kind: "evidenceRow", id: source.rowId }));
      }
      return undefined;
    case "codeSelection": {
      const ids = source.nodeIds;
      if (ids.length === 0 || !ids.every(isSafeId)) {
        return undefined;
      }
      if (target.kind === "canvas") {
        return { type: "highlightNodes", nodeIds: ids };
      }
      if (target.kind === "agent") {
        return ask(target.verb, createAnchorRefSafe("node", ids[0]));
      }
      return undefined;
    }
    case "proposal":
      if (!isSafeId(source.proposalId) || target.kind === "agent") {
        return undefined;
      }
      return { type: "reviewProposal", proposalId: source.proposalId };
  }
}

function createAnchorRefSafe(
  kind: AgentAnchorRef["kind"],
  id: string | undefined,
): AgentAnchorRef | undefined {
  return id !== undefined && isSafeId(id) ? createAnchorRef(kind, id) : undefined;
}

/**
 * Maps block-mutating intents to the existing canonical workspace change. Non-mutating intents
 * return undefined. The caller (host) applies the change and handles BlockEditorAdapterError.
 */
export function intentToChange(
  intent: Intent,
  newBlockId: () => string,
): WorkspaceChange | undefined {
  switch (intent.type) {
    case "insertBlock":
      return {
        type: "addBlock",
        container: intent.to.container,
        index: intent.to.index,
        block: createDefaultBlock(intent.blockType, newBlockId()),
      };
    case "moveBlock":
      return { type: "moveBlock", from: intent.from, to: intent.to };
    case "deleteBlock":
      return { type: "deleteBlock", location: intent.location };
    default:
      return undefined;
  }
}
```

`packages/interaction-core/src/keyboard.ts`:

```ts
import type { StatementLocation } from "@agorix/block-editor";
import type { Intent } from "./intents.js";

export type KeyChord = "Alt+ArrowUp" | "Alt+ArrowDown" | "Delete";

export interface FocusedBlock {
  readonly location: StatementLocation;
  readonly siblingCount: number;
}

/** Keyboard equivalents from docs/product/INPUT_PARITY_MATRIX.md; same intents as dragging. */
export function keyboardIntent(chord: KeyChord, focus: FocusedBlock): Intent | undefined {
  const { container, index } = focus.location;
  switch (chord) {
    case "Alt+ArrowUp":
      return index <= 0
        ? undefined
        : { type: "moveBlock", from: focus.location, to: { container, index: index - 1 } };
    case "Alt+ArrowDown":
      return index >= focus.siblingCount - 1
        ? undefined
        : { type: "moveBlock", from: focus.location, to: { container, index: index + 1 } };
    case "Delete":
      return { type: "deleteBlock", location: focus.location };
  }
}
```

Replace `packages/interaction-core/src/index.ts` with:

```ts
/** Pure drag/keyboard intents and agent anchors shared by Web and Studio. No DOM, no VS Code. */
export const PACKAGE_NAME = "@agorix/interaction-core";

export type { AgentAnchorRef, AnchorKind } from "./anchors.js";
export {
  ANCHOR_KINDS,
  createAnchorRef,
  isAnchorKind,
  isSafeId,
  parseAnchorRef,
} from "./anchors.js";
export type { AgentVerb, DragSource, DropTarget, InsertionPoint, Intent } from "./intents.js";
export { intentToChange, resolveDrop } from "./intents.js";
export type { FocusedBlock, KeyChord } from "./keyboard.js";
export { keyboardIntent } from "./keyboard.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @agorix/interaction-core test`
Expected: PASS. If `block:` ids are rejected by `workspaceToProgram` validation in the helper, change `newId` prefixes to match ids already used in `createStarterWorkspace` (`block:scripts_0_...`) and re-run.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `pnpm prettier --write packages/interaction-core && pnpm lint && pnpm --filter @agorix/interaction-core build`
Expected: PASS.

```bash
git add packages/interaction-core
git commit -m "feat(interaction-core): drag intents, drop resolution, keyboard parity

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `agent-workflow` Director/Auditor state machine

**Files:**

- Create: `packages/agent-workflow/package.json`, `packages/agent-workflow/tsconfig.json`, `packages/agent-workflow/vitest.config.ts`, `packages/agent-workflow/src/loop.ts`, `packages/agent-workflow/src/loop.test.ts`, `packages/agent-workflow/src/index.ts`

**Interfaces:**

- Consumes: none (pure).
- Produces:
  - `type WorkflowStage = "intent" | "plan" | "proposal" | "predict" | "run" | "compare" | "explain" | "done"`
  - `type WorkflowMode = "supervised" | "bounded"`
  - `interface WorkflowState { stage; mode; taskIndex: number; taskCount: number; proposalRequested: boolean; rejections: number; predicted: boolean; explained: boolean; completed: boolean }`
  - `type WorkflowEvent` = `intentStated` | `planAccepted{taskCount}` | `proposalRequested` | `proposalDecided{decision: "accepted"|"rejected"|"modified"}` | `predictionMade` | `predictionSkipped` | `runObserved{completed: boolean}` | `compared` | `explained` | `explainSkipped`
  - `type AdvanceResult = { ok: true; state } | { ok: false; error: "INVALID_TRANSITION" }`
  - `createWorkflow(mode): WorkflowState`, `advance(state, event): AdvanceResult`
  - `type AgentAction = "ask-intent" | "offer-plan" | "await-learner-request" | "request-proposal" | "await-decision" | "await-prediction" | "await-run" | "show-comparison" | "ask-explanation" | "none"`; `nextAgentAction(state): AgentAction`
  - `PACKAGE_NAME`

- [ ] **Step 1: Scaffold the package**

Same three config files as Task 4 with name `@agorix/agent-workflow`, no `dependencies` and no `devDependencies`. Run: `pnpm install`.

- [ ] **Step 2: Write the failing test**

`packages/agent-workflow/src/loop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  advance,
  createWorkflow,
  nextAgentAction,
  type WorkflowEvent,
  type WorkflowState,
} from "./loop.js";

function run(state: WorkflowState, events: WorkflowEvent[]): WorkflowState {
  let current = state;
  for (const event of events) {
    const result = advance(current, event);
    if (!result.ok) {
      throw new Error(`rejected ${event.type} at ${current.stage}`);
    }
    current = result.state;
  }
  return current;
}

describe("director/auditor loop", () => {
  it("walks one task through every stage and finishes", () => {
    const end = run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
      { type: "proposalRequested" },
      { type: "proposalDecided", decision: "accepted" },
      { type: "predictionMade" },
      { type: "runObserved", completed: true },
      { type: "compared" },
      { type: "explained" },
    ]);
    expect(end.stage).toBe("done");
    expect(end.completed).toBe(true);
    expect(end.explained).toBe(true);
    expect(end.predicted).toBe(true);
  });

  it("loops to the next task after explain", () => {
    const afterFirst = run(createWorkflow("bounded"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 2 },
      { type: "proposalDecided", decision: "modified" },
      { type: "predictionSkipped" },
      { type: "runObserved", completed: false },
      { type: "compared" },
      { type: "explainSkipped" },
    ]);
    expect(afterFirst.stage).toBe("proposal");
    expect(afterFirst.taskIndex).toBe(1);
    expect(afterFirst.explained).toBe(false);
    expect(afterFirst.completed).toBe(false);
  });

  it("keeps the learner at the proposal stage after a rejection", () => {
    const state = run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
      { type: "proposalRequested" },
      { type: "proposalDecided", decision: "rejected" },
    ]);
    expect(state.stage).toBe("proposal");
    expect(state.rejections).toBe(1);
    expect(state.proposalRequested).toBe(false);
  });

  it("rejects out-of-order events", () => {
    const fresh = createWorkflow("supervised");
    expect(advance(fresh, { type: "runObserved", completed: true })).toEqual({
      ok: false,
      error: "INVALID_TRANSITION",
    });
    const atProposal = run(fresh, [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
    ]);
    expect(advance(atProposal, { type: "predictionMade" }).ok).toBe(false);
    expect(advance(atProposal, { type: "runObserved", completed: true }).ok).toBe(false);
  });

  it("rejects a plan with no tasks", () => {
    const atPlan = run(createWorkflow("supervised"), [{ type: "intentStated" }]);
    expect(advance(atPlan, { type: "planAccepted", taskCount: 0 }).ok).toBe(false);
    expect(advance(atPlan, { type: "planAccepted", taskCount: 1.5 }).ok).toBe(false);
  });

  it("only requests a proposal automatically in bounded mode", () => {
    const supervised = run(createWorkflow("supervised"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
    ]);
    const bounded = run(createWorkflow("bounded"), [
      { type: "intentStated" },
      { type: "planAccepted", taskCount: 1 },
    ]);
    expect(nextAgentAction(supervised)).toBe("await-learner-request");
    expect(nextAgentAction(bounded)).toBe("request-proposal");
    const requested = run(bounded, [{ type: "proposalRequested" }]);
    expect(nextAgentAction(requested)).toBe("await-decision");
  });

  it("maps every stage to an agent action", () => {
    expect(nextAgentAction(createWorkflow("supervised"))).toBe("ask-intent");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @agorix/agent-workflow test`
Expected: FAIL (`./loop.js` not found).

- [ ] **Step 4: Implement**

`packages/agent-workflow/src/loop.ts`:

```ts
export type WorkflowStage =
  "intent" | "plan" | "proposal" | "predict" | "run" | "compare" | "explain" | "done";

export type WorkflowMode = "supervised" | "bounded";

export interface WorkflowState {
  readonly stage: WorkflowStage;
  readonly mode: WorkflowMode;
  readonly taskIndex: number;
  readonly taskCount: number;
  readonly proposalRequested: boolean;
  readonly rejections: number;
  readonly predicted: boolean;
  readonly explained: boolean;
  /** Set only from runtime evidence via runObserved; never from AI judgment. */
  readonly completed: boolean;
}

export type WorkflowEvent =
  | { readonly type: "intentStated" }
  | { readonly type: "planAccepted"; readonly taskCount: number }
  | { readonly type: "proposalRequested" }
  | { readonly type: "proposalDecided"; readonly decision: "accepted" | "rejected" | "modified" }
  | { readonly type: "predictionMade" }
  | { readonly type: "predictionSkipped" }
  | { readonly type: "runObserved"; readonly completed: boolean }
  | { readonly type: "compared" }
  | { readonly type: "explained" }
  | { readonly type: "explainSkipped" };

export type AdvanceResult =
  | { readonly ok: true; readonly state: WorkflowState }
  | { readonly ok: false; readonly error: "INVALID_TRANSITION" };

export type AgentAction =
  | "ask-intent"
  | "offer-plan"
  | "await-learner-request"
  | "request-proposal"
  | "await-decision"
  | "await-prediction"
  | "await-run"
  | "show-comparison"
  | "ask-explanation"
  | "none";

export function createWorkflow(mode: WorkflowMode): WorkflowState {
  return {
    stage: "intent",
    mode,
    taskIndex: 0,
    taskCount: 0,
    proposalRequested: false,
    rejections: 0,
    predicted: false,
    explained: false,
    completed: false,
  };
}

const INVALID: AdvanceResult = { ok: false, error: "INVALID_TRANSITION" };

function ok(state: WorkflowState): AdvanceResult {
  return { ok: true, state };
}

export function advance(state: WorkflowState, event: WorkflowEvent): AdvanceResult {
  switch (event.type) {
    case "intentStated":
      return state.stage === "intent" ? ok({ ...state, stage: "plan" }) : INVALID;
    case "planAccepted":
      if (state.stage !== "plan" || !Number.isInteger(event.taskCount) || event.taskCount < 1) {
        return INVALID;
      }
      return ok({ ...state, stage: "proposal", taskIndex: 0, taskCount: event.taskCount });
    case "proposalRequested":
      return state.stage === "proposal" ? ok({ ...state, proposalRequested: true }) : INVALID;
    case "proposalDecided":
      if (state.stage !== "proposal") {
        return INVALID;
      }
      if (event.decision === "rejected") {
        return ok({ ...state, proposalRequested: false, rejections: state.rejections + 1 });
      }
      return ok({
        ...state,
        stage: "predict",
        proposalRequested: false,
        predicted: false,
        explained: false,
      });
    case "predictionMade":
    case "predictionSkipped":
      return state.stage === "predict"
        ? ok({ ...state, stage: "run", predicted: event.type === "predictionMade" })
        : INVALID;
    case "runObserved":
      return state.stage === "run"
        ? ok({ ...state, stage: "compare", completed: event.completed })
        : INVALID;
    case "compared":
      return state.stage === "compare" ? ok({ ...state, stage: "explain" }) : INVALID;
    case "explained":
    case "explainSkipped": {
      if (state.stage !== "explain") {
        return INVALID;
      }
      const explained = event.type === "explained";
      const nextIndex = state.taskIndex + 1;
      if (nextIndex >= state.taskCount) {
        return ok({ ...state, stage: "done", explained });
      }
      return ok({
        ...state,
        stage: "proposal",
        taskIndex: nextIndex,
        explained,
        completed: false,
        rejections: 0,
      });
    }
  }
}

export function nextAgentAction(state: WorkflowState): AgentAction {
  switch (state.stage) {
    case "intent":
      return "ask-intent";
    case "plan":
      return "offer-plan";
    case "proposal":
      if (state.proposalRequested) {
        return "await-decision";
      }
      return state.mode === "bounded" ? "request-proposal" : "await-learner-request";
    case "predict":
      return "await-prediction";
    case "run":
      return "await-run";
    case "compare":
      return "show-comparison";
    case "explain":
      return "ask-explanation";
    case "done":
      return "none";
  }
}
```

`packages/agent-workflow/src/index.ts`:

```ts
/** Platform-neutral Director/Auditor workflow and assistance policy. No DOM, VS Code or provider code. */
export const PACKAGE_NAME = "@agorix/agent-workflow";

export type {
  AdvanceResult,
  AgentAction,
  WorkflowEvent,
  WorkflowMode,
  WorkflowStage,
  WorkflowState,
} from "./loop.js";
export { advance, createWorkflow, nextAgentAction } from "./loop.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @agorix/agent-workflow test`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/agent-workflow pnpm-lock.yaml
git commit -m "feat(agent-workflow): Director/Auditor loop state machine

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Assistance ladder and agent agreements

**Files:**

- Create: `packages/agent-workflow/src/assistance.ts`, `packages/agent-workflow/src/assistance.test.ts`
- Modify: `packages/agent-workflow/src/index.ts`

**Interfaces:**

- Consumes: none.
- Produces:
  - `type AssistanceLevel = 0 | 1 | 2 | 3 | 4 | 5`
  - `type OfferableSignal = "runtime-error" | "stalled" | "repeated-error" | "repeat-pattern" | "first-step"`
  - `interface AgentAgreements { aiEnabled: boolean; assistanceCeiling: AssistanceLevel; mode: WorkflowMode; proactive: Readonly<Record<OfferableSignal, boolean>> }`
  - `DEFAULT_AGREEMENTS: AgentAgreements`
  - `nextAssistanceLevel(current, signal: { repeatedFailures: number; explicitStrongerHelp: boolean }): AssistanceLevel`
  - `deescalate(level): AssistanceLevel`
  - `effectiveAssistance(agreements, requested): AssistanceLevel`
  - `canOffer(agreements, signal: OfferableSignal): boolean`

- [ ] **Step 1: Write the failing test**

`packages/agent-workflow/src/assistance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGREEMENTS,
  canOffer,
  deescalate,
  effectiveAssistance,
  nextAssistanceLevel,
} from "./assistance.js";

describe("assistance ladder", () => {
  it("stays put with no failures and rises one level per call after failures", () => {
    expect(nextAssistanceLevel(0, { repeatedFailures: 0, explicitStrongerHelp: false })).toBe(0);
    expect(nextAssistanceLevel(0, { repeatedFailures: 1, explicitStrongerHelp: false })).toBe(1);
    expect(nextAssistanceLevel(2, { repeatedFailures: 3, explicitStrongerHelp: false })).toBe(3);
  });

  it("never reaches the complete solution without an explicit request after repeated failure", () => {
    expect(nextAssistanceLevel(4, { repeatedFailures: 9, explicitStrongerHelp: false })).toBe(4);
    expect(nextAssistanceLevel(4, { repeatedFailures: 1, explicitStrongerHelp: true })).toBe(4);
    expect(nextAssistanceLevel(4, { repeatedFailures: 2, explicitStrongerHelp: true })).toBe(5);
  });

  it("de-escalates by one and never below zero", () => {
    expect(deescalate(3)).toBe(2);
    expect(deescalate(0)).toBe(0);
  });
});

describe("agent agreements", () => {
  it("clamps the requested level to the learner's ceiling", () => {
    expect(effectiveAssistance({ ...DEFAULT_AGREEMENTS, assistanceCeiling: 2 }, 5)).toBe(2);
    expect(effectiveAssistance({ ...DEFAULT_AGREEMENTS, assistanceCeiling: 4 }, 3)).toBe(3);
  });

  it("gives no help and no offers when AI is disabled", () => {
    const off = { ...DEFAULT_AGREEMENTS, aiEnabled: false };
    expect(effectiveAssistance(off, 5)).toBe(0);
    for (const signal of [
      "runtime-error",
      "stalled",
      "repeated-error",
      "repeat-pattern",
      "first-step",
    ] as const) {
      expect(canOffer(off, signal)).toBe(false);
    }
  });

  it("offers only the signals the learner enabled", () => {
    const agreements = {
      ...DEFAULT_AGREEMENTS,
      proactive: { ...DEFAULT_AGREEMENTS.proactive, stalled: false },
    };
    expect(canOffer(agreements, "stalled")).toBe(false);
    expect(canOffer(agreements, "runtime-error")).toBe(true);
  });

  it("defaults to supervised mode and a ceiling below the complete solution", () => {
    expect(DEFAULT_AGREEMENTS.mode).toBe("supervised");
    expect(DEFAULT_AGREEMENTS.assistanceCeiling).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @agorix/agent-workflow test`
Expected: FAIL (`./assistance.js` not found).

- [ ] **Step 3: Implement**

`packages/agent-workflow/src/assistance.ts`:

```ts
import type { WorkflowMode } from "./loop.js";

export type AssistanceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type OfferableSignal =
  "runtime-error" | "stalled" | "repeated-error" | "repeat-pattern" | "first-step";

/** Visible, learner-controlled settings for how the agent behaves. No hidden configuration. */
export interface AgentAgreements {
  readonly aiEnabled: boolean;
  /** Highest hint-ladder level the agent may use (PEDAGOGY.md levels 0-5). */
  readonly assistanceCeiling: AssistanceLevel;
  readonly mode: WorkflowMode;
  readonly proactive: Readonly<Record<OfferableSignal, boolean>>;
}

export const DEFAULT_AGREEMENTS: AgentAgreements = {
  aiEnabled: true,
  assistanceCeiling: 4,
  mode: "supervised",
  proactive: {
    "runtime-error": true,
    stalled: true,
    "repeated-error": true,
    "repeat-pattern": true,
    "first-step": true,
  },
};

const COMPLETE_SOLUTION: AssistanceLevel = 5;
const REPEATED_FAILURE_FOR_COMPLETE = 2;

/** Rises at most one level per call; level 5 needs an explicit request after repeated failure. */
export function nextAssistanceLevel(
  current: AssistanceLevel,
  signal: { readonly repeatedFailures: number; readonly explicitStrongerHelp: boolean },
): AssistanceLevel {
  if (signal.repeatedFailures < 1 || current >= COMPLETE_SOLUTION) {
    return current;
  }
  const next = (current + 1) as AssistanceLevel;
  if (
    next === COMPLETE_SOLUTION &&
    !(signal.explicitStrongerHelp && signal.repeatedFailures >= REPEATED_FAILURE_FOR_COMPLETE)
  ) {
    return current;
  }
  return next;
}

export function deescalate(level: AssistanceLevel): AssistanceLevel {
  return Math.max(0, level - 1) as AssistanceLevel;
}

export function effectiveAssistance(
  agreements: AgentAgreements,
  requested: AssistanceLevel,
): AssistanceLevel {
  if (!agreements.aiEnabled) {
    return 0;
  }
  return Math.min(requested, agreements.assistanceCeiling) as AssistanceLevel;
}

export function canOffer(agreements: AgentAgreements, signal: OfferableSignal): boolean {
  return agreements.aiEnabled && agreements.proactive[signal];
}
```

Append to `packages/agent-workflow/src/index.ts`:

```ts
export type { AgentAgreements, AssistanceLevel, OfferableSignal } from "./assistance.js";
export {
  DEFAULT_AGREEMENTS,
  canOffer,
  deescalate,
  effectiveAssistance,
  nextAssistanceLevel,
} from "./assistance.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @agorix/agent-workflow test`
Expected: PASS (all tests).

- [ ] **Step 5: Lint, typecheck, commit**

Run: `pnpm prettier --write packages/agent-workflow && pnpm lint && pnpm --filter @agorix/agent-workflow build`
Expected: PASS.

```bash
git add packages/agent-workflow
git commit -m "feat(agent-workflow): assistance ladder and agent agreements

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `studio-protocol`

**Files:**

- Create: `packages/studio-protocol/package.json`, `packages/studio-protocol/tsconfig.json`, `packages/studio-protocol/vitest.config.ts`, `packages/studio-protocol/src/index.ts`, `packages/studio-protocol/src/index.test.ts`

**Interfaces:**

- Consumes: from `@agorix/interaction-core`: `Intent`, `parseAnchorRef`, `isSafeId`, `ANCHOR_KINDS`; from `@agorix/agent-workflow`: `WorkflowState`, `AgentAgreements`, `OfferableSignal`, `AssistanceLevel`.
- Produces:
  - `STUDIO_PROTOCOL_VERSION = "agorix/studio-protocol/v1"`
  - `type UiMessage` = `{schema; type:"ready"}` | `{schema; type:"intent"; intent: Intent}` | `{schema; type:"agreementsChanged"; agreements: AgentAgreements}` | `{schema; type:"decideProposal"; proposalId; decision: "accepted"|"rejected"|"modified"}`
  - `type HostMessage` = `{schema; type:"workflow"; state: WorkflowState}` | `{schema; type:"programHash"; hash: string}` | `{schema; type:"agentUnavailable"}`
  - `parseUiMessage(value: unknown): UiMessage | undefined`, `parseHostMessage(value: unknown): HostMessage | undefined`

- [ ] **Step 1: Scaffold**

Configs as in Task 4, name `@agorix/studio-protocol`, dependencies `@agorix/interaction-core` and `@agorix/agent-workflow` (`workspace:*`), devDependency `@agorix/block-editor`. Run: `pnpm install`.

- [ ] **Step 2: Write the failing test**

`packages/studio-protocol/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_AGREEMENTS, createWorkflow } from "@agorix/agent-workflow";
import { STUDIO_PROTOCOL_VERSION, parseHostMessage, parseUiMessage } from "./index.js";

const schema = STUDIO_PROTOCOL_VERSION;
const script = { kind: "script", scriptIndex: 0 } as const;

describe("ui messages", () => {
  it("accepts well-formed messages", () => {
    expect(parseUiMessage({ schema, type: "ready" })).toEqual({ schema, type: "ready" });
    const intent = {
      type: "moveBlock",
      from: { container: script, index: 0 },
      to: { container: script, index: 1 },
    };
    expect(parseUiMessage({ schema, type: "intent", intent })).toEqual({
      schema,
      type: "intent",
      intent,
    });
    expect(
      parseUiMessage({
        schema,
        type: "decideProposal",
        proposalId: "prop:1",
        decision: "rejected",
      }),
    ).toEqual({ schema, type: "decideProposal", proposalId: "prop:1", decision: "rejected" });
    expect(
      parseUiMessage({ schema, type: "agreementsChanged", agreements: DEFAULT_AGREEMENTS }),
    ).toEqual({ schema, type: "agreementsChanged", agreements: DEFAULT_AGREEMENTS });
  });

  it("rejects junk, wrong schema, unknown types and bad ids", () => {
    for (const junk of [
      null,
      7,
      "ready",
      {},
      { schema: "other", type: "ready" },
      { schema, type: "mutateProgram" },
      { schema, type: "intent", intent: { type: "acceptProposal", proposalId: "p" } },
      { schema, type: "intent", intent: { type: "reviewProposal", proposalId: "/etc/passwd" } },
      { schema, type: "decideProposal", proposalId: "p", decision: "applied" },
      { schema, type: "agreementsChanged", agreements: { aiEnabled: "yes" } },
    ]) {
      expect(parseUiMessage(junk)).toBeUndefined();
    }
  });

  it("drops extra keys including __proto__", () => {
    const parsed = parseUiMessage(
      JSON.parse(
        '{"schema":"agorix/studio-protocol/v1","type":"ready","__proto__":{"x":1},"extra":1}',
      ),
    );
    expect(parsed).toEqual({ schema, type: "ready" });
  });
});

describe("host messages", () => {
  it("accepts workflow state, program hash and unavailable", () => {
    const state = createWorkflow("supervised");
    expect(parseHostMessage({ schema, type: "workflow", state })).toEqual({
      schema,
      type: "workflow",
      state,
    });
    expect(parseHostMessage({ schema, type: "programHash", hash: "abc123" })).toEqual({
      schema,
      type: "programHash",
      hash: "abc123",
    });
    expect(parseHostMessage({ schema, type: "agentUnavailable" })).toEqual({
      schema,
      type: "agentUnavailable",
    });
  });

  it("rejects malformed host messages", () => {
    expect(
      parseHostMessage({ schema, type: "workflow", state: { stage: "nope" } }),
    ).toBeUndefined();
    expect(parseHostMessage({ schema, type: "programHash", hash: "has space" })).toBeUndefined();
    expect(parseHostMessage({ schema: "x", type: "agentUnavailable" })).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @agorix/studio-protocol test`
Expected: FAIL (`./index.js` has no exports).

- [ ] **Step 4: Implement**

`packages/studio-protocol/src/index.ts`:

```ts
import type {
  AgentAgreements,
  AssistanceLevel,
  OfferableSignal,
  WorkflowMode,
  WorkflowStage,
  WorkflowState,
} from "@agorix/agent-workflow";
import { isSafeId, parseAnchorRef, type Intent } from "@agorix/interaction-core";

/** Versioned host <-> UI messages. UIs send intents; the host owns canonical mutation. */
export const STUDIO_PROTOCOL_VERSION = "agorix/studio-protocol/v1";
export const PACKAGE_NAME = "@agorix/studio-protocol";

type Schema = typeof STUDIO_PROTOCOL_VERSION;
type Decision = "accepted" | "rejected" | "modified";

export type UiMessage =
  | { readonly schema: Schema; readonly type: "ready" }
  | { readonly schema: Schema; readonly type: "intent"; readonly intent: Intent }
  | {
      readonly schema: Schema;
      readonly type: "agreementsChanged";
      readonly agreements: AgentAgreements;
    }
  | {
      readonly schema: Schema;
      readonly type: "decideProposal";
      readonly proposalId: string;
      readonly decision: Decision;
    };

export type HostMessage =
  | { readonly schema: Schema; readonly type: "workflow"; readonly state: WorkflowState }
  | { readonly schema: Schema; readonly type: "programHash"; readonly hash: string }
  | { readonly schema: Schema; readonly type: "agentUnavailable" };

const DECISIONS: readonly Decision[] = ["accepted", "rejected", "modified"];
const STAGES: readonly WorkflowStage[] = [
  "intent",
  "plan",
  "proposal",
  "predict",
  "run",
  "compare",
  "explain",
  "done",
];
const MODES: readonly WorkflowMode[] = ["supervised", "bounded"];
const SIGNALS: readonly OfferableSignal[] = [
  "runtime-error",
  "stalled",
  "repeated-error",
  "repeat-pattern",
  "first-step",
];
const AGENT_VERBS = ["explain", "debug", "challenge"] as const;

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

function parseContainer(value: unknown): Obj | undefined {
  if (!isObject(value) || !isIndex(value["scriptIndex"])) {
    return undefined;
  }
  if (value["kind"] === "script") {
    return { kind: "script", scriptIndex: value["scriptIndex"] };
  }
  const path = value["statementPath"];
  if (
    (value["kind"] === "repeatBody" || value["kind"] === "ifThen") &&
    Array.isArray(path) &&
    path.length <= 16 &&
    path.every(isIndex)
  ) {
    return { kind: value["kind"], scriptIndex: value["scriptIndex"], statementPath: [...path] };
  }
  return undefined;
}

function parseLocation(value: unknown): { container: Obj; index: number } | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const container = parseContainer(value["container"]);
  return container !== undefined && isIndex(value["index"])
    ? { container, index: value["index"] }
    : undefined;
}

const BLOCK_TYPES = [
  "event_on_start",
  "motion_move",
  "motion_turn",
  "control_repeat",
  "control_if",
  "sensing_touching_goal",
  "literal_boolean",
  "literal_number",
] as const;

function parseIntent(value: unknown): Intent | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  switch (value["type"]) {
    case "insertBlock": {
      const to = parseLocation(value["to"]);
      const blockType = (BLOCK_TYPES as readonly unknown[]).includes(value["blockType"])
        ? (value["blockType"] as (typeof BLOCK_TYPES)[number])
        : undefined;
      return to === undefined || blockType === undefined
        ? undefined
        : ({ type: "insertBlock", blockType, to } as Intent);
    }
    case "moveBlock": {
      const from = parseLocation(value["from"]);
      const to = parseLocation(value["to"]);
      return from === undefined || to === undefined
        ? undefined
        : ({ type: "moveBlock", from, to } as Intent);
    }
    case "deleteBlock": {
      const location = parseLocation(value["location"]);
      return location === undefined ? undefined : ({ type: "deleteBlock", location } as Intent);
    }
    case "askAgent": {
      const about = parseAnchorRef(value["about"]);
      const verb = (AGENT_VERBS as readonly unknown[]).includes(value["verb"])
        ? (value["verb"] as (typeof AGENT_VERBS)[number])
        : undefined;
      return about === undefined || verb === undefined
        ? undefined
        : { type: "askAgent", verb, about };
    }
    case "revealNode":
      return isSafeId(value["nodeId"])
        ? { type: "revealNode", nodeId: value["nodeId"] }
        : undefined;
    case "highlightNodes": {
      const ids = value["nodeIds"];
      return Array.isArray(ids) && ids.length > 0 && ids.length <= 16 && ids.every(isSafeId)
        ? { type: "highlightNodes", nodeIds: [...ids] as string[] }
        : undefined;
    }
    case "reviewProposal":
      return isSafeId(value["proposalId"])
        ? { type: "reviewProposal", proposalId: value["proposalId"] }
        : undefined;
    default:
      return undefined;
  }
}

function parseAgreements(value: unknown): AgentAgreements | undefined {
  if (!isObject(value) || typeof value["aiEnabled"] !== "boolean") {
    return undefined;
  }
  const ceiling = value["assistanceCeiling"];
  const mode = value["mode"];
  const proactive = value["proactive"];
  if (
    typeof ceiling !== "number" ||
    !Number.isInteger(ceiling) ||
    ceiling < 0 ||
    ceiling > 5 ||
    !(MODES as readonly unknown[]).includes(mode) ||
    !isObject(proactive)
  ) {
    return undefined;
  }
  const flags = {} as Record<OfferableSignal, boolean>;
  for (const signal of SIGNALS) {
    const flag = proactive[signal];
    if (typeof flag !== "boolean") {
      return undefined;
    }
    flags[signal] = flag;
  }
  return {
    aiEnabled: value["aiEnabled"],
    assistanceCeiling: ceiling as AssistanceLevel,
    mode: mode as WorkflowMode,
    proactive: flags,
  };
}

function parseWorkflowState(value: unknown): WorkflowState | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const { stage, mode, taskIndex, taskCount, rejections } = value;
  if (
    !(STAGES as readonly unknown[]).includes(stage) ||
    !(MODES as readonly unknown[]).includes(mode) ||
    !isIndex(taskIndex) ||
    !isIndex(taskCount) ||
    !isIndex(rejections) ||
    typeof value["proposalRequested"] !== "boolean" ||
    typeof value["predicted"] !== "boolean" ||
    typeof value["explained"] !== "boolean" ||
    typeof value["completed"] !== "boolean"
  ) {
    return undefined;
  }
  return {
    stage: stage as WorkflowStage,
    mode: mode as WorkflowMode,
    taskIndex,
    taskCount,
    rejections,
    proposalRequested: value["proposalRequested"],
    predicted: value["predicted"],
    explained: value["explained"],
    completed: value["completed"],
  };
}

export function parseUiMessage(value: unknown): UiMessage | undefined {
  if (!isObject(value) || value["schema"] !== STUDIO_PROTOCOL_VERSION) {
    return undefined;
  }
  const schema = STUDIO_PROTOCOL_VERSION;
  switch (value["type"]) {
    case "ready":
      return { schema, type: "ready" };
    case "intent": {
      const intent = parseIntent(value["intent"]);
      return intent === undefined ? undefined : { schema, type: "intent", intent };
    }
    case "agreementsChanged": {
      const agreements = parseAgreements(value["agreements"]);
      return agreements === undefined
        ? undefined
        : { schema, type: "agreementsChanged", agreements };
    }
    case "decideProposal": {
      const decision = value["decision"];
      return isSafeId(value["proposalId"]) && (DECISIONS as readonly unknown[]).includes(decision)
        ? {
            schema,
            type: "decideProposal",
            proposalId: value["proposalId"],
            decision: decision as Decision,
          }
        : undefined;
    }
    default:
      return undefined;
  }
}

export function parseHostMessage(value: unknown): HostMessage | undefined {
  if (!isObject(value) || value["schema"] !== STUDIO_PROTOCOL_VERSION) {
    return undefined;
  }
  const schema = STUDIO_PROTOCOL_VERSION;
  switch (value["type"]) {
    case "workflow": {
      const state = parseWorkflowState(value["state"]);
      return state === undefined ? undefined : { schema, type: "workflow", state };
    }
    case "programHash":
      return isSafeId(value["hash"])
        ? { schema, type: "programHash", hash: value["hash"] }
        : undefined;
    case "agentUnavailable":
      return { schema, type: "agentUnavailable" };
    default:
      return undefined;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @agorix/studio-protocol test`
Expected: PASS. If the `decideProposal`/`agreementsChanged` round-trip `toEqual` fails on key order or readonly spread, fix the parser output shape, not the test.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `pnpm prettier --write packages/studio-protocol && pnpm lint && pnpm --filter @agorix/studio-protocol build`
Expected: PASS.

```bash
git add packages/studio-protocol pnpm-lock.yaml
git commit -m "feat(studio-protocol): versioned host/UI messages with strict parsers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification and PR

**Files:** none new.

- [ ] **Step 1: Run the repo verification**

Run: `pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm security:check`
Expected: all PASS. Investigate any failure with `superpowers:systematic-debugging`; do not skip checks.

- [ ] **Step 2: Confirm boundaries**

Run: `grep -rnE "from \"(vscode|react|react-dom)\"|window\.|document\." packages/interaction-core/src packages/agent-workflow/src packages/studio-protocol/src`
Expected: no matches.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin docs/studio-refactor-spec
gh pr create --title "Studio refactor: foundations, ADR 0007 and headless core" --body "Implements Plan A of docs/superpowers/specs/2026-10-04-studio-refactor-design.md: FOUNDATIONS.md, PUBLIC_BENEFIT.md, ADR 0007, and the interaction-core, agent-workflow and studio-protocol packages.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Do not self-merge (AGENTS.md).

---

## Self-review

- **Spec coverage:** D2 -> Tasks 4-8; D4 (agreements, proactive cards, supervised/bounded) -> Tasks 6-7; D5 anchors -> Task 4 (the `AgentLayer` UI is Phase 3); D6 -> Tasks 1-2; D7 -> Task 3. D1, D3, the Workbench refactor of `extension.ts`, density levels and the cross-surface gate are Phases 3-5 and belong to later plans.
- **Placeholders:** none; the one deliberate fill-in is the verified OECD-EC edition recorded in Task 1 Step 1.
- **Type consistency:** `Intent`, `AgentAnchorRef`, `WorkflowState`, `AgentAgreements` and `AssistanceLevel` are defined once and consumed with the same names in Task 8.
- **Review Focus:** each line is pinned by a test: proposal drops (Task 5), invalid pairs and edge keys (Task 5), non-statement insert (Task 5), reducer ordering and rejection (Task 6), parser junk and `__proto__` (Tasks 4 and 8), `aiEnabled: false` (Task 7).
