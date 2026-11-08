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
import { cloneWorldState, type WorldState } from "./world.js";

/** Scratch-like frame rate: each live script runs at most one statement per tick. */
export const LIVE_TICK_SECONDS = 1 / 30;
/** Total virtual time one live session may run, so a forever loop cannot run unseen forever. */
export const LIVE_MAX_SECONDS = 600;
/** Trace entries one live session records; the run ends like an exhausted budget past it. */
export const LIVE_MAX_ENTRIES = 3_000;
/** Frames kept for stepping back through a run; later statements still run and are traced. */
export const LIVE_MAX_FRAMES = 1_000;

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
  const pending: RuntimeEvent[] = [];
  const stopped = new Set<string>();
  let outcome: MultiActorRunResult["outcome"] = "completed";
  let randomState = options.randomSeed;
  let now = 0;
  let accumulated = 0;
  let halted = false;
  let steps = 0;

  const sensors = (self: RuntimeActorMutable) =>
    actors
      .filter((other) => other.id !== self.id)
      .map((other) => ({
        id: other.id,
        x: other.world.sprite.x,
        y: other.world.sprite.y,
        visible: other.world.sprite.visible ?? true,
      }));

  function start(actor: RuntimeActorMutable, scriptIndex: number, event: RuntimeEvent) {
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
        return options.keysDown?.() ?? [];
      },
      get pointer() {
        return options.pointer?.() ?? { x: 0, y: 0, down: false };
      },
      ...(options.choices === undefined ? {} : { choices: options.choices }),
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
    });
  }

  function dispatch(event: RuntimeEvent) {
    for (const actor of actors) {
      if (stopped.has(actor.id)) continue;
      for (const [index] of scriptsForActor(program, actor, event)) start(actor, index, event);
    }
  }

  function endAll() {
    halted = true;
    for (const activation of active) activation.alive = false;
  }

  function stepActivation(activation: Activation): MultiActorTraceEntry | undefined {
    const { actor, stepper } = activation;
    stepper.world = actor.world;
    if (randomState !== undefined) stepper.randomState = randomState;
    const result = stepper.step();
    actor.world = cloneWorldState(stepper.world);
    randomState = stepper.randomState;
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
      if (statement?.type === "broadcast")
        pending.push({ type: "message", message: statement.message, senderActorId: actor.id });
    }
    steps += 1;
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
      worldBefore: raw.worldBefore,
      worldAfter: raw.worldAfter,
    };
    trace.push(mapped);
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
    // A wait lasts its seconds; a note or drum lasts its beats ("play until done").
    const waited = Math.max(0, result.at - activation.lastAt);
    activation.lastAt = result.at;
    activation.wakeAt = now + waited + (raw.audio?.seconds ?? 0);
    return mapped;
  }

  function tick(produced: MultiActorTraceEntry[]) {
    now = Math.round((now + LIVE_TICK_SECONDS) * 1e6) / 1e6;
    for (const event of pending.splice(0)) dispatch(event);
    for (const activation of [...active]) {
      if (!activation.alive || halted || activation.wakeAt > now + 1e-9) continue;
      const entry = stepActivation(activation);
      if (entry) produced.push(entry);
      if (trace.length >= maxEntries) {
        outcome = "budget-exceeded";
        endAll();
      }
    }
    for (let i = active.length - 1; i >= 0; i -= 1) if (!active[i]!.alive) active.splice(i, 1);
    if (now >= maxSeconds && active.length > 0) {
      outcome = "budget-exceeded";
      endAll();
      active.length = 0;
    }
  }

  return {
    fire(event) {
      if (halted) return;
      pending.push(event);
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
      return !halted && (active.length > 0 || pending.length > 0);
    },
    get now() {
      return now;
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
