# Canonical trace evidence boundary — experimental

Agorix maps its own deterministic `RunResult` into a bounded Ori-compatible trace summary. The adapter requires a completed execution, 1–100 steps, exact trace length, and consecutive one-based canonical step numbers. It emits zero-based indices and fixed operation-category descriptions. Raw node IDs, learner text, source code, world state and coordinates are excluded.

The experimental Ori panel displays only the count of validated steps; the trace stays in Agorix. **This PR does not transmit traces to Ori, prove the runtime outcome correct, create a proposal, or enable editing.** The next vertical increment must connect host-authorized read-only ports to Ori and verify proposal/revision binding end-to-end.

Run unit tests and browser regression suites, `pnpm verify`, and `pnpm format:check`. Agorix target branch: `integration/ori` only.
