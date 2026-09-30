# Adding a language pack

A community language pack is a deterministic textual projection over the canonical
`ProjectProgram`. It does not add program semantics and it does not become an execution engine.

## Contract

Create a package that exports a `LanguagePack`:

```ts
export const myPack: LanguagePack = {
  id: "my-language",
  name: "My language",
  version: "1",
  supportedCanonicalOperations: ["onStart", "move"],
  projection: myProjection,
  formatting: {
    indentation: "  ",
    mapping: "canonical-node-ranges",
  },
};
```

The projection implements the existing `LanguageProjection` interface. Do not add language-specific
fields to `ProjectProgram` or to the core projection contract.

## Required behavior

1. Deterministic: same canonical program -> same text/mapping.
2. Read-only authority: projection text is not independent program state.
3. Map executable canonical nodes to visible text ranges.
4. Report unsupported canonical operations explicitly.
5. Pass `assertLanguageProjectionConformance`.
6. Do not import UI frameworks, provider SDKs or LLM adapters.
7. Do not execute arbitrary projected source.

## Registration

`createLanguagePackRegistry([myPack])` discovers packs through generic metadata. Product surfaces
may decide which registered packs they expose; installing a pack does not automatically make it a
default learner language.

## Lua spike

`@agorix/language-pack-lua` is the reference validation pack. It proves that a new language can
support the current canonical operations without modifying canonical schema or Web core logic.

Lua is not committed as a default learner language and its projected text is not executed.
