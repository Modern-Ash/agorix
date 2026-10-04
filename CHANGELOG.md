# Agorix 0.1.0

First public beta release of Agorix: an AI-native creative coding platform with a Scratch-familiar Web experience and a professional VS Code Studio surface over the same canonical project model.

## Highlights

- Scratch-familiar visual programming: palette, direct blocks, drag/drop, snap, nesting, reorder, duplicate, delete and inline editing.
- AI-native learning loop: contextual assistance, System-0/Laya decision routing, explicit ProgramProposal review and deterministic runtime evidence.
- Worlds, Run/Stop/Step, execution feedback, touch/tablet/keyboard accessibility and Undo/Redo.
- Portable versioned `.agorix` projects for anonymous continuation and Web/Studio interchange.
- Agorix Studio VS Code extension with Activity Bar navigation, code projections, World Preview, Execution Inspector, contextual Learning Companion and native proposal diff/review.
- Private accounts and durable projects with username/password authentication, secure sessions, authorization and optimistic revision conflicts.
- PostgreSQL-compatible persistence for hosted deployments and SQLite for self-hosted persistent-volume deployments.
- Open-source-first self-hosting documentation and Apache-2.0 licensing.

## Product surfaces

### Agorix Web
Visual-first, Scratch-familiar and tablet-friendly. Anonymous sessions are ephemeral; export `.agorix` to continue later, or sign in for durable projects.

### Agorix Studio
VS Code-native, code-first experience for advanced learners/developers. Uses the same Canonical Program, runtime, evidence and proposal semantics as Web.

## Persistence

Authenticated projects support durable server storage through provider-neutral repository contracts:
- PostgreSQL, including managed PostgreSQL deployments such as Supabase-compatible hosting.
- SQLite for suitable single-instance/self-hosted deployments with persistent storage.

## AI authority

AI suggestions are provisional. They do not mutate accepted code until the learner explicitly applies them. Deterministic runtime evidence remains the behavioral authority.

## License

Apache License 2.0.
