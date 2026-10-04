# Agent execution contract

Agorix is built under Agora AI-SDLC. GitHub issues are the executable work queue; the documents under `docs/` are the product and architecture source of truth.

## Thin-host mode for VS Code skills

When this process is invoked through the repo-local `agora-flow` skill in Codex or Claude, it is **not the executor**. It is only a transport/control host for Agora AI-SDLC.

In thin-host mode, do **not** perform the mandatory workflow below yourself. Specifically, do not read the issue body, specs, source files, diffs, tests, logs or architecture docs; do not plan, implement, test, review, choose providers/models, reproduce gate logic, or infer lifecycle transitions.

Allowed host actions are limited to:

1. Invoke `aisdlc` commands for the exact Work/issue.
2. Never pass `--agent` or `--model`; let `routing.profile=cheap-first` choose.
3. Observe the durable result with `aisdlc observe ... --json`.
4. Report only a compact execution/result summary or a human decision requested by Agora.
5. Stop. Do not continue reasoning about the implementation.

The executor selected by Agora remains subject to the full mandatory workflow and all product/architecture invariants below. Thin-host mode reduces duplicated model reasoning; it does not weaken authority or governance.

## Mandatory workflow

1. Read the assigned issue and every referenced spec before changing code. Read `docs/FOUNDATIONS.md` for product philosophy.
2. Do not expand scope silently. Open or request a clarification when a product/architecture decision is not covered.
3. Produce the artifacts requested by the issue before or together with implementation.
4. Keep changes small enough to review independently.
5. Add deterministic tests for success and failure paths.
6. Never put provider credentials, child personal data, secrets or production identifiers in source, fixtures or logs.
7. Open a PR linked to the issue. Do not self-merge.
8. Treat human review and CI evidence as gates, not ceremony.

## Product invariants

- AI proposes. The learner decides. Runtime proves. The learner explains.
- Nothing happens under the rug.
- The learner creates; AI assists, proposes, challenges and explains.
- No AI-originated code or program mutation may enter accepted program state invisibly.
- Every AI-originated programming suggestion is a proposal until the learner accepts, rejects or modifies it.
- Code is continuously visible in the normal learning flow.
- Runtime evidence, not AI language, proves program behavior and mission completion.
- The learner must be able to explain one relevant programming concept or change.
- A project must execute without AI availability.
- Child safety and privacy constraints override engagement, personalization and AI convenience.
- Provider/model identity is an implementation detail, not product authority.

## Architecture invariants

- TypeScript first.
- Web client and execution engine are separable.
- Program model is serializable, versioned and canonical.
- Visual blocks, generated text and language views derive from the canonical program; they do not own separate program state.
- Runtime executes the canonical program, never raw Blockly data, generated provider output or arbitrary displayed text.
- Learning Companion behavior must be grounded in mission context, canonical program snapshots and deterministic runtime evidence.
- AI provider integration is behind a server-side/provider-adapter boundary.
- Domain packages must not import UI framework code, provider SDKs, browser-only APIs, Capacitor APIs or VS Code APIs.
- Repository build, tests and core product behavior must not require provider credentials.

## Proposal and mutation rules

Any AI-originated program change must follow this path:

```text
learner intent
  -> Learning Companion proposal
  -> structured validation
  -> learner-visible preview/diff
  -> learner accept / reject / modify
  -> canonical program mutation
  -> deterministic runtime
  -> runtime evidence
```

Agents MUST NOT:

- apply AI-generated program changes directly to canonical state;
- hide proposal diffs or code visibility;
- treat fluent model output as proof of behavior;
- execute provider-generated source directly as learner program source;
- add provider-specific fields to domain contracts;
- require secrets or child PII for local development, tests or core learning flow.

## Agorix-specific invariants

- Generated code is continuously visible beside or directly below the visual block program during normal editing.
- Visual blocks and generated code never own separate program state; both derive from the canonical program model.
- Generated textual code is display/learning output in the POC and is never executed.
- Language projections must preserve semantic correspondence with canonical nodes.
- Tutor terminology in older packages/docs refers only to a legacy adapter capability. The product capability is the provider-neutral Learning Companion.
- Every PR SHOULD identify the producing agent/runtime and reviewer when AI agents are used.
- Claude, Codex, Copilot, OpenCode and local agents are interchangeable executors; none is the product architecture authority.
- A change produced by one agent SHOULD be independently reviewed by a different agent/provider or a human when practical.
