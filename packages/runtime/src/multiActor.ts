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
  | { readonly type: "message"; readonly message: string; readonly senderActorId?: string };

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
  readonly choices?: ExecutionOptions["choices"];
  /** Restore actor worlds from a session snapshot; program variables and lists live here. */
  readonly initialWorlds?: Readonly<Record<string, WorldState>>;
  /** Restore stage actor order and backdrop from a session snapshot. */
  readonly initialStage?: MultiActorRuntimeStage;
}

interface RuntimeActorMutable {
  id: string;
  name: string;
  world: WorldState;
  visible: boolean;
  size: number;
  costumeId?: string;
  scriptIds?: readonly string[];
}

interface RuntimeStageMutable {
  backdropId?: string;
  width?: number;
  height?: number;
  actorOrder: string[];
}

function defaultActor(): ProjectActor {
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

function cloneRuntimeStage(stage: RuntimeStageMutable): MultiActorRuntimeStage {
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

function snapshotActors(actors: readonly RuntimeActorMutable[]): readonly MultiActorRuntimeActor[] {
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

function stageForCreative(creative: ProjectCreativeState): RuntimeStageMutable {
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

function actorsForCreative(
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

function scriptsForActor(
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
  }
}

function cloneRuntimeEvent(event: RuntimeEvent): RuntimeEvent {
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
  }
}

function programEventForRuntimeEvent(event: RuntimeEvent): ProgramEvent {
  switch (event.type) {
    case "start":
      return "greenFlag";
    case "keyPressed":
      return `key:${event.key}`;
    case "actorClicked":
      return "actorClicked";
    case "message":
      return `message:${event.message}`;
  }
}

function initialEvents(events: readonly RuntimeEvent[] | undefined): RuntimeEvent[] {
  return events === undefined ? [{ type: "start" }] : events.map(cloneRuntimeEvent);
}

function reasonForActivation(
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
  }
}

function statementAtNodeId(script: Script, nodeId: string) {
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

function singleScriptProgram(program: ProjectProgram, script: Script): ProjectProgram {
  return {
    schema: program.schema,
    ...(program.variables === undefined ? {} : { variables: program.variables }),
    ...(program.lists === undefined ? {} : { lists: program.lists }),
    ...(program.extensions === undefined ? {} : { extensions: program.extensions }),
    scripts: [script],
  };
}

function remapNodeId(nodeId: string, scriptIndex: number): string {
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
  const queue = initialEvents(options.events);
  const stoppedActors = new Set<string>();
  let randomState = options.randomSeed;

  eventLoop: while (queue.length > 0) {
    const event = queue.shift();
    if (event === undefined) {
      continue;
    }
    for (const actor of actors) {
      if (stoppedActors.has(actor.id)) continue;
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
          ...(options.choices === undefined ? {} : { choices: options.choices }),
        });
        randomState = result.randomState;
        if (result.outcome === "budget-exceeded") outcome = "budget-exceeded";
        else if (result.outcome === "stopped" && outcome === "completed") outcome = "stopped";
        for (const entry of result.trace) {
          const nodeId = remapNodeId(entry.nodeId, scriptIndex);
          actor.world = cloneWorldState(entry.worldAfter);
          if (entry.worldAfter.backdropId !== undefined) {
            stage.backdropId = entry.worldAfter.backdropId;
          }
          if (entry.statementType === "goToLayer") {
            const statement = statementAtNodeId(script, entry.nodeId);
            if (statement?.type === "goToLayer") {
              const rest = stage.actorOrder.filter((id) => id !== actor.id);
              stage.actorOrder =
                statement.layer === "front" ? [...rest, actor.id] : [actor.id, ...rest];
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
            ...(entry.note === undefined ? {} : { note: entry.note }),
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
        stepsUsed += result.stepsUsed;
        if (result.outcome === "budget-exceeded") break eventLoop;
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
