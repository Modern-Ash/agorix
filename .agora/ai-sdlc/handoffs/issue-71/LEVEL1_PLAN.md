# Level 1 Plan - Issue #71

## Goal

Revise the MVP, competitive principles and implementation order so the AI-native north star governs the next implementation agents.

## Plan

1. Update `docs/product/MVP.md`.
   - Make the MVP exit criteria require learner intent, bounded AI proposal, visible proposal changes, learner accept/reject/modify, deterministic run/step evidence, correction and explanation.
   - Preserve the AI-unavailable path and local/open model demonstrability.

2. Update `docs/product/COMPETITIVE_PRINCIPLES.md`.
   - Distinguish block-first creative tools, block-to-text tools, coding tools with chat assistants and Agorix's transparent AI-native loop.
   - Keep useful inherited patterns while making the Agorix-specific decision boundary explicit.

3. Update `docs/delivery/IMPLEMENTATION_ORDER.md`.
   - Promote #106 from temporary map into the durable implementation order.
   - Reconcile legacy implementation issues with #64-#68 and #69-#72.
   - Mark platform proofs such as PWA, Capacitor and VS Code as deferred/dependent where appropriate.

4. Update `docs/delivery/POC_PLAN.md` if needed.
   - Align milestones with the AI-native vertical slice and evidence gates.

5. Verify.
   - Run markdown whitespace validation.
   - Search required acceptance/evidence terms.
   - Confirm a dependency diagram and legacy issue mapping table exist.

## Out of scope

- Product code implementation.
- Changing GitHub issue state.
- Selecting a specific LLM provider.
- License/governance decisions from #73.
