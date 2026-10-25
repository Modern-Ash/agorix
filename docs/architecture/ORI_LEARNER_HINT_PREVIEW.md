# Ori learner hint preview — first pedagogical consumption boundary

This increment pivots from adult administrative diagnostics toward the intended Ori learner experience: a **small, read-only pedagogical hint** derived from an Ori plan.

## Learning interaction

```mermaid
flowchart LR
  A["Learner asks for help"] --> B["Agorix trusted host"]
  B --> C{"Preview flag enabled?"}
  C -->|No| D["Existing deterministic tutor"]
  C -->|Yes| E["Ori /v1/plan"]
  E --> F{"Strict schema + mission match"}
  F -->|Invalid| D
  F -->|Valid| G["Hint + first learning step"]
  G --> H["Learner decides what to try"]
```

The preview exposes only `hint` and the first step, not the full plan or any executable action. `requiresLearnerApproval` is true and `appliedChanges` is false. No project files or program state can be modified through this interface.

## Boundaries and next increments

This is **not yet wired to the Kids UI or tutor endpoint**. The feature defaults off. Before enabling it for children, add an age-appropriate content/safety evaluation, contextual relevance checks, educator review, and deterministic fallback on failures. Avoid storing child identifiers, prompts, raw programs or personal data in Ori calls.

The next iteration should exercise this preview with the real Ori process in synthetic missions, then add a separately reviewed learner-facing integration gate. Keep the changes on `integration/ori` only.
