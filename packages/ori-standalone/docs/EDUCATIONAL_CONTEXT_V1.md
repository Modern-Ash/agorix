# Ori educational context v1

The host sends only `schemaVersion`, `intent`, and three bounded metadata fields: `scriptCount`, `hintCount`, `outcome` (`not-run`, `completed`, `failed`, `stopped`). No learner messages, source code, project contents, identity, trace or raw model prompts.

```bash
printf '%s' '{"schemaVersion":"ori/educational-request/v1","intent":"debug","context":{"scriptCount":2,"hintCount":1,"outcome":"failed"}}' | node examples/educational-context-cli.mjs
node --test test/educational-context-cli.test.mjs
```

The CLI validates stdin, invokes Ori's deterministic read-only agent loop and emits a versioned response with a context-sensitive pedagogical question. It does not use Ollama or OpenCode and never applies edits. This is an interoperability milestone, not a proof of pedagogical effectiveness.

Agorix must independently validate the response and derive outcome from trusted canonical runtime evidence. Its integration changes must target `integration/ori` exclusively.
