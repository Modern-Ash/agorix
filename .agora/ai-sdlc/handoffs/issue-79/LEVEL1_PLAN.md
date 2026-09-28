# Level 1 Plan - issue #79

## Objective

Define a provider-independent, deterministic `LanguageProjection` contract that generalizes the current TypeScript-like code generator without changing canonical program authority.

## Scope

- Introduce shared TypeScript interfaces for projection id/version/text/ranges/metadata/diagnostics.
- Represent existing `@agorix/code-generator` behavior through the new contract.
- Define language-independent node-to-text mapping semantics.
- Provide explicit unsupported-operation diagnostics.
- Provide projection registration/discovery outside UI packages.
- Add conformance helpers and tests proving two independent projections can satisfy the same contract.
- Add architecture documentation/ADR plus migration plan for the existing generator.

## Non-scope

- Implement Agorix Code, Python, or TypeScript migration fully; those are #80, #81, and #82.
- Execute generated source text.
- Add provider/LLM dependencies.
- Make text editing bidirectional.
