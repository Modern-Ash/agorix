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
