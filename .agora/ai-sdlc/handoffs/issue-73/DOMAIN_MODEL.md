# Domain Model - Issue #73

## Concepts

- RepositoryLicense: root license governing Agorix source and repository documentation unless a file says otherwise.
- ContributionModel: issue/PR workflow, checks, review and no-self-merge expectations.
- GovernanceAuthority: maintainer responsibility for roadmap, review, merge, safety and license compatibility decisions.
- ExternalLicenseBoundary: explicit distinction between Agorix source and third-party dependencies, model weights, hosted providers, datasets, assets and trademarks.
- DecisionRecord: durable ADR documenting license, copyright holder, contribution model and governance.

## Decisions

- RepositoryLicense is Apache License 2.0.
- Initial copyright holder and maintainer authority is Modern Ash.
- Contributions intentionally submitted to Agorix are accepted under Apache-2.0 unless explicitly stated otherwise.
- External model/provider/asset licenses remain separate and require compatibility review before bundling.
