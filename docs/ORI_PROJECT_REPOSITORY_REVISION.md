# Ori canonical project revision adapter

This server-only adapter resolves an owner-scoped Agorix `ProjectRepository` record and returns its canonical `semanticHash` as the Ori program revision. It rejects missing projects, owner mismatch and malformed revisions. The owner identity must come from trusted authentication middleware, never a client field.

**Important limitation:** a semantic hash identifies semantic project content; it may remain unchanged across metadata-only updates. The repository numeric revision is also returned to support optimistic concurrency. A future authorized apply operation must validate both semantic content and repository revision under the repository's compare-and-swap update API.

This adapter does not yet build host execution evidence, connect a public endpoint, or mutate a project. Related Ori issues #16 #17 #18 #23 #28. Agorix target branch `integration/ori`.
