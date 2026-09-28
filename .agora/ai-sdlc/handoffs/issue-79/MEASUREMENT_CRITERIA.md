# Measurement Criteria - issue #79

- Existing generator output can be wrapped or represented by `LanguageProjection` without changing current snapshots.
- API exposes canonical node id to one or more half-open text ranges independently of language syntax.
- Unsupported trigger/statement/expression cases produce explicit diagnostics with node id and node type.
- Repeated projection of cloned programs produces identical output and mapping.
- A registry/discovery unit test finds projections by id without importing UI packages.
- Conformance tests run against at least two projection implementations.
