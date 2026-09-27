# Governance

Agorix is governed as an open-source project with a strong product-safety boundary: the project must help children learn programming with AI without hiding authorship, execution or evidence.

## Maintainer authority

Modern Ash is the initial maintainer and copyright holder for the Agorix repository.

Maintainers may:

- triage issues and roadmap order;
- request changes or close PRs that do not fit the product direction;
- decide whether a contribution is safe for children and compatible with the architecture;
- reject bundled assets, model weights, datasets or provider integrations with unclear or incompatible licenses;
- merge reviewed PRs after required checks pass.

No contributor should self-merge their own substantive work.

## Decision process

Durable product, architecture, safety, licensing and governance decisions should be recorded in repository documentation or ADRs. GitHub issues may discuss options, but accepted decisions belong in versioned files.

For Agora AI-SDLC work, the issue, `.agora/` records, review evidence and Product Owner acceptance form the delivery record.

## Contribution model

Agorix uses GitHub issues and pull requests. Contributors should follow `CONTRIBUTING.md` and `AGENTS.md`.

AI agents and model providers are execution aids. They are not project authorities. Maintainers and Product Owner decisions remain human-governed.

## License scope

Agorix source code and repository documentation are licensed under the Apache License 2.0 unless a file says otherwise.

This license does not automatically cover:

- third-party dependencies;
- third-party media or curriculum assets;
- model weights;
- hosted provider services;
- external datasets;
- trademarks or brand assets;
- content imported from another project under different terms.

Those items must keep their own notices and compatibility review.

## Safety and privacy priority

Maintainers may block or revert changes that introduce child privacy risk, hidden AI mutation, unsafe AI behavior, unverifiable learning claims or provider lock-in that bypasses Agorix architecture.
