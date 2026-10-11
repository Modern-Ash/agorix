# Sound volume (design)

Issue #338, follow-up to #320. Date: 2026-10-10.

## Goal

A learner can set and change a global sound volume with blocks. The volume is validated, deterministic, replayable, visible in the runtime trace and in all code projections, and consumed identically by App and Studio.

## Success criteria

- `setVolume` and `changeVolume` exist in the canonical program, validate, persist and round-trip through blocks.
- Volume is clamped to 0-100 and defaults to 100; `stopSounds` does not reset it.
- Volume appears in the runtime trace and in Agorix Code, Python and TS/Lua projections.
- App stage audio uses the volume; Studio shows it next to active sounds.
- Programs without volume statements behave exactly as today.

## Design

1. **Schema and validation (`program-model`).** `SetVolumeStatement { type: "setVolume"; volume: number }` and `ChangeVolumeStatement { type: "changeVolume"; delta: number }`. Validation: finite numbers; `volume` in 0-100; `delta` in -100..100. Added to `schema.ts`, `validate.ts` and the fixtures.
2. **Runtime.** `SoundState` gains `volume` (0-100, default 100). `setVolumeWorld` and `changeVolumeWorld` clamp to 0-100. Both operations are registered in `operations.ts` and `execute.ts`; the trace records the resulting volume. `playSound` is unchanged and `stopSounds` keeps the volume.
3. **Blocks.** `sound_set_volume` and `sound_change_volume` in the `block-editor` vocabulary and adapter (round-trip) and in `studio-protocol` block lists. The App enables the existing "Volume" palette placeholder and adds the change block.
4. **Projections.** Agorix Code: `set volume to 50`, `change volume by -10`. Python: `set_volume(50)`, `change_volume(-10)` plus `supportApi`. TS/Lua (`code-generator`): equivalent calls.
5. **Surfaces.** `playStageSoundCue` uses `world.sounds.volume` as gain scale (current 0.05 stays the ceiling). Studio shows the volume on the "Sound playing" row. `stage` rendering text: "Volume set to N".
6. **Proposals.** `studioCore.ts` enumerates statements for asset ids; volume statements reference no assets and get an explicit empty case.

## Testing

Validation (range and type), runtime (clamp, persistence across `stopSounds`, trace), block round-trip, the three projections, Studio render, and App cue gain through a pure helper.

## Out of scope

Per-sound or per-actor volume, fades, real audio files. Audio stays the synthetic tone.
