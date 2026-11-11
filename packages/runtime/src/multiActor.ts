import { reorderActors } from "./stageOrder.js";
import {
  validateProgram,
  validateProjectCreativeState,
  type ProjectActor,
  type ProjectCreativeState,
  type ProjectProgram,
  type ProjectStage,
  type ProgramEvent,
  type Script,
  type Statement,
} from "@agorix/program-model";
import {
  DEFAULT_EXECUTION_BUDGET,
  runProgram,
  type ExecutionOptions,
  type RunOutcome,
} from "./execute.js";
import { COPIES_CAP, liveCopies, settleCopiesWorld } from "./copies.js";
import { copyRoom, isCloneId, liveClones, makeClones, orderOptions } from "./clones.js";
import { cloneWorldState, createWorldState, type WorldState } from "./world.js";

export interface MultiActorRuntimeActor {
  readonly id: string;
  readonly name: string;
  readonly world: WorldState;
  readonly visible: boolean;
  readonly size: number;
  readonly costumeId?: string;
}

export interface MultiActorRuntimeStage {
  readonly actorOrder: readonly string[];
  readonly backdropId?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface MultiActorFrame {
  readonly step: number;
  readonly activationId: string;
  readonly event: RuntimeEvent;
  readonly actorId: string;
  readonly scriptId: string;
  readonly nodeId: string;
  readonly stage: MultiActorRuntimeStage;
  readonly actors: readonly MultiActorRuntimeActor[];
}

export type RuntimeEvent =
  | { readonly type: "start" }
  | { readonly type: "keyPressed"; readonly key: string }
  | { readonly type: "actorClicked"; readonly actorId: string }
  | { readonly type: "message"; readonly message: string; readonly senderActorId?: string }
  | { readonly type: "backdropSwitched"; readonly backdropId: string }
  | { readonly type: "timerPassed"; readonly seconds: number }
  | { readonly type: "loudnessPassed"; readonly level: number }
  | { readonly type: "cloneStarted"; readonly actorId: string };

export interface MultiActorScriptActivation {
  readonly id: string;
  readonly step: number;
  readonly event: RuntimeEvent;
  readonly actorId: string;
  readonly scriptId: string;
  readonly scriptIndex: number;
  readonly reason: string;
}

export interface MultiActorTraceEntry {
  readonly step: number;
  readonly activationId: string;
  readonly event: RuntimeEvent;
  readonly actorId: string;
  readonly scriptId: string;
  readonly nodeId: string;
  readonly path: string;
  readonly statementType: Statement["type"];
  readonly stopScope?: "script" | "actor" | "scene";
  readonly note?: string;
  readonly conditionResult?: boolean;
  readonly args?: readonly number[];
  /** Live runs only: seconds the statement took (a wait, a glide, a note), for pacing playback. */
  readonly seconds?: number;
  /** Live runs only: virtual seconds since the run began when the statement ran, for a timeline. */
  readonly at?: number;
  readonly worldBefore: WorldState;
  readonly worldAfter: WorldState;
}

export interface MultiActorRunResult {
  readonly outcome: RunOutcome;
  readonly stage: MultiActorRuntimeStage;
  readonly actors: readonly MultiActorRuntimeActor[];
  readonly frames: readonly MultiActorFrame[];
  readonly trace: readonly MultiActorTraceEntry[];
  readonly activations: readonly MultiActorScriptActivation[];
  readonly stepsUsed: number;
  /** Ending PRNG state, so an incremental session can continue the same deterministic stream. */
  readonly randomState?: number;
}

export interface MultiActorExecutionOptions extends Pick<ExecutionOptions, "maxSteps"> {
  readonly goal?: WorldState["goal"];
  readonly events?: readonly RuntimeEvent[];
  readonly randomSeed?: number;
  /** Keys held for the whole run, read by `keyDown`. */
  readonly keysDown?: readonly string[];
  readonly pointer?: ExecutionOptions["pointer"];
  readonly loudness?: ExecutionOptions["loudness"];
  readonly clock?: ExecutionOptions["clock"];
  readonly choices?: ExecutionOptions["choices"];
  readonly answers?: ExecutionOptions["answers"];
  /** Restore actor worlds from a session snapshot; program variables and lists live here. */
  readonly initialWorlds?: Readonly<Record<string, WorldState>>;
  /** Restore stage actor order and backdrop from a session snapshot. */
  readonly initialStage?: MultiActorRuntimeStage;
}

export interface RuntimeActorMutable {
  id: string;
  name: string;
  world: WorldState;
  visible: boolean;
  size: number;
  costumeId?: string;
  scriptIds?: readonly string[];
}

export interface RuntimeStageMutable {
  backdropId?: string;
  width?: number;
  height?: number;
  actorOrder: string[];
}

export function defaultActor(): ProjectActor {
  return {
    id: "actor:main",
    name: "Actor",
    x: 0,
    y: 0,
    direction: 0,
    size: 100,
    visible: true,
  };
}

export function cloneRuntimeStage(stage: RuntimeStageMutable): MultiActorRuntimeStage {
  return {
    actorOrder: [...stage.actorOrder],
    ...(stage.backdropId === undefined ? {} : { backdropId: stage.backdropId }),
    ...(stage.width === undefined ? {} : { width: stage.width }),
    ...(stage.height === undefined ? {} : { height: stage.height }),
  };
}

function cloneRuntimeActor(actor: RuntimeActorMutable): MultiActorRuntimeActor {
  return {
    id: actor.id,
    name: actor.name,
    world: cloneWorldState(actor.world),
    visible: actor.world.sprite.visible ?? true,
    size: actor.world.sprite.size ?? 100,
    ...(actor.world.sprite.costumeId === undefined
      ? {}
      : { costumeId: actor.world.sprite.costumeId }),
  };
}

export function snapshotActors(
  actors: readonly RuntimeActorMutable[],
): readonly MultiActorRuntimeActor[] {
  return actors.map((actor) => cloneRuntimeActor(actor));
}

function actorWorld(
  actor: ProjectActor,
  stage: ProjectStage | undefined,
  goal: WorldState["goal"] | undefined,
): WorldState {
  return createWorldState({
    sprite: {
      x: actor.x,
      y: actor.y,
      heading: actor.direction,
      visible: actor.visible,
      size: actor.size,
      ...(actor.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
    },
    ...(stage?.backdropId === undefined ? {} : { backdropId: stage.backdropId }),
    ...(goal === undefined ? {} : { goal }),
  });
}

export function stageForCreative(creative: ProjectCreativeState): RuntimeStageMutable {
  const actorInputs = creative.actors?.length ? creative.actors : [defaultActor()];
  const orderedIds = creative.stage?.actorOrder?.length
    ? creative.stage.actorOrder
    : actorInputs.map((actor) => actor.id);
  return {
    actorOrder: [...orderedIds],
    ...(creative.stage?.backdropId === undefined ? {} : { backdropId: creative.stage.backdropId }),
    ...(creative.stage?.width === undefined ? {} : { width: creative.stage.width }),
    ...(creative.stage?.height === undefined ? {} : { height: creative.stage.height }),
  };
}

export function actorsForCreative(
  creative: ProjectCreativeState,
  stage: RuntimeStageMutable,
  goal: WorldState["goal"] | undefined,
  initialWorlds: Readonly<Record<string, WorldState>> | undefined,
): RuntimeActorMutable[] {
  const actorInputs = creative.actors?.length ? creative.actors : [defaultActor()];
  const byId = new Map(
    actorInputs.map((actor) => {
      const restored = initialWorlds?.[actor.id];
      const world =
        restored === undefined
          ? actorWorld(actor, creative.stage, goal)
          : cloneWorldState(restored);
      return [
        actor.id,
        {
          id: actor.id,
          name: actor.name,
          world,
          visible: world.sprite.visible ?? actor.visible,
          size: world.sprite.size ?? actor.size,
          ...(world.sprite.costumeId === undefined && actor.costumeId === undefined
            ? {}
            : { costumeId: world.sprite.costumeId ?? actor.costumeId }),
          ...(actor.scripts === undefined ? {} : { scriptIds: actor.scripts }),
        },
      ];
    }),
  );
  return stage.actorOrder.flatMap((id) => {
    const actor = byId.get(id);
    return actor === undefined ? [] : [actor];
  });
}

export function scriptsForActor(
  program: ProjectProgram,
  actor: RuntimeActorMutable,
  event: RuntimeEvent,
): readonly [number, Script][] {
  const scriptIds = actor.scriptIds;
  const allowed = scriptIds === undefined ? undefined : new Set(scriptIds);
  return program.scripts.flatMap((script, index) => {
    if (!triggerMatchesEvent(script.trigger, actor, event)) return [];
    if (allowed !== undefined && !allowed.has(script.id)) return [];
    return [[index, script] as const];
  });
}

function triggerMatchesEvent(
  trigger: Script["trigger"],
  actor: RuntimeActorMutable,
  event: RuntimeEvent,
): boolean {
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
      return event.type === "start";
    case "onKeyPressed":
      return event.type === "keyPressed" && trigger.key === event.key;
    case "onActorClicked":
      return event.type === "actorClicked" && event.actorId === actor.id;
    case "onMessage":
      return event.type === "message" && trigger.message === event.message;
    case "onBackdropSwitch":
      return event.type === "backdropSwitched" && trigger.backdropId === event.backdropId;
    case "onTimerOver":
      return event.type === "timerPassed" && trigger.seconds === event.seconds;
    case "onLoudnessOver":
      return event.type === "loudnessPassed" && trigger.level === event.level;
    case "onCloneStart":
      // Only the copy the event names starts it, the moment the copy exists.
      return event.type === "cloneStarted" && event.actorId === actor.id;
  }
}

export function cloneRuntimeEvent(event: RuntimeEvent): RuntimeEvent {
  switch (event.type) {
    case "start":
      return { type: "start" };
    case "keyPressed":
      return { type: "keyPressed", key: event.key };
    case "actorClicked":
      return { type: "actorClicked", actorId: event.actorId };
    case "message":
      return {
        type: "message",
        message: event.message,
        ...(event.senderActorId === undefined ? {} : { senderActorId: event.senderActorId }),
      };
    case "backdropSwitched":
      return { type: "backdropSwitched", backdropId: event.backdropId };
    case "timerPassed":
      return { type: "timerPassed", seconds: event.seconds };
    case "loudnessPassed":
      return { type: "loudnessPassed", level: event.level };
    case "cloneStarted":
      return { type: "cloneStarted", actorId: event.actorId };
  }
}

export function programEventForRuntimeEvent(event: RuntimeEvent): ProgramEvent {
  switch (event.type) {
    case "start":
      return "greenFlag";
    case "keyPressed":
      return `key:${event.key}`;
    case "actorClicked":
      return "actorClicked";
    case "message":
      return `message:${event.message}`;
    case "backdropSwitched":
      return `backdrop:${event.backdropId}`;
    case "timerPassed":
      return `timer:${event.seconds}`;
    case "loudnessPassed":
      return `loud:${event.level}`;
    case "cloneStarted":
      return "clone";
  }
}

/** The levels some script waits for with "when the loudness passes", each once. */
export function loudnessLevelsOf(program: ProjectProgram): readonly number[] {
  const levels = new Set<number>();
  for (const script of program.scripts)
    if (script.trigger.type === "onLoudnessOver") levels.add(script.trigger.level);
  return [...levels].sort((a, b) => a - b);
}

/** The seconds some script waits for with "when the time passes", smallest first, each once. */
export function timerSecondsOf(program: ProjectProgram): readonly number[] {
  const seconds = new Set<number>();
  for (const script of program.scripts)
    if (script.trigger.type === "onTimerOver") seconds.add(script.trigger.seconds);
  return [...seconds].sort((a, b) => a - b);
}

function initialEvents(
  events: readonly RuntimeEvent[] | undefined,
  program: ProjectProgram,
): RuntimeEvent[] {
  const given =
    events === undefined ? [{ type: "start" } as RuntimeEvent] : events.map(cloneRuntimeEvent);
  // The batch runner has no clock: when the run starts, the time-driven scripts follow, soonest first.
  return given.some((event) => event.type === "start")
    ? [
        ...given,
        ...timerSecondsOf(program).map(
          (seconds) => ({ type: "timerPassed", seconds }) as RuntimeEvent,
        ),
      ]
    : given;
}

export function reasonForActivation(
  event: RuntimeEvent,
  script: Script,
  actor: RuntimeActorMutable,
): string {
  switch (event.type) {
    case "start":
      return "Run started";
    case "keyPressed":
      return `Key ${JSON.stringify(event.key)} matched ${script.id}`;
    case "actorClicked":
      return `Actor ${actor.name} was clicked`;
    case "message":
      return event.senderActorId === undefined
        ? `Message ${JSON.stringify(event.message)} was received`
        : `Message ${JSON.stringify(event.message)} was broadcast by ${event.senderActorId}`;
    case "backdropSwitched":
      return `Backdrop ${JSON.stringify(event.backdropId)} was switched to`;
    case "timerPassed":
      return `${event.seconds} seconds passed`;
    case "loudnessPassed":
      return `Loudness went above ${event.level}`;
    case "cloneStarted":
      return `A copy of ${actor.name} started`;
  }
}

export function statementAtNodeId(script: Script, nodeId: string) {
  const segments = [...nodeId.matchAll(/\/(statements|procedures|body|then|else)\[(\d+)\]/g)].map(
    (match) => ({
      segment: match[1],
      index: Number(match[2]),
    }),
  );
  let statements = script.statements;
  let current = undefined as Script["statements"][number] | undefined;
  let enteringProcedure = false;
  for (const { segment, index } of segments) {
    if (segment === "procedures") {
      statements = script.procedures?.[index]?.body ?? [];
      current = undefined;
      enteringProcedure = true;
      continue;
    }
    if (enteringProcedure) {
      enteringProcedure = false;
      current = statements[index];
      continue;
    }
    if (
      segment !== "statements" &&
      current?.type !== "repeat" &&
      current?.type !== "repeatUntil" &&
      current?.type !== "if"
    ) {
      return undefined;
    }
    if (segment === "body") {
      statements =
        current?.type === "repeat" || current?.type === "repeatUntil" ? current.body : [];
    } else if (segment === "then") {
      statements = current?.type === "if" ? current.then : [];
    } else if (segment === "else") {
      statements = current?.type === "if" ? (current.else ?? []) : [];
    }
    current = statements[index];
  }
  return current;
}

export function singleScriptProgram(program: ProjectProgram, script: Script): ProjectProgram {
  return {
    schema: program.schema,
    ...(program.variables === undefined ? {} : { variables: program.variables }),
    ...(program.lists === undefined ? {} : { lists: program.lists }),
    ...(program.textVariables === undefined ? {} : { textVariables: program.textVariables }),
    ...(program.extensions === undefined ? {} : { extensions: program.extensions }),
    ...(program.sharedProcedures === undefined
      ? {}
      : { sharedProcedures: program.sharedProcedures }),
    scripts: [script],
  };
}

export function remapNodeId(nodeId: string, scriptIndex: number): string {
  return nodeId.replace(/^scripts\[0\]/, `scripts[${scriptIndex}]`);
}

function normalizeMaxSteps(maxSteps: number | undefined): number {
  const budget = maxSteps ?? DEFAULT_EXECUTION_BUDGET;
  if (!Number.isInteger(budget) || budget < 0) {
    throw new RangeError("maxSteps must be a non-negative integer");
  }
  return budget;
}

export function runMultiActorProgram(
  program: ProjectProgram,
  creativeInput: ProjectCreativeState = {},
  options: MultiActorExecutionOptions = {},
): MultiActorRunResult {
  const validatedProgram = validateProgram(program);
  const creative = validateProjectCreativeState(creativeInput, validatedProgram);
  const stage =
    options.initialStage === undefined
      ? stageForCreative(creative)
      : {
          actorOrder: [...options.initialStage.actorOrder],
          ...(options.initialStage.backdropId === undefined
            ? {}
            : { backdropId: options.initialStage.backdropId }),
          ...(options.initialStage.width === undefined
            ? {}
            : { width: options.initialStage.width }),
          ...(options.initialStage.height === undefined
            ? {}
            : { height: options.initialStage.height }),
        };
  const actors = actorsForCreative(creative, stage, options.goal, options.initialWorlds);
  const maxSteps = normalizeMaxSteps(options.maxSteps);
  let stepsUsed = 0;
  let outcome: RunOutcome = "completed";
  const trace: MultiActorTraceEntry[] = [];
  const frames: MultiActorFrame[] = [];
  const activations: MultiActorScriptActivation[] = [];
  const queue = initialEvents(options.events, program);
  const stoppedActors = new Set<string>();
  let randomState = options.randomSeed;
  let cloneCounter = 0;

  eventLoop: while (queue.length > 0) {
    const event = queue.shift();
    if (event === undefined) {
      continue;
    }
    // A copy born during this event hears the next ones, not this one.
    for (const actor of [...actors]) {
      if (stoppedActors.has(actor.id) || !actors.includes(actor)) continue;
      let deleted = false;
      for (const [scriptIndex, script] of scriptsForActor(validatedProgram, actor, event)) {
        if (stepsUsed >= maxSteps) {
          outcome = "budget-exceeded";
          break eventLoop;
        }
        const activationId = `activation:${activations.length}`;
        activations.push({
          id: activationId,
          step: stepsUsed + 1,
          event: cloneRuntimeEvent(event),
          actorId: actor.id,
          scriptId: script.id,
          scriptIndex,
          reason: reasonForActivation(event, script, actor),
        });
        const result = runProgram(singleScriptProgram(validatedProgram, script), actor.world, {
          maxSteps: maxSteps - stepsUsed,
          event: programEventForRuntimeEvent(event),
          ...(isCloneId(actor.id) ? { isClone: true } : {}),
          sensorActors: actors
            .filter((other) => other.id !== actor.id)
            .map((other) => ({
              id: other.id,
              x: other.world.sprite.x,
              y: other.world.sprite.y,
              visible: other.world.sprite.visible ?? true,
            })),
          ...(randomState === undefined ? {} : { randomSeed: randomState }),
          ...(options.keysDown === undefined ? {} : { keysDown: options.keysDown }),
          ...(options.pointer === undefined ? {} : { pointer: options.pointer }),
          ...(options.loudness === undefined ? {} : { loudness: options.loudness }),
          ...(options.clock === undefined ? {} : { clock: options.clock }),
          ...(creative.colorZones === undefined ? {} : { colorZones: creative.colorZones }),
          ...orderOptions(creative, actor.id),
          ...(options.choices === undefined ? {} : { choices: options.choices }),
          ...(options.answers === undefined ? {} : { answers: options.answers }),
        });
        randomState = result.randomState;
        const lastType = result.trace.at(-1)?.statementType;
        deleted = isCloneId(actor.id) && lastType === "deleteThisClone";
        if (result.outcome === "budget-exceeded") outcome = "budget-exceeded";
        else if (result.outcome === "stopped" && outcome === "completed" && !deleted)
          outcome = "stopped";
        for (const entry of result.trace) {
          let note = entry.note;
          const nodeId = remapNodeId(entry.nodeId, scriptIndex);
          actor.world = cloneWorldState(entry.worldAfter);
          if (entry.worldAfter.backdropId !== undefined) {
            stage.backdropId = entry.worldAfter.backdropId;
          }
          if (entry.statementType === "goToLayer") {
            const statement = statementAtNodeId(script, entry.nodeId);
            if (statement?.type === "goToLayer") {
              stage.actorOrder = reorderActors(stage.actorOrder, actor.id, statement);
            }
          }
          if (entry.statementType === "switchBackdrop") {
            const statement = statementAtNodeId(script, entry.nodeId);
            if (statement?.type === "switchBackdrop")
              queue.push({ type: "backdropSwitched", backdropId: statement.backdropId });
          }
          if (entry.statementType === "createCopies") {
            const statement = statementAtNodeId(script, entry.nodeId);
            if (statement?.type === "createCopies" && statement.withScript === true) {
              const made = makeClones(
                validatedProgram,
                actor,
                Math.min(statement.count, copyRoom(actors)),
                statement.rule,
                () => (cloneCounter += 1),
              );
              if (made.length < statement.count)
                note = `createCopies: limit of ${COPIES_CAP} copies`;
              for (const clone of made) {
                actors.push(clone);
                stage.actorOrder = [...stage.actorOrder, clone.id];
                queue.push({ type: "cloneStarted", actorId: clone.id });
              }
            }
          }
          if (entry.statementType === "broadcast") {
            const statement = statementAtNodeId(script, entry.nodeId);
            if (statement?.type === "broadcast") {
              queue.push({
                type: "message",
                message: statement.message,
                senderActorId: actor.id,
              });
            }
          }
          const mapped: MultiActorTraceEntry = {
            step: stepsUsed + entry.step,
            activationId,
            event: cloneRuntimeEvent(event),
            actorId: actor.id,
            scriptId: script.id,
            nodeId,
            path: nodeId,
            statementType: entry.statementType,
            ...(entry.stopScope === undefined ? {} : { stopScope: entry.stopScope }),
            ...(note === undefined ? {} : { note }),
            ...(entry.conditionResult === undefined
              ? {}
              : { conditionResult: entry.conditionResult }),
            ...(entry.args === undefined ? {} : { args: entry.args }),
            worldBefore: cloneWorldState(entry.worldBefore),
            worldAfter: cloneWorldState(entry.worldAfter),
          };
          trace.push(mapped);
          frames.push({
            step: mapped.step,
            activationId,
            event: cloneRuntimeEvent(event),
            actorId: actor.id,
            scriptId: script.id,
            nodeId,
            stage: cloneRuntimeStage(stage),
            actors: snapshotActors(actors),
          });
        }
        actor.world = cloneWorldState(result.world);
        // A run keeps at most COPIES_CAP live copies; the character that just made them gives up the extra.
        const over = liveCopies(actors.map((item) => item.world)) + liveClones(actors) - COPIES_CAP;
        if (over > 0 && actor.world.copies !== undefined)
          actor.world = createWorldState({
            ...actor.world,
            copies: actor.world.copies.slice(0, Math.max(0, actor.world.copies.length - over)),
          });
        stepsUsed += result.stepsUsed;
        if (result.outcome === "budget-exceeded") break eventLoop;
        if (deleted) {
          // A copy that ends itself leaves the stage; the frames already show it there.
          actors.splice(actors.indexOf(actor), 1);
          stage.actorOrder = stage.actorOrder.filter((id) => id !== actor.id);
          break;
        }
        if (result.outcome === "stopped") {
          if (result.stopScope === "script") continue;
          if (result.stopScope === "actor") {
            stoppedActors.add(actor.id);
            break;
          }
          break eventLoop;
        }
      }
    }
  }

  // A run shown finished has no clock: falling copies have landed and followers trail behind.
  for (const actor of actors) actor.world = settleCopiesWorld(actor.world);
  return {
    outcome,
    stage: cloneRuntimeStage(stage),
    actors: snapshotActors(actors),
    frames,
    trace,
    activations,
    stepsUsed,
    ...(randomState === undefined ? {} : { randomState }),
  };
}
