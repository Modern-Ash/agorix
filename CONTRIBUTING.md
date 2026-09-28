# Contributing to Agorix

Thanks for helping build Agorix. This project is an open-source, AI-native programming learning environment for children, so contributions must preserve learner agency, transparent AI collaboration and child privacy.

## Start with an issue

- Use GitHub issues as the public work queue.
- Read the issue, linked specs and `AGENTS.md` before changing files.
- Keep the scope small enough to review independently.
- Ask for clarification when a product, pedagogy, safety or architecture decision is not already covered.

## Development workflow

1. Create a branch for the issue or change.
2. Make the smallest coherent change.
3. Add deterministic tests or documentation checks appropriate to the risk.
4. Run the relevant repository checks before opening a PR.
5. Open a pull request linked to the issue.
6. Do not self-merge.

AI-assisted work is welcome, but the contributor remains responsible for understanding, testing and explaining the change.

## Agora AI-SDLC work

When a change is delivered through Agora Flow:

- preserve the artifacts/evidence requested by the active issue;
- keep producer/reviewer separation where practical;
- treat CI and review as gates, not ceremony;
- record Product Owner acceptance only when explicitly given by the human role.

## Safety and privacy

Do not add:

- provider credentials or secrets;
- child personal data;
- production identifiers;
- raw private prompts or transcripts;
- hidden AI mutation paths;
- provider-generated executable code as accepted learner source.

Child safety, privacy and learning evidence override engagement or convenience.

## Licensing of contributions

Unless explicitly stated otherwise, contributions intentionally submitted to Agorix are provided under the Apache License 2.0, matching the repository license in `LICENSE`.

Do not add third-party assets, model weights, datasets, prompts, policies or generated content unless their license and provenance are documented and compatible with redistribution in this repository.
