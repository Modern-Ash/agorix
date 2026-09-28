# Requirements

## Functional requirements

- R1: `extensions/vscode` builds as a pnpm workspace package.
- R2: Studio can open a shared Agorix project fixture with the same canonical project semantics as
  Web.
- R3: Studio can render textual projection and active canonical node-to-editor range mappings.
- R4: Studio can run or step a canonical program through shared runtime and produce World Preview
  and inspector-ready execution evidence.
- R5: Studio exposes a ProgramProposal review model that supports inspect, reject and explicit
  apply.
- R6: Rejecting a ProgramProposal leaves accepted canonical program state unchanged.
- R7: Studio-created or Studio-modified fixture data is suitable for #121 Web reopen validation.
- R8: Studio visual architecture follows the #117 design system and #119 Worlds boundary.

## Constraints

- No second canonical model.
- No duplicated runtime semantics.
- No provider-specific workflow.
- No direct LLM mutation.
- VS Code API imports isolated to extension/adapters.
- Studio may work without a remote AI provider.
