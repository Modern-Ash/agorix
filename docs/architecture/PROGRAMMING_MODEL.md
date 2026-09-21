# Canonical programming model

## Requirement

Visual blocks are an editor representation, not the source of truth. Agorix owns a versioned canonical program document.

## Initial schema shape

```ts
type ProjectProgram = {
  schema: "agorix/program/v1";
  scripts: Script[];
};

type Script = {
  id: string;
  trigger: Trigger;
  statements: Statement[];
};
```

Initial Trigger:
- onStart.

Initial Statement:
- move;
- turn;
- repeat;
- if.

Initial Expression:
- touchingGoal;
- boolean literal;
- numeric literal.

## Example

```json
{
  "schema": "agorix/program/v1",
  "scripts": [{
    "id": "main",
    "trigger": {"type": "onStart"},
    "statements": [{
      "type": "repeat",
      "count": 5,
      "body": [{"type": "move", "steps": 10}]
    }]
  }]
}
```

## Invariants

- ids stable across editor round trips when structure is unchanged;
- unknown schema version fails explicitly;
- invalid nesting fails validation before execution;
- runtime never executes raw Blockly XML/JSON;
- text projection is generated from this model;
- serialization is deterministic enough for snapshots and evidence.

## Text projection

POC target is JavaScript/TypeScript-like readable code. It is an educational projection, not arbitrary JavaScript execution.

Example:

```ts
whenStarted(() => {
  repeat(5, () => {
    sprite.move(10);
  });
});
```


## Persistent visual-to-code relationship

The textual projection is a first-class learning surface, not an optional export.

POC rules:
- the code panel is always present in the main editor layout;
- block edits update the canonical program first, then regenerate text;
- the visual workspace and text panel never maintain independent program state;
- selecting a block SHOULD expose the corresponding canonical node and text region;
- execution always uses the canonical program, never the displayed generated text;
- generated text remains read-only in the POC to avoid dual-authority synchronization problems.

This makes the relationship explicit:

```
Visual blocks
     |
     v
Canonical program
   /        \
  v          v
Runtime   Generated code
```
