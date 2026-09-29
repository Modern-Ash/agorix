<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Bolt Plan — issue-36

- prepare-contract: sequential — confirm scope, repository facts and deterministic acceptance trace.
- verify-01: sequential — implement and verify AC-001 (manifest + service worker); depends on prior accepted scope.
- verify-rest: sequential — confirm AC-002 through AC-009 against the pre-existing e2e suite unmodified.
- final-verification: sequential — run repository checks and collect evidence.
