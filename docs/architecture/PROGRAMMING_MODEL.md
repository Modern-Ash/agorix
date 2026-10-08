# Canonical programming model

## Requirement

Visual blocks are an editor representation, not the source of truth. Agorix owns a versioned canonical program document.

## Schema shape

```ts
type ProjectProgram = {
  schema: "agorix/program/v1";
  variables?: ProgramVariable[];
  scripts: Script[];
};

type ProgramVariable = {
  id: string;
  name: string;
  initialValue: number;
  visible: boolean;
};

type Script = {
  id: string;
  trigger: Trigger;
  statements: Statement[];
};
```

Trigger:

- onStart.
- onKeyPressed;
- onActorClicked;
- onMessage.

Statement:

- move;
- turn;
- say;
- think;
- show;
- hide;
- setSize;
- switchCostume;
- switchBackdrop;
- playSound;
- stopSounds;
- broadcast;
- setVariable;
- changeVariable;
- showVariable;
- hideVariable;
- repeat;
- if.

Expression:

- touchingGoal;
- boolean literal;
- numeric literal.
- variable;
- add;
- subtract;
- multiply;
- divide;
- lessThan;
- greaterThan;
- equals;
- and;
- or;
- not;
- random.

## Example

```json
{
  "schema": "agorix/program/v1",
  "variables": [{ "id": "score", "name": "score", "initialValue": 0, "visible": true }],
  "scripts": [
    {
      "id": "main",
      "trigger": { "type": "onStart" },
      "statements": [
        {
          "type": "changeVariable",
          "variableId": "score",
          "delta": { "type": "numericLiteral", "value": 1 }
        },
        {
          "type": "repeat",
          "count": 5,
          "body": [{ "type": "move", "steps": 10 }]
        }
      ]
    }
  ]
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
let score = 0;
showVariable("score");

whenStarted(() => {
  score += 1;
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
- variables project as readable local identifiers and watcher calls, but runtime
  still executes the canonical model, not the generated text.
- `random` is replayable through the runtime seed; there is no ambient
  JavaScript randomness in the canonical model.
- Looks, Sound and asset-ref blocks round-trip through the same canonical model;
  the block editor must preserve `costumeId`, `backdropId` and `soundId` exactly.

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

## Shared creative project state

The executable `ProjectProgram` remains the canonical authority for scripts and
statements. Creative surfaces also need canonical, portable project state for
actors and assets, but that state is not executable source by itself.

Agorix therefore keeps the v1 script AST stable and stores the shared creative
state in the portable project metadata, validated by `@agorix/program-model`:

```ts
type ProjectCreativeState = {
  actors?: ProjectActor[];
  stage?: ProjectStage;
  assets?: ProjectAsset[];
};

type ProjectActor = {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  costumeId?: string;
  scripts?: string[];
};

type ProjectStage = {
  backdropId?: string;
  width?: number;
  height?: number;
  actorOrder?: string[];
};

type ProjectAsset = {
  id: string;
  kind: "costume" | "backdrop" | "sound";
  name: string;
  source: string;
  tags?: string[];
};
```

This is the shared core consumed by both Agorix App and Agorix Studio:

- App presents actors/assets as a learner-friendly creative surface;
- Studio presents the same data as Actors, Inspector and Assets views;
- `.agorix` export/import round-trips the same canonical metadata;
- actor, asset and script references use stable ids made of letters, numbers,
  `_`, `.`, `:` or `-`; path-like ids, whitespace and empty ids are rejected at
  validation/import time; portable import also rejects non-string entries inside
  actor `scripts` and stage `actorOrder`;
- actor `size` and stage `width`/`height` must be positive bounded numbers, so
  renderers never receive zero, negative or extreme dimensions;
- App and Studio actor inspectors must enforce the same bounds and reject
  costume references outside the shared asset catalog before committing
  metadata;
- actor `scripts` reference script ids in `ProjectProgram`;
- actor `costumeId`, stage `backdropId` and `actorOrder` must reference known
  assets/actors;
- `playSound` statements must reference known sound assets; runtime records sound
  playback deterministically as state and trace evidence, not as hidden browser
  audio side effects;
- legacy `appearanceId` from early Studio metadata is accepted only as an import
  alias and normalized to `costumeId`.

This avoids a premature `agorix/program/v2` while still making actors and assets
part of the shared core. A future schema version can move or expand this shape
when asset execution, richer sensing and stage-level project behavior need
breaking changes.
