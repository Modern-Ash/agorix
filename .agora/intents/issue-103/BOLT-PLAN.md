<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Bolt Plan — issue-103

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-doc: sequential — write `PRIVACY_THREAT_MODEL.md`, grounded in actual source (data-flow diagram, per-data-class table, logs guidance, prompt-injection cross-reference, deviations).
- verify-control: sequential — add and test the `no-learner-free-text-logging` security-baseline rule.
- verify-crosslinks: sequential — update `CHILD_SAFETY_PRIVACY.md`/`WEB_SECURITY_BASELINE.md` cross-links.
- final-verification: sequential — run repository checks and collect evidence.
