# Logical Design - issue #79

- Add `@agorix/language-projection` as the shared contract package.
- Define `TextRange`, multi-range node mappings, projection descriptors, diagnostics, metadata, projection interface, registry and conformance helpers.
- Keep the current single-range `@agorix/code-generator` API stable by adapting the new result back to `{ code, mapping }`.
- Surface explicit unsupported-node diagnostics through the existing `UnsupportedNodeError` diagnostic field.
- Add an ADR documenting authority boundaries and the migration path for #80/#81/#82.
