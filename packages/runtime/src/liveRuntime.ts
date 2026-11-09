import {
  validateProgram,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { createScriptStepper, type ExecutionOptions, type ScriptStepper } from "./execute.js";
import {
  actorsForCreative,
  cloneRuntimeEvent,
  cloneRuntimeStage,
  programEventForRuntimeEvent,
  reasonForActivation,
  remapNodeId,
  scriptsForActor,
  singleScriptProgram,
  snapshotActors,
  stageForCreative,
  statementAtNodeId,
  type MultiActorFrame,
  type MultiActorRunResult,
  type MultiActorScriptActivation,
  type MultiActorTraceEntry,
  type RuntimeActorMutable,
  type RuntimeEvent,
} from "./multiActor.js";
import { COPIES_CAP, advanceCopiesWorld, copiesMoving, liveCopies } from "./copies.js";
import { cloneWorldState, createWorldState, drawPenTrail, type WorldState } from "./world.js";

/** Scratch-like frame rate: each live script runs at most one statement per tick. */
export const LIVE_TICK_SECONDS = 1 / 30;
/** Total virtual time one live session may run, so a forever loop cannot run unseen forever. */
export const LIVE_MAX_SECONDS = 600;
/** Trace entries one live session records; the run ends like an exhausted budget past it. */
export const LIVE_MAX_ENTRIES = 3_000;
/** Frames kept for stepping back through a run; later statements still run and are traced. */
export const LIVE_MAX_FRAMES = 1_000;

/** Most recorded inputs per session; past it the session ends like an exhausted budget. */
export const LIVE_MAX_INPUTS = 100_000;
/** Events waiting for the next tick; more are ignored, so a held key cannot flood a session. */
const LIVE_MAX_PENDING = 64;

/**
 * Everything from outside that shaped a live run, stamped with the tick it was read at. With the
 * same program, project and this log, `replayLiveRuntime` rebuilds the same run exactly: the
 * runtime owns no clock and reads no input except through this log.
 */
export type LiveInput =
  | { readonly tick: number; readonly kind: "event"; readonly event: RuntimeEvent }
  | { readonly tick: number; readonly kind: "keys"; readonly keys: readonly string[] }
  | {
      readonly tick: number;
      readonly kind: "pointer";
      readonly x: number;
      readonly y: number;
      readonly down: boolean;
    }
  | {
      readonly tick: number;
      readonly kind: "choices";
      readonly choices: Readonly<Record<string, number>>;
    };

export interface LiveInputLog {
  readonly version: 1;
  /** Ticks the session ran. */
  readonly ticks: number;
  readonly randomSeed?: number;
  readonly inputs: readonly LiveInput[];
}

export interface LiveRuntimeOptions {
  readonly goal?: WorldState["goal"];
  readonly randomSeed?: number;
  /** Read at every statement, so held keys act while the run is going. */
  readonly keysDown?: () => readonly string[];
  /** Read at every statement; captured by the caller, never from browser globals. */
  readonly pointer?: () => { readonly x: number; readonly y: number; readonly down: boolean };
  readonly choices?: Readonly<Record<string, number>>;
  readonly maxSeconds?: number;
  readonly maxEntries?: number;
}

export interface LiveRuntime {
  /** A start, key, click or message now: matching scripts begin, or restart if already running. */
  fire(event: RuntimeEvent): void;
  /** Moves virtual time forward and returns the statements that ran, in order. */
  advance(seconds: number): readonly MultiActorTraceEntry[];
  /** True while any script is still running (a `forever` keeps it true until the session ends). */
  readonly running: boolean;
  /** Virtual seconds elapsed. */
  readonly now: number;
  /** The run so far, in the same shape as a finished batch run. */
  result(): MultiActorRunResult;
  /** The inputs read so far; feed it to `replayLiveRuntime` to rebuild this exact run. */
  inputLog(): LiveInputLog;
}

interface Activation {
  readonly id: string;
  readonly actor: RuntimeActorMutable;
  readonly scriptId: string;
  readonly scriptIndex: number;
  readonly event: RuntimeEvent;
  readonly stepper: ScriptStepper;
  wakeAt: number;
  lastAt: number;
  alive: boolean;
  /** Set by the broadcast that started it; the sender of a broadcast-and-wait watches these. */
  token?: number;
  /** "Broadcast and wait": the token whose scripts must all finish before this one goes on. */
  waitingFor?: number;
  /** A glide in progress: the sprite is carried tick by tick, drawing its pen trail as it goes. */
  glide?: {
    readonly fromX: number;
    readonly fromY: number;
    readonly toX: number;
    readonly toY: number;
    readonly startAt: number;
    readonly seconds: number;
  };
}

/**
 * Live runtime: many scripts run at once in virtual time, like Scratch's green flag. It is the
 * same statement interpreter as `runProgram` (a statement at a time), so waits last their real
 * seconds, `forever` runs until the session ends, and keys, clicks and the pointer are read
 * while it runs. It owns no clock: the caller advances it, so the same advances give the same run.
 */
export function createLiveRuntime(
  programInput: ProjectProgram,
  creativeInput: ProjectCreativeState = {},
  options: LiveRuntimeOptions = {},
): LiveRuntime {
  const program = validateProgram(programInput);
  const creative = validateProjectCreativeState(creativeInput, program);
  const stage = stageForCreative(creative);
  const actors = actorsForCreative(creative, stage, options.goal, undefined);
  const maxSeconds = options.maxSeconds ?? LIVE_MAX_SECONDS;
  const maxEntries = options.maxEntries ?? LIVE_MAX_ENTRIES;
  const trace: MultiActorTraceEntry[] = [];
  const frames: MultiActorFrame[] = [];
  const activations: MultiActorScriptActivation[] = [];
  const active: Activation[] = [];
  const pending: { readonly event: RuntimeEvent; readonly token?: number }[] = [];
  let nextToken = 1;
  const stopped = new Set<string>();
  let outcome: MultiActorRunResult["outcome"] = "completed";
  let randomState = options.randomSeed;
  let now = 0;
  let accumulated = 0;
  let halted = false;
  let steps = 0;
  let tickIndex = 0;
  const inputs: LiveInput[] = [];
  // What statements read during a tick: sampled once at its start and logged when it changes.
  let sampledKeys: readonly string[] = [];
  let sampledPointer = { x: 0, y: 0, down: false };
  let sampledChoices: Readonly<Record<string, number>> = {};

  const sensors = (self: RuntimeActorMutable) =>
    actors
      .filter((other) => other.id !== self.id)
      .map((other) => ({
        id: other.id,
        x: other.world.sprite.x,
        y: other.world.sprite.y,
        visible: other.world.sprite.visible ?? true,
      }));

  function start(
    actor: RuntimeActorMutable,
    scriptIndex: number,
    event: RuntimeEvent,
    token?: number,
  ) {
    const script = program.scripts[scriptIndex];
    if (script === undefined) return;
    // The same script starting again restarts it, as in Scratch.
    for (const running of active)
      if (running.alive && running.actor.id === actor.id && running.scriptId === script.id)
        running.alive = false;
    const id = `activation:${activations.length}`;
    activations.push({
      id,
      step: steps + 1,
      event: cloneRuntimeEvent(event),
      actorId: actor.id,
      scriptId: script.id,
      scriptIndex,
      reason: reasonForActivation(event, script, actor),
    });
    const execution: ExecutionOptions = {
      maxSteps: Number.MAX_SAFE_INTEGER,
      maxVirtualSeconds: maxSeconds,
      event: programEventForRuntimeEvent(event),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
      get sensorActors() {
        return sensors(actor);
      },
      get keysDown() {
        return sampledKeys;
      },
      get pointer() {
        return sampledPointer;
      },
      get choices() {
        return sampledChoices;
      },
    };
    const stepper = createScriptStepper(
      singleScriptProgram(program, script),
      actor.world,
      execution,
    );
    // The stepper seeds the program's variables and lists into the world it starts from.
    actor.world = cloneWorldState(stepper.world);
    active.push({
      id,
      actor,
      scriptId: script.id,
      scriptIndex,
      event: cloneRuntimeEvent(event),
      stepper,
      wakeAt: now,
      lastAt: 0,
      alive: true,
      ...(token === undefined ? {} : { token }),
    });
  }

  function dispatch(event: RuntimeEvent, token?: number) {
    for (const actor of actors) {
      if (stopped.has(actor.id)) continue;
      for (const [index] of scriptsForActor(program, actor, event))
        start(actor, index, event, token);
    }
  }

  function endAll() {
    halted = true;
    for (const activation of active) activation.alive = false;
  }

  /** A run keeps at most COPIES_CAP live copies; the character that just made them gives up the extra. */
  function capCopies(actor: RuntimeActorMutable, all: readonly RuntimeActorMutable[]) {
    const over = liveCopies(all.map((item) => item.world)) - COPIES_CAP;
    const copies = actor.world.copies;
    if (over > 0 && copies !== undefined)
      actor.world = createWorldState({
        ...actor.world,
        copies: copies.slice(0, Math.max(0, copies.length - over)),
      });
  }

  function stepActivation(activation: Activation): MultiActorTraceEntry | undefined {
    const { actor, stepper } = activation;
    stepper.world = actor.world;
    if (randomState !== undefined) stepper.randomState = randomState;
    const result = stepper.step();
    actor.world = cloneWorldState(stepper.world);
    randomState = stepper.randomState;
    capCopies(actor, actors);
    if (result.kind === "done") {
      activation.alive = false;
      if (result.outcome === "budget-exceeded") {
        outcome = "budget-exceeded";
        endAll();
      } else if (result.outcome === "stopped") {
        if (outcome === "completed") outcome = "stopped";
        if (result.stopScope === "actor") {
          stopped.add(actor.id);
          for (const other of active) if (other.actor.id === actor.id) other.alive = false;
        } else if (result.stopScope !== "script") endAll();
      }
      return undefined;
    }
    const raw = result.entry;
    const script = program.scripts[activation.scriptIndex]!;
    const single = singleScriptProgram(program, script).scripts[0]!;
    const nodeId = remapNodeId(raw.nodeId, activation.scriptIndex);
    if (raw.worldAfter.backdropId !== undefined) stage.backdropId = raw.worldAfter.backdropId;
    if (raw.statementType === "goToLayer") {
      const statement = statementAtNodeId(single, raw.nodeId);
      if (statement?.type === "goToLayer") {
        const rest = stage.actorOrder.filter((id) => id !== actor.id);
        stage.actorOrder = statement.layer === "front" ? [...rest, actor.id] : [actor.id, ...rest];
      }
    }
    if (raw.statementType === "broadcast") {
      const statement = statementAtNodeId(single, raw.nodeId);
      if (statement?.type === "broadcast") {
        const token = statement.wait === true ? nextToken++ : undefined;
        pending.push({
          event: { type: "message", message: statement.message, senderActorId: actor.id },
          ...(token === undefined ? {} : { token }),
        });
        if (token !== undefined) activation.waitingFor = token;
      }
    }
    steps += 1;
    // A wait or glide lasts its seconds; a note or drum lasts its beats ("play until done").
    const occupied =
      Math.round((Math.max(0, result.at - activation.lastAt) + (raw.audio?.seconds ?? 0)) * 1000) /
      1000;
    const mapped: MultiActorTraceEntry = {
      step: steps,
      activationId: activation.id,
      event: cloneRuntimeEvent(activation.event),
      actorId: actor.id,
      scriptId: activation.scriptId,
      nodeId,
      path: nodeId,
      statementType: raw.statementType,
      ...(raw.stopScope === undefined ? {} : { stopScope: raw.stopScope }),
      ...(raw.note === undefined ? {} : { note: raw.note }),
      ...(raw.soundId === undefined ? {} : { soundId: raw.soundId }),
      ...(raw.audio === undefined ? {} : { audio: raw.audio }),
      ...(raw.conditionResult === undefined ? {} : { conditionResult: raw.conditionResult }),
      ...(raw.args === undefined ? {} : { args: raw.args }),
      ...(occupied > 0 ? { seconds: occupied } : {}),
      at: now,
      worldBefore: raw.worldBefore,
      worldAfter: raw.worldAfter,
    };
    trace.push(mapped);
    if (raw.statementType === "glideTo" && occupied > 0) {
      // The statement jumped to its target and drew its whole trail; undo that and glide instead.
      const { sprite } = raw.worldBefore;
      const { sprite: end } = raw.worldAfter;
      actor.world = createWorldState({
        ...actor.world,
        sprite: { ...actor.world.sprite, x: sprite.x, y: sprite.y },
        ...(raw.worldBefore.pen === undefined ? {} : { pen: raw.worldBefore.pen }),
      });
      activation.glide = {
        fromX: sprite.x,
        fromY: sprite.y,
        toX: end.x,
        toY: end.y,
        startAt: now,
        seconds: occupied,
      };
    }
    if (frames.length < LIVE_MAX_FRAMES)
      frames.push({
        step: mapped.step,
        activationId: activation.id,
        event: cloneRuntimeEvent(activation.event),
        actorId: actor.id,
        scriptId: activation.scriptId,
        nodeId,
        stage: cloneRuntimeStage(stage),
        actors: snapshotActors(actors),
      });
    activation.lastAt = result.at;
    activation.wakeAt = now + occupied;
    return mapped;
  }

  function sampleInputs() {
    const keys = [...(options.keysDown?.() ?? [])];
    if (keys.join("\u0000") !== sampledKeys.join("\u0000")) {
      sampledKeys = keys;
      inputs.push({ tick: tickIndex, kind: "keys", keys });
    }
    const pointer = options.pointer?.() ?? { x: 0, y: 0, down: false };
    if (
      pointer.x !== sampledPointer.x ||
      pointer.y !== sampledPointer.y ||
      pointer.down !== sampledPointer.down
    ) {
      sampledPointer = { x: pointer.x, y: pointer.y, down: pointer.down };
      inputs.push({ tick: tickIndex, kind: "pointer", ...sampledPointer });
    }
    const choices = { ...options.choices };
    if (JSON.stringify(choices) !== JSON.stringify(sampledChoices)) {
      sampledChoices = choices;
      inputs.push({ tick: tickIndex, kind: "choices", choices });
    }
    if (inputs.length >= LIVE_MAX_INPUTS) {
      outcome = "budget-exceeded";
      endAll();
    }
  }

  function advanceGlides() {
    for (const activation of active) {
      const glide = activation.glide;
      if (!activation.alive || glide === undefined) continue;
      const progress = Math.min(1, (now - glide.startAt) / glide.seconds);
      const done = progress >= 1 - 1e-9;
      const x = done ? glide.toX : glide.fromX + (glide.toX - glide.fromX) * progress;
      const y = done ? glide.toY : glide.fromY + (glide.toY - glide.fromY) * progress;
      const before = activation.actor.world;
      const moved = createWorldState({ ...before, sprite: { ...before.sprite, x, y } });
      activation.actor.world = drawPenTrail(before, moved).world;
      if (done) delete activation.glide;
    }
  }

  function tick(produced: MultiActorTraceEntry[]) {
    now = Math.round((now + LIVE_TICK_SECONDS) * 1e6) / 1e6;
    tickIndex += 1;
    sampleInputs();
    for (const { event, token } of pending.splice(0)) dispatch(event, token);
    advanceGlides();
    for (const activation of [...active]) {
      if (!activation.alive || halted || activation.wakeAt > now + 1e-9) continue;
      if (activation.waitingFor !== undefined) {
        // Broadcast and wait: go on once nothing the message started is still running (or queued).
        const token = activation.waitingFor;
        const busy =
          pending.some((item) => item.token === token) ||
          active.some((other) => other.alive && other.token === token);
        if (busy) continue;
        delete activation.waitingFor;
      }
      const entry = stepActivation(activation);
      if (entry) produced.push(entry);
      if (trace.length >= maxEntries) {
        outcome = "budget-exceeded";
        endAll();
      }
    }
    // Time passes for the copies too: falling ones fall, following ones close in.
    for (const actor of actors) actor.world = advanceCopiesWorld(actor.world, LIVE_TICK_SECONDS);
    for (let i = active.length - 1; i >= 0; i -= 1) if (!active[i]!.alive) active.splice(i, 1);
    if (now >= maxSeconds && active.length > 0) {
      outcome = "budget-exceeded";
      endAll();
      active.length = 0;
    }
  }

  return {
    fire(event) {
      if (halted || pending.length >= LIVE_MAX_PENDING) return;
      pending.push({ event: cloneRuntimeEvent(event) });
      inputs.push({ tick: tickIndex + 1, kind: "event", event: cloneRuntimeEvent(event) });
    },
    advance(seconds) {
      const produced: MultiActorTraceEntry[] = [];
      if (!Number.isFinite(seconds) || seconds <= 0) return produced;
      accumulated += seconds;
      while (accumulated + 1e-9 >= LIVE_TICK_SECONDS) {
        accumulated -= LIVE_TICK_SECONDS;
        tick(produced);
        if (halted && active.length === 0) {
          accumulated = 0;
          break;
        }
      }
      return produced;
    },
    get running() {
      // Copies still falling or catching up keep the run going until they are where they end.
      return (
        !halted &&
        (active.length > 0 ||
          pending.length > 0 ||
          actors.some((actor) => copiesMoving(actor.world)))
      );
    },
    get now() {
      return now;
    },
    inputLog() {
      return {
        version: 1,
        ticks: tickIndex,
        ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
        inputs: [...inputs],
      };
    },
    result() {
      return {
        outcome,
        stage: cloneRuntimeStage(stage),
        actors: snapshotActors(actors),
        frames,
        trace,
        activations,
        stepsUsed: steps,
        ...(randomState === undefined ? {} : { randomState }),
      };
    },
  };
}

/**
 * Plays a recorded live run back through the same runtime, feeding it the logged inputs at their
 * ticks, so a caller can watch it again at real speed. It ends when the log does.
 */
export function createReplayRuntime(
  programInput: ProjectProgram,
  creativeInput: ProjectCreativeState,
  log: LiveInputLog,
  options: Pick<LiveRuntimeOptions, "goal" | "maxSeconds" | "maxEntries"> = {},
): LiveRuntime {
  let keys: readonly string[] = [];
  let pointer = { x: 0, y: 0, down: false };
  const choices: Record<string, number> = {};
  const inner = createLiveRuntime(programInput, creativeInput, {
    ...options,
    ...(log.randomSeed === undefined ? {} : { randomSeed: log.randomSeed }),
    keysDown: () => keys,
    pointer: () => pointer,
    choices,
  });
  let next = 0;
  let ticks = 0;
  let accumulated = 0;
  return {
    // The log is the only source of events; live input during a replay is ignored.
    fire() {},
    advance(seconds) {
      const produced: MultiActorTraceEntry[] = [];
      if (!Number.isFinite(seconds) || seconds <= 0) return produced;
      accumulated += seconds;
      while (accumulated + 1e-9 >= LIVE_TICK_SECONDS && ticks < log.ticks) {
        accumulated -= LIVE_TICK_SECONDS;
        ticks += 1;
        for (; next < log.inputs.length && log.inputs[next]!.tick <= ticks; next += 1) {
          const input = log.inputs[next]!;
          if (input.kind === "event") inner.fire(input.event);
          else if (input.kind === "keys") keys = input.keys;
          else if (input.kind === "pointer") pointer = { x: input.x, y: input.y, down: input.down };
          else {
            for (const key of Object.keys(choices)) delete choices[key];
            Object.assign(choices, input.choices);
          }
        }
        produced.push(...inner.advance(LIVE_TICK_SECONDS));
      }
      return produced;
    },
    get running() {
      return ticks < log.ticks;
    },
    get now() {
      return inner.now;
    },
    result: () => inner.result(),
    inputLog: () => inner.inputLog(),
  };
}

/** Rebuilds a live run from its input log at once: same program and project in, same run out. */
export function replayLiveRuntime(
  programInput: ProjectProgram,
  creativeInput: ProjectCreativeState,
  log: LiveInputLog,
  options: Pick<LiveRuntimeOptions, "goal" | "maxSeconds" | "maxEntries"> = {},
): LiveRuntime {
  const replay = createReplayRuntime(programInput, creativeInput, log, options);
  replay.advance(log.ticks * LIVE_TICK_SECONDS + 1e-6);
  return replay;
}
