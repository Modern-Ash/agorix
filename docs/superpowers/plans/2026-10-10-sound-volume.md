# Sound volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `setVolume` / `changeVolume` statements that clamp a global sound volume (0-100), flow through blocks, runtime trace, all code projections, App audio and Studio.

**Architecture:** Two new canonical statements. The runtime stores an optional `volume` in `SoundState` (absent means 100, so existing worlds, traces and hashes are unchanged). Everything downstream follows the `playSound` / `stopSounds` precedent file by file.

**Tech Stack:** TypeScript, vitest, pnpm (`corepack pnpm`; put a `pnpm` shim on PATH for `build`), React.

**Spec:** `docs/superpowers/specs/2026-10-10-sound-volume-design.md`

## Global Constraints

- `volume` in 0-100 and `delta` in -100..100, finite numbers; world volume clamped to 0-100; default 100.
- `SoundState.volume` is optional: programs without volume statements produce byte-identical worlds, traces and semantic hashes.
- `stopSounds` keeps the volume.
- Block types: `sound_set_volume` (field `volume`), `sound_change_volume` (field `delta`).
- Projections: Agorix Code `set volume to N` / `change volume by N`; Python `set_volume(N)` / `change_volume(N)`; TS `sound.setVolume(N)` / `sound.changeVolume(N)`.
- New learner-facing strings exist in `en` and `es`.
- Gates before each commit: `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm test`. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- `setVolume` with 150, -5, NaN or a string: rejected by validation, never silently clamped in the program.
- `changeVolume` that would pass 100 or go below 0: clamped in the world.
- Volume set before any sound plays, then `playSound`, then `stopSounds`: volume survives and the world keeps `activeSoundIds`.
- A program with no volume statement: world has no `volume` key.
- Loading a project saved before this change: still valid.

---

## File Structure

- `packages/program-model/src/{schema,validate,fixtures}.ts` (+ tests)
- `packages/runtime/src/{world,operations,execute}.ts` (+ tests)
- `packages/block-editor/src/{adapter,vocabulary}.ts`, `packages/studio-protocol/src/index.ts`, `apps/web/src/{App.tsx,editorModel.ts}`
- `packages/{agorix-code,python-projection,code-generator}/src/*`
- `packages/stage/src/{model,rendering}.ts`, `packages/studio-protocol/src/index.ts` (sounds parser), `packages/studio-ui/src/Workbench.tsx`, `extensions/vscode/src/studioCore.ts`, `apps/web/src/App.tsx`

---

### Task 1: Program model and validation

**Files:** Modify `packages/program-model/src/schema.ts` (after `StopSoundsStatement`, union at `Statement`), `validate.ts` (next to `case "stopSounds"` ~l.311), `fixtures.ts` (next to `stopSounds` ~l.47); Test `packages/program-model/src/validate.test.ts` (use the file that already tests `playSound` validation: `grep -ln playSound packages/program-model/src/*.test.ts`).

**Interfaces:** Produces `SetVolumeStatement { type: "setVolume"; volume: number }`, `ChangeVolumeStatement { type: "changeVolume"; delta: number }` in the `Statement` union.

- [ ] **Step 1: Failing tests** (append to the validation test file, matching its imports and its `SCHEMA_VERSION` program helper)

```ts
describe("volume statements", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as unknown as ProjectProgram;

  it("accepts in-range volume statements", () => {
    expect(() => validateProgram(programWith({ type: "setVolume", volume: 0 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "setVolume", volume: 100 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "changeVolume", delta: -100 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "changeVolume", delta: 100 }))).not.toThrow();
  });

  it("rejects out-of-range, non-finite and non-number values", () => {
    for (const volume of [150, -5, Number.NaN, Number.POSITIVE_INFINITY, "50"]) {
      expect(() => validateProgram(programWith({ type: "setVolume", volume }))).toThrow();
    }
    for (const delta of [101, -101, Number.NaN, "5"]) {
      expect(() => validateProgram(programWith({ type: "changeVolume", delta }))).toThrow();
    }
  });
});
```

- [ ] **Step 2:** Run `corepack pnpm exec vitest run packages/program-model -t "volume statements"` → FAIL (unknown statement type).

- [ ] **Step 3: Implement.** In `schema.ts` add the two interfaces after `StopSoundsStatement`, and `| SetVolumeStatement | ChangeVolumeStatement` to `Statement`. In `validate.ts` add (using the same number helper the neighbouring `setSize` case uses for `input.size`; if it is `checkNumber`, reuse it with a range, otherwise write the range check inline and throw the same `ProgramValidationError` kind the file uses):

```ts
    case "setVolume": {
      const volume = input.volume;
      if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 100) {
        throw new ProgramValidationError("INVALID_STATEMENT", `${path}.volume`, "volume must be a number from 0 to 100", volume);
      }
      return { type: "setVolume", volume };
    }
    case "changeVolume": {
      const delta = input.delta;
      if (typeof delta !== "number" || !Number.isFinite(delta) || delta < -100 || delta > 100) {
        throw new ProgramValidationError("INVALID_STATEMENT", `${path}.delta`, "delta must be a number from -100 to 100", delta);
      }
      return { type: "changeVolume", delta };
    }
```

Match the real `ProgramValidationError` constructor arguments and code names used elsewhere in `validate.ts` (copy from the `setSize` case). Add both statements to the `fixtures.ts` full-coverage program next to `stopSounds`.

- [ ] **Step 4:** Run `corepack pnpm exec vitest run packages/program-model` → PASS (fixture-driven tests that enumerate statement types must pass too; extend their expected lists if they enumerate).

- [ ] **Step 5:** `corepack pnpm lint && corepack pnpm format:check`, then commit `feat(program-model): setVolume and changeVolume statements`.

---

### Task 2: Runtime world and execution

**Files:** Modify `packages/runtime/src/world.ts` (`SoundState`, `WorldStateInput`, `createWorldState` ~l.83-108, new helpers after `stopSoundsWorld`), `operations.ts` (list ~l.27), `execute.ts` (imports ~l.22, switch ~l.331); Test `packages/runtime/src/index.test.ts` and `operations.test.ts`.

**Interfaces:** Consumes Task 1 statements. Produces `setVolumeWorld(world, volume)`, `changeVolumeWorld(world, delta)`, `SoundState.volume?: number`.

- [ ] **Step 1: Failing tests** (`index.test.ts`; reuse its `SCHEMA_VERSION`, `runProgram`, `createWorldState` imports)

```ts
describe("sound volume", () => {
  const run = (statements: unknown[]) =>
    runProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
      } as never,
      createWorldState(),
    );

  it("has no volume key until a volume statement runs", () => {
    expect(run([{ type: "playSound", soundId: "asset:sound.beacon" }]).world.sounds).toEqual({
      activeSoundIds: ["asset:sound.beacon"],
    });
  });

  it("sets and changes volume with clamping", () => {
    expect(run([{ type: "setVolume", volume: 40 }]).world.sounds?.volume).toBe(40);
    expect(
      run([
        { type: "setVolume", volume: 90 },
        { type: "changeVolume", delta: 50 },
      ]).world.sounds?.volume,
    ).toBe(100);
    expect(
      run([
        { type: "setVolume", volume: 10 },
        { type: "changeVolume", delta: -50 },
      ]).world.sounds?.volume,
    ).toBe(0);
    expect(run([{ type: "changeVolume", delta: -30 }]).world.sounds?.volume).toBe(70);
  });

  it("keeps volume and active sounds across play and stop", () => {
    const world = run([
      { type: "setVolume", volume: 25 },
      { type: "playSound", soundId: "asset:sound.beacon" },
      { type: "stopSounds" },
    ]).world;
    expect(world.sounds).toEqual({ activeSoundIds: [], volume: 25 });
  });

  it("records the resulting volume in the trace", () => {
    const result = run([{ type: "setVolume", volume: 60 }]);
    expect(result.trace[0]?.worldAfter.sounds?.volume).toBe(60);
  });
});
```

Also add `"setVolume"` and `"changeVolume"` to the expected list in `operations.test.ts` if it pins `RUNTIME_STATEMENT_OPERATIONS`.

- [ ] **Step 2:** Run `corepack pnpm exec vitest run packages/runtime -t "sound volume"` → FAIL.

- [ ] **Step 3: Implement** `world.ts`:

```ts
export interface SoundState {
  readonly activeSoundIds: readonly string[];
  /** 0-100; absent means 100 so worlds without volume statements are unchanged. */
  readonly volume?: number;
}
```

In `createWorldState`, replace the `activeSoundIds` handling with:

```ts
  const sounds = normalizeSounds(input.sounds);
  ...
    ...(sounds === undefined ? {} : { sounds }),
```

and add

```ts
function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`volume must be finite: ${value}`);
  }
  return Math.min(100, Math.max(0, normalizeCoordinate(value)));
}

function normalizeSounds(input: Partial<SoundState> | undefined): SoundState | undefined {
  if (input?.activeSoundIds === undefined && input?.volume === undefined) {
    return undefined;
  }
  return {
    activeSoundIds: [...(input.activeSoundIds ?? [])],
    ...(input.volume === undefined ? {} : { volume: clampVolume(input.volume) }),
  };
}
```

(`input` is narrowed non-undefined by the second check; add a guard if TypeScript disagrees.) Update `playSoundWorld` and `stopSoundsWorld` to preserve volume:

```ts
export function playSoundWorld(world: WorldState, soundId: string): WorldState {
  const current = world.sounds?.activeSoundIds ?? [];
  return createWorldState({
    ...world,
    sounds: {
      ...world.sounds,
      activeSoundIds: current.includes(soundId) ? current : [...current, soundId],
    },
  });
}

export function stopSoundsWorld(world: WorldState): WorldState {
  return createWorldState({ ...world, sounds: { ...world.sounds, activeSoundIds: [] } });
}

export function setVolumeWorld(world: WorldState, volume: number): WorldState {
  return createWorldState({
    ...world,
    sounds: { activeSoundIds: world.sounds?.activeSoundIds ?? [], volume },
  });
}

export function changeVolumeWorld(world: WorldState, delta: number): WorldState {
  return setVolumeWorld(world, (world.sounds?.volume ?? 100) + delta);
}
```

`operations.ts`: add `"setVolume", "changeVolume"` after `"stopSounds"`. `execute.ts`: import both helpers and add

```ts
    case "setVolume":
      state.world = setVolumeWorld(state.world, statement.volume);
      break;
    case "changeVolume":
      state.world = changeVolumeWorld(state.world, statement.delta);
      break;
```

Export the helpers from the runtime index if `playSoundWorld` is exported there (`grep -n playSoundWorld packages/runtime/src/index.ts`).

- [ ] **Step 4:** `corepack pnpm exec vitest run packages/runtime packages/program-model` → PASS; confirm no pre-existing runtime test changed (worlds without volume stay identical).
- [ ] **Step 5:** gates, commit `feat(runtime): sound volume state with clamped set and change`.

---

### Task 3: Blocks and block-editor round trip

**Files:** Modify `packages/block-editor/src/adapter.ts` (type union ~l.29, `blockToStatement` after `sound_stop` ~l.347, `statementToBlock` after `stopSounds` ~l.526), `packages/block-editor/src/vocabulary.ts` (after `sound_stop` ~l.187), `packages/studio-protocol/src/index.ts` (block type list ~l.504), `apps/web/src/editorModel.ts` (type union ~l.42), `apps/web/src/App.tsx` (type list ~l.276, `case "sound_stop"` ~l.622 and ~l.721, palette ~l.926); Test `packages/block-editor/src/index.test.ts`.

**Interfaces:** Consumes Task 1. Produces block types `sound_set_volume` (field `volume`) and `sound_change_volume` (field `delta`).

- [ ] **Step 1: Failing test** (`index.test.ts`, with the file's existing round-trip helpers; follow the existing `sound_play` round-trip test)

```ts
it("round-trips volume statements through blocks", () => {
  const program = {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          { type: "setVolume", volume: 40 },
          { type: "changeVolume", delta: -10 },
        ],
      },
    ],
  } as unknown as ProjectProgram;
  const { workspace } = programToWorkspace(program);
  expect(workspaceToProgram(workspace).scripts[0]?.statements).toEqual(
    program.scripts[0]?.statements,
  );
  expect(JSON.stringify(workspace)).toContain("sound_set_volume");
});
```

Run → FAIL.

- [ ] **Step 2: Implement.** `adapter.ts`:

```ts
    case "sound_set_volume":
      return { type: "setVolume", volume: numberField(block, "volume", path) };
    case "sound_change_volume":
      return { type: "changeVolume", delta: numberField(block, "delta", path) };
```

```ts
    case "setVolume":
      return { id, type: "sound_set_volume", fields: { volume: statement.volume } };
    case "changeVolume":
      return { id, type: "sound_change_volume", fields: { delta: statement.delta } };
```

Add `| "sound_set_volume" | "sound_change_volume"` to the union. `vocabulary.ts` entries copy `sound_play`'s shape: `type`, `label: "Set volume to [N]"` / `"Change volume by [N]"`, `section: "Sound"`, `placement: "statement"`, `accessibleName`, `createDefaultBlock: (id) => ({ id, type: "sound_set_volume", fields: { volume: 100 } })` and `{ delta: -10 }`. Add the two names next to `"sound_stop"` in `studio-protocol/src/index.ts`, `editorModel.ts` and the `App.tsx` lists; mirror every `case "sound_stop"` in `App.tsx` (l.622, l.721) for the two new blocks with the same pattern the `looks_set_size` numeric field uses there. In the palette, replace the disabled `sound_volume` entry with enabled blocks `{ id: "sound_set_volume", type: "sound_set_volume", label: es ? "Fijar volumen" : "Set volume", detail: es ? "De 0 a 100" : "From 0 to 100", glyph: "%", enabled: true }` and `{ id: "sound_change_volume", type: "sound_change_volume", label: es ? "Cambiar volumen" : "Change volume", detail: es ? "Sube o baja" : "Louder or softer", glyph: "±", enabled: true }`.

- [ ] **Step 3:** `corepack pnpm exec vitest run packages/block-editor packages/studio-protocol apps/web` → PASS; `corepack pnpm exec tsc --noEmit -p apps/web` clean (exhaustive switches in `App.tsx` will flag any missed case).
- [ ] **Step 4:** gates, commit `feat(blocks): set and change volume blocks`.

---

### Task 4: Code projections

**Files:** Modify `packages/agorix-code/src/index.ts`, `packages/python-projection/src/index.ts` (cases next to `playSound` plus `supportApi`), `packages/code-generator/src/project.ts` (next to `case "stopSounds"` ~l.237), `packages/code-generator/src/fixtures.ts` if the generator tests are fixture-driven; Tests in each package's `src/index.test.ts` (and the generator's test file).

**Interfaces:** Consumes Task 1.

- [ ] **Step 1: Failing tests**, copying the "Sound operations" blocks from those packages:

Agorix Code: program `[{ type: "setVolume", volume: 40 }, { type: "changeVolume", delta: -10 }]` projects to `when start\n  set volume to 40\n  change volume by -10\n` with no diagnostics and mapped nodes.
Python: same program projects to `def on_start():\n    set_volume(40)\n    change_volume(-10)\n`; the `supportApi` expectation gains `"set_volume", "change_volume"` after `"stop_sounds"`.
Generator: expect `sound.setVolume(40);` and `sound.changeVolume(-10);` in the TS output (and the Lua equivalent if `project.ts` emits Lua: follow how `stopSounds` is emitted there).
Run each package's tests → FAIL.

- [ ] **Step 2: Implement.**

```ts
// agorix-code
    case "setVolume":
      writeMapped(writer, nodeId, indent + "set volume to " + formatNumber(statement.volume) + "\n");
      return;
    case "changeVolume":
      writeMapped(writer, nodeId, indent + "change volume by " + formatNumber(statement.delta) + "\n");
      return;
// python
    case "setVolume":
      writeMapped(writer, nodeId, indent + "set_volume(" + formatNumber(statement.volume) + ")\n");
      return;
    case "changeVolume":
      writeMapped(writer, nodeId, indent + "change_volume(" + formatNumber(statement.delta) + ")\n");
      return;
// code-generator
    case "setVolume":
      write(writer, `${pad}sound.setVolume(${statement.volume});\n`);
      return;
    case "changeVolume":
      write(writer, `${pad}sound.changeVolume(${statement.delta});\n`);
      return;
```

Add `"set_volume", "change_volume"` to the Python `supportApi` after `"stop_sounds"`. Run prettier on the packages.

- [ ] **Step 3:** `corepack pnpm exec vitest run packages/agorix-code packages/python-projection packages/code-generator packages/language-projection` → PASS.
- [ ] **Step 4:** gates, commit `feat(projections): project volume operations`.

---

### Task 5: Stage, Studio and App surfaces

**Files:** Modify `packages/stage/src/model.ts` (`SoundState` ~l.37, copy ~l.121), `packages/stage/src/rendering.ts` (l.90, l.163, text ~l.278-281, ~l.321), `packages/studio-protocol/src/index.ts` (`sounds` type ~l.249 and parser ~l.597-604), `packages/studio-ui/src/Workbench.tsx` (~l.417), `extensions/vscode/src/studioCore.ts` (~l.892, ~l.1658), `apps/web/src/App.tsx` (~l.1646, cue ~l.2908, `playStageSoundCue` ~l.1342); Tests: `packages/stage/src/index.test.ts`, `packages/studio-protocol/src/index.test.ts`, `packages/studio-ui/src/components.test.tsx`, `extensions/vscode/src/studioCore.test.ts`, a new `apps/web/src/stageAudio.test.ts`.

**Interfaces:** Consumes Task 2 (`world.sounds.volume`). Produces `soundCueGain(volume?: number): number` exported from a new `apps/web/src/stageAudio.ts`.

- [ ] **Step 1: Failing tests.**
  - Stage: observation frame for a world with `sounds: { activeSoundIds: [], volume: 40 }` keeps `volume: 40` in `state.sounds`; a world without volume keeps `sounds` exactly as before (no `volume` key).
  - Studio protocol: `parseHostMessage` of a frame whose `sounds` is `{ activeSoundIds: [], volume: 40 }` round-trips; `volume: 150` or `"loud"` is rejected.
  - Stage rendering / studioCore: `setVolume` step description is `Volume set to 40`; `changeVolume` is `Volume 70`; fact text `volume 100 -> 40`.
  - Workbench: markup for a frame with `sounds.volume = 40` shows `40%`; with no volume shows no percentage.
  - App helper `apps/web/src/stageAudio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { soundCueGain } from "./stageAudio.js";

describe("soundCueGain", () => {
  it("keeps the current 0.05 ceiling at full or unset volume", () => {
    expect(soundCueGain(undefined)).toBe(0.05);
    expect(soundCueGain(100)).toBe(0.05);
  });
  it("scales linearly and is silent at zero", () => {
    expect(soundCueGain(50)).toBeCloseTo(0.025);
    expect(soundCueGain(0)).toBe(0);
  });
  it("clamps out-of-range values", () => {
    expect(soundCueGain(500)).toBe(0.05);
    expect(soundCueGain(-5)).toBe(0);
  });
});
```

Run the affected packages → FAIL.

- [ ] **Step 2: Implement.** `stage/model.ts`: `SoundState { activeSoundIds; volume?: number }` and the copy at ~l.121 becomes `{ activeSoundIds: [...sounds.activeSoundIds], ...(sounds.volume === undefined ? {} : { volume: sounds.volume }) }`; `rendering.ts` l.163 copies `volume` the same conditional way; add `if (step.statementType === "setVolume") return \`Volume set to ${step.observation.world.sounds?.volume ?? 100}\`;` and the `changeVolume` equivalent (`Volume ${...}`) next to the `stopSounds`line, plus labels`"Set volume"`/`"Change volume"`in the switch at ~l.321 and the before/after fact`volume ${before.sounds?.volume ?? 100} -> ${after.sounds?.volume ?? 100}`in the fact switch of`studioCore.ts`~l.1658. Protocol parser: after validating`activeSoundIds`, accept optional `volume`only when it is a finite number in 0-100, else return`undefined`, and return `{ activeSoundIds, ...(volume === undefined ? {} : { volume }) }`; widen the `sounds`type to include`volume?`. `Workbench.tsx`: render `{volume}%`inside the`stage-sounds`block when`state.sounds.volume !== undefined`, using the existing `copy.activeSounds`section (no new strings needed beyond the number). App: create`apps/web/src/stageAudio.ts`:

```ts
const MAX_GAIN = 0.05;

export function soundCueGain(volume: number | undefined): number {
  const clamped = Math.min(100, Math.max(0, volume ?? 100));
  return (MAX_GAIN * clamped) / 100;
}
```

and in `playStageSoundCue(soundId, volume?)` replace the `0.05` ramp target with `Math.max(0.0001, soundCueGain(volume))` (and skip the cue when `soundCueGain(volume) === 0`); pass `activeFrame?.state.sounds?.volume` at the call site (~l.2914).

- [ ] **Step 3:** `corepack pnpm exec vitest run` for the touched packages → PASS; `corepack pnpm exec tsc --noEmit -p apps/web -p packages/stage -p packages/studio-ui -p extensions/vscode` clean.
- [ ] **Step 4:** gates, commit `feat(surfaces): show and apply sound volume in App and Studio`.

---

### Task 6: Verification and PR

- [ ] **Step 1:** Add an "Addendum: sound volume (issue #338)" paragraph to `docs/architecture/PROGRAMMING_MODEL.md` (statements, ranges, optional `SoundState.volume`) and commit `docs:`.
- [ ] **Step 2:** `PATH=<dir with pnpm shim>:$PATH corepack pnpm verify` → exit 0.
- [ ] **Step 3:** Push `feat/issue-338-sound-volume`, open a PR titled `feat: sound volume blocks, runtime and projections (#338)` with `Closes #338`, the spec link and the verify result; report CI.
