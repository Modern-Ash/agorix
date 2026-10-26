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

## Bounded scene sensing

`xPosition` and `yPosition` are numeric expressions that read the running sprite's current coordinates. `touchingActor` is a boolean expression with a bounded actor ID; it is true when both sprites are visible and their centers are at most 24 stage units apart. The runtime receives only the other actors' positions and visibility at the start of each script activation. A standalone run, missing actor, hidden actor or self-reference returns false. This gives deterministic results after the active actor moves within its script and after prior actor activations, without querying the DOM or images. Studio limits targets to characters in the scene and shows the last `if` result as yes/no runtime evidence. This is center-based contact, not pixel-perfect costume collision.

`timer` is a numeric expression: the virtual seconds the running script has waited so far (a clock for ordering, not wall time). `keyDown` carries a key name of letters and digits and is true when the script was started by that key or the run was given that key in `keysDown`; the set is fixed for the whole run, so the same program and inputs always give the same result. Neither reads the DOM, a real clock or a pointer.

The block adapter maps these expressions to `sensing_x_position`, `sensing_y_position` and `sensing_touching_actor`; Agorix Code, Python and TypeScript projections read the same canonical expressions. Sensors never call Ori or a provider.

`touchingStageEdge` carries its rectangle (`minX`, `maxX`, `minY`, `maxY`) in the expression, so exported programs retain their edge meaning on another device. It returns true when the running sprite's center is within 12 units of any side or has gone beyond it; the sprite's visibility does not change this geometric result. The validator requires finite bounds in −1000…1000 with positive width and height. Kids Escena libre uses exactly X 0…320 and Y −100…120.

`distanceToActor` reads center-to-center distance to the named actor from the same activation snapshot as `touchingActor`, rounded to the runtime's coordinate precision. Visibility does not erase a position: hidden targets still have a measurable distance. A missing target returns −1, distinct from contact at distance 0. Kids validates that the target exists in the scene. Both expressions have visual blocks and Agorix Code, Python and TypeScript projections; neither reads pixels, network state or provider output.

## Sound volume

`setVolume` (`volume`, 0 to 100) and `changeVolume` (`delta`, -100 to 100) set and change one global sound volume. The validator rejects values outside those ranges or that are not finite numbers; it never clamps inside the program. At run time the volume lives in `world.sounds.volume`, is clamped to 0-100 and survives `stopSounds`. The key is absent until a volume statement runs (absent means 100), so programs without volume statements keep identical worlds, traces and semantic hashes. The blocks are `sound_set_volume` and `sound_change_volume`; projections read `set volume to 40` (Agorix Code), `set_volume(40)` (Python) and `sound.setVolume(40)` (TypeScript). The App scales its synthetic cue gain by the volume and Studio shows it next to the active sounds.

## Extensions (ADR 0011)

`ProjectProgram.extensions` lists the first-party capability packs a project uses (`"pen"`, `"music"`; at most four, unique, from a fixed list). The validator rejects an unknown id and a program that uses a pack's statements without declaring it. The pen pack adds `penDown`, `penUp`, `setPenColor` (one of `dark`, `red`, `orange`, `green`, `blue`, `purple`), `setPenSize` (whole number 1 to 24) and `clearPen`. The world gains an optional `pen` (down, colour, size, at most 400 line pieces) only after a pen statement ran; a leaf movement statement (`move`, `goTo`, `glideTo`, `bounceOnEdge`) with the pen down appends one piece from the old to the new position.

The music pack (`"music"`, issue #622 family, SND-04/05) adds `playNote` (MIDI note 48 to 84, beats 0.25, 0.5, 1 or 2), `playDrum` (`kick`, `snare`, `hat`, `clap`, same beats), `setInstrument` (`piano`, `flute`, `guitar`, `bell`), `setTempo` (whole bpm 60 to 180), `setPitch` (whole semitones -12 to 12) and `setPan` (whole -100 left to 100 right). The world gains an optional `music` (instrument, tempo, pitch, pan; defaults piano, 120, 0, 0) only after one of the setters ran. The trace entry of a note, drum or (once music state exists) `playSound` carries `audio` with the instrument, pitch, pan and, for notes and drums, `seconds = beats * 60 / tempo` rounded to the millisecond. The speaker schedules those entries one after another (a note lasts its seconds, then the next starts: "play until done"), capped at 64 events and 30 seconds. Audio is presentation only; the trace is the proof.
