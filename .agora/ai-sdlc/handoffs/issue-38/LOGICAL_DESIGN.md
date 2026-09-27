# Logical Design

## First-slice flow

```text
StoredProject
  -> validate canonical program
  -> project textual code + node ranges
  -> run/step shared runtime
  -> World Preview frames + Execution Inspector rows
```

## Proposal flow

```text
Accepted ProjectProgram
  -> ProgramProposal
  -> review projection/ranges
  -> reject: accepted program unchanged
  -> apply: accepted program replaced explicitly with validated proposal
```

## VS Code boundary

`extension.ts` owns command registration. Shared Studio behavior is in pure modules so tests can run without launching VS Code.
