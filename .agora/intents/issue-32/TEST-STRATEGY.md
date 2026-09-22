---
schema: "agora/test-strategy/v1"
id: "issue-32-agora-bootstrap"
work: "product-poc/product-foundation"
---

# Test strategy: Agora bootstrap confirmation

"Tests" are the six checkable requirements R1-R6, each with a concrete, reproducible
check (command output or grep), not prose assertion.

## Checklist (= test suite)

| Check                                             | Requirement | Command / method                                  | Result          |
| ------------------------------------------------- | ----------- | ------------------------------------------------- | --------------- |
| `.agora/` valid                                   | R1          | `agora validate`                                  | pass (0 errors) |
| Flavor/profile/depth recorded                     | R2          | read `.agora/project.md` frontmatter              | pass            |
| product-poc swarm + product-foundation work exist | R3          | `agora swarm show product-poc`, `agora work show` | pass            |
| ≥2 distinct runtimes declared                     | R4          | read `.agora/actors/*.md` `integration` fields    | pass            |
| No secrets in config                              | R5          | grep for credential patterns                      | pass            |
| Buildable without LLM credential                  | R6          | inspection — no build step yet, docs-only state   | pass            |

6 of 6 checks pass.

## Result

success — 6/6 checks pass, 0 fail.
