# ADR 0002: Apache-2.0 license and open governance

## Status

Accepted for the repository.

## Context

Agorix is described as open-source-first, provider-neutral and community-extensible. Before this decision, the repository did not include a root `LICENSE`, `CONTRIBUTING.md` or `GOVERNANCE.md`, so the README could only describe Apache-2.0 as a preferred direction.

Agorix also includes AI-specific extension points: Learning Companion contracts, provider adapters, prompts/policies, curriculum, language packs and future assets. These need clear licensing boundaries so the Agorix source license is not confused with external model, provider, dataset or asset licenses.

## Decision

Use Apache License 2.0 for Agorix source code and repository documentation unless a file says otherwise.

Modern Ash is the initial copyright holder and maintainer authority.

Contributions intentionally submitted to Agorix are accepted under Apache-2.0 unless explicitly stated otherwise.

Governance is documented in `GOVERNANCE.md`, and contribution expectations are documented in `CONTRIBUTING.md`.

## Rationale

- Apache-2.0 allows use, modification and redistribution.
- It includes an explicit patent grant.
- It is suitable for educational, research and commercial reuse.
- It fits community extensions, language packs and provider adapters.
- It aligns with Agorix's open-source-first and provider-neutral direction.

## License boundaries

The Apache-2.0 repository license does not automatically license:

- model weights;
- hosted model/provider services;
- third-party dependencies;
- third-party assets;
- imported curriculum/content under different terms;
- trademarks or brand assets.

Bundled external assets, prompts, policies, datasets or model files require provenance and license compatibility review before merge.

## Consequences

- The repository can accurately state that Agorix is Apache-2.0 licensed.
- README and contributor documentation can link to root license/governance files.
- Future provider/model work must preserve the distinction between Agorix source and external model/provider terms.
- Maintainers may reject unclear or incompatible bundled external assets or model files.
