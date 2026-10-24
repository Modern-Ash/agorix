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
  "scripts": [
    {
      "id": "main",
      "trigger": { "type": "onStart" },
      "statements": [
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

## Start events (green flag)

A script starts from a trigger. `greenFlag` ("When green flag clicked") is the Scratch-familiar start event and the one new programs use; `onStart` ("When you press Run") is the legacy hat that older projects were saved with and means the same event. Both are valid, both run when a program is played, and `migrateLegacyTriggers` rewrites the legacy hat as the green flag when a project is opened in the Web editor (the file changes only when it is saved again). The runtime dispatches an event (`ProgramEvent`, today only `greenFlag`) and runs the scripts whose trigger answers to it, in order: key press, sprite click and messages will add events and triggers without changing how scripts are stored. The block editor starts new scripts with `event_green_flag` and keeps `event_on_start` (not offered in the toolbox) so old projects round-trip unchanged. Code projections name the hat `whenGreenFlagClicked` (`whenStarted` for the legacy hat).

## Absolute stage movement

`goTo` stores finite `x` and `y` coordinates bounded to −1000…1000 in the canonical program. It places the sprite at that point without changing its heading, and the runtime records the before/after positions in the statement trace. The general block adapter uses `motion_go_to`. Kids Escena libre offers a narrower 0…320 horizontal and −100…120 vertical range matching its stage; values outside that range cannot enter a saved free scene. The Agorix Code, Python and TypeScript projections display the same coordinates and are never executed as the source of truth.

## Sound volume

`setVolume` (`volume`, 0 to 100) and `changeVolume` (`delta`, -100 to 100) set and change one global sound volume. The validator rejects values outside those ranges or that are not finite numbers; it never clamps inside the program. At run time the volume lives in `world.sounds.volume`, is clamped to 0-100 and survives `stopSounds`. The key is absent until a volume statement runs (absent means 100), so programs without volume statements keep identical worlds, traces and semantic hashes. The blocks are `sound_set_volume` and `sound_change_volume`; projections read `set volume to 40` (Agorix Code), `set_volume(40)` (Python) and `sound.setVolume(40)` (TypeScript). The App scales its synthetic cue gain by the volume and Studio shows it next to the active sounds.
