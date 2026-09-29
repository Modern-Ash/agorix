<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Risk Register — issue-103

| Risk | Impact if unmitigated | Mitigation |
| --- | --- | --- |
| Threat model doc drifts from actual code over time | False sense of security | Every claim in `PRIVACY_THREAT_MODEL.md` cites a real source file/type, not a description written from memory; the "no console logging" claim is now also CI-enforced |
| A future feature adds logging without checking this doc | Learner free text or program content could leak into logs | New `no-learner-free-text-logging` security-baseline rule fails the build if `learnerIntent`/`learnerQuestion` reaches a `console.*`/`logger.*` call in first-party source |
| Documentation-only "coverage" of AC-004 (prompt injection) duplicates or contradicts #100's real validation boundary | Confusing/conflicting guidance | This doc explicitly cross-references `AI_OUTPUT_VALIDATION.md` as the authority, rather than restating or reinterpreting it |
| Safety doc set becomes inconsistent (new doc not linked from others) | Reviewers miss the new threat model | `security-baseline.mjs`'s existing `checkSafetyDocs` rule already requires every safety doc to cross-link at least one sibling; verified passing after the update |
