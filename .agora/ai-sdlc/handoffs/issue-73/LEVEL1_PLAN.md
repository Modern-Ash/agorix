# Level 1 Plan - Issue #73

## Goal

Formalize Agorix open-source license, governance and contribution model without conflating source licensing with model/provider/asset licensing.

## Plan

1. Add root `LICENSE` using Apache License 2.0.
2. Add `CONTRIBUTING.md` describing issue/PR workflow, Agora AI-SDLC expectations, tests, no-self-merge and safety/privacy rules.
3. Add `GOVERNANCE.md` defining maintainer authority, review expectations, project decisions and child-safety/security priority.
4. Add durable ADR for the license/governance decision.
5. Update `README.md` and `README.es.md` to replace "preferred direction" warnings with links to the committed license/governance artifacts.
6. Add licensing notes for third-party assets, model weights, providers and prompts/policies.
7. Verify with repository checks, license text recognition, README link/wording checks and secret/PII scan.

## Out of scope

- Adding model weights, third-party media packs or new provider adapters.
- Creating a CLA/DCO automation requirement.
- Changing package code, runtime semantics or provider contracts.
