<!-- agora-ai-sdlc:construction/v1 -->

# Logical Design — issue-96

## Dependency direction

```
selection.ts -> index.ts (negotiateCapability, ProviderRuntimeContractError, types)
index.ts -> selection.ts (re-export, `export * from "./selection.js"`)
```

This is a benign ESM circular reference: `selection.ts` only uses `index.ts`
exports inside function bodies (not at module-evaluation time), so there is
no initialization-order hazard — verified by `pnpm test`/`pnpm build`
succeeding.

## Selection algorithm

1. If `config.offline === true`, mark every preferred runtime
   `excluded-offline` and return `{ status: "unavailable", reason:
   "offline-mode" }` immediately — no runtime is touched.
2. Walk `config.preferredOrder` (an explicit allowlist, not a hint): skip a
   runtimeId not present in `runtimes`; skip if `allowRemote === false` and
   the descriptor is remote; skip if `negotiateCapability` reports
   unsupported; skip if `health.get(runtimeId) === "unavailable"`.
3. First runtime that survives all checks is selected, with `attempts`
   recording every runtime considered and why.
4. If nothing was selected: `"offline-mode"` was already handled in step 1;
   otherwise `"no-compatible-provider"` if every attempt was
   `capability-unsupported`, else `"all-unavailable"`.

## Not in scope for this slice

Wiring `apps/web`'s tutor/hint button to call `selectProviderRuntime` with a
real multi-runtime configuration (Ollama + OpenAI-compatible + fake) is
deferred: `App.tsx` currently calls the older, always-available
`createDeterministicTutorResponse` path directly (pre-#85/#92), which
already satisfies "canonical/runtime behavior unchanged" and "offline mode
does not call network" for the shipped POC. Rewiring the UI to a live
multi-provider configuration is a separate, larger change with its own
product decisions (which providers ship by default, how a
parent/teacher configures them) better scoped as its own issue rather than
folded into this contract-level deliverable.
