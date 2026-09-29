# Proposed Units

## UOW-38-01: Studio first slice

Create the initial VS Code extension package and deterministic core surface model for Studio.

### Deliverables

- `extensions/vscode` workspace package.
- Studio architecture/source-of-truth document.
- Project fixture loader or adapter.
- Projection/range mapping tests.
- Runtime evidence and World Preview frame tests.
- ProgramProposal review boundary tests.
- #121 compatibility handoff fixture notes.

### Why one unit

#38 is a product surface issue, but the first slice must be vertically coherent: project open,
projection, runtime evidence and proposal safety are meaningful only together.
