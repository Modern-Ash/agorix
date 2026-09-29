<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Risk Register — issue-99

| Risk | Impact if unmitigated | Mitigation |
| --- | --- | --- |
| Badge relies on color alone | Inaccessible to colorblind learners | Every badge pairs a glyph + text; unit test asserts non-empty visible text per state |
| aria-label diverges from visible text | Screen-reader users get a different (or no) distinction | Unit test asserts aria-label equals the same localized string as the visible text |
| Provider/vendor name leaks into child-facing copy | Anthropomorphizes/over-trusts the model | Unit test asserts no vendor-name substring across all badge states |
| New badges break existing e2e flows | Regression in already-shipped mission/proposal journeys | Full existing 24-test e2e suite reran unmodified and passing before adding the new test |
| AC-008 (Studio) silently dropped | Incomplete issue closure without disclosure | Explicitly documented as deferred in `PLAN.md`/`LOGICAL-DESIGN.md`, not hidden |
