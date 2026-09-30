# Agorix MVP demo script

## Purpose

Demonstrate the completed AI-native learner loop from a clean checkout without requiring a real
LLM provider or network inference.

## Clean checkout

```bash
git clone https://github.com/Modern-Ash/agorix.git
cd agorix
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm --filter @agorix/web test:e2e
pnpm --filter @agorix/web dev
```

The deterministic learner path requires no provider credentials.

## Demo A — AI proposes, child decides

1. Open Agorix Web.
2. Add a Move action and keep Code visible.
3. Open **Try an AI suggestion**.
4. Show the proposal card and **AI suggestion — not applied yet** provenance.
5. Show that canonical state has not changed.
6. Observe that Accept is disabled until the learner makes a prediction.
7. Record the prediction that the proposed 120 steps will reach the goal.
8. Accept the proposal.
9. Run it.
10. Observe deterministic **stopped short** runtime evidence.
11. Inspect Trace and request bounded evidence-grounded help.
12. Change the learner-owned Move value to 160.
13. Run again.
14. Observe deterministic mission completion.
15. Read the reflection asking what was wrong with the AI suggestion and what evidence proved it.

Expected principle:

> AI proposes. Child decides. Runtime proves. Child explains.

## Demo B — transparent execution

1. Use Step rather than Run.
2. Observe synchronized active block and textual-code range.
3. Inspect before/after state in Trace.
4. Show that runtime facts are labeled separately from AI suggestions.

## Demo C — one program, multiple languages

Use the Code Surface selector on the same canonical program:

- TypeScript;
- Agorix Code;
- Python.

Enable comparison and show that the program does not change when its textual projection changes.

Lua exists only as a LanguagePack conformance spike and is not a default learner language.

## Demo D — tablet / touch

Run the First Mission at tablet landscape and portrait sizes.

Demonstrate:

- World + Code remain primary;
- Action Palette;
- touch-friendly Run/Step/Reset;
- no-drag edit/reorder path;
- orientation change preserves canonical state.

## Demo E — Studio / cross-surface

Open the shared canonical project through Agorix Studio and demonstrate the first Studio slice:

- textual projection;
- World Preview;
- execution evidence/inspector;
- structured ProgramProposal review.

Use the cross-surface compatibility fixture/evidence from #121 to explain that presentation state
may differ but canonical semantics do not.

## Provider / Decision Plane evidence

Explain rather than benchmark:

```text
System-0 deterministic policy
  -> Laya System-1 only when bounded classification is unresolved
  -> LearningRequirements
       -> deterministic / no provider
       -> local
       -> remote when explicitly permitted
```

Use `docs/evidence/PROVIDER_MATRIX.md` for CI-backed contract evidence.

## Explicitly deferred

- deployment/self-hosting guide: #98;
- native Android/iOS decision: #37;
- advanced two-model comparison activity: #101;
- broader Studio/world/curriculum features beyond the completed MVP slices.

These do not block the MVP learner loop.
