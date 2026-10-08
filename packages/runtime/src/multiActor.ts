import {
  validateProgram,
  validateProjectCreativeState,
  type ProjectActor,
  type ProjectCreativeState,
  type ProjectProgram,
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

export interface MultiActorFrame {
  readonly step: number;
  readonly activationId: string;
  readonly actorId: string;
  readonly scriptId: string;
  readonly nodeId: string;
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
  readonly worldBefore: WorldState;
  readonly worldAfter: WorldState;
}

export interface MultiActorRunResult {
  readonly outcome: RunOutcome;
  readonly actors: readonly MultiActorRuntimeActor[];
  readonly frames: readonly MultiActorFrame[];
  readonly trace: readonly MultiActorTraceEntry[];
  readonly activations: readonly MultiActorScriptActivation[];
  readonly stepsUsed: number;
}

export interface MultiActorExecutionOptions extends Pick<ExecutionOptions, "maxSteps"> {
  readonly goal?: WorldState["goal"];
  readonly events?: readonly RuntimeEvent[];
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

function cloneRuntimeActor(actor: RuntimeActorMutable): MultiActorRuntimeActor {
  return {
    id: actor.id,
    name: actor.name,
    world: cloneWorldState(actor.world),
    visible: actor.world.sprite.visible,
    size: actor.world.sprite.size,
    ...(actor.world.sprite.costumeId === undefined
      ? {}
      : { costumeId: actor.world.sprite.costumeId }),
  };
}

function snapshotActors(actors: readonly RuntimeActorMutable[]): readonly MultiActorRuntimeActor[] {
  return actors.map((actor) => cloneRuntimeActor(actor));
}

function actorWorld(actor: ProjectActor, goal: WorldState["goal"] | undefined): WorldState {
  return createWorldState({
    sprite: {
      x: actor.x,
      y: actor.y,
      heading: actor.direction,
      visible: actor.visible,
      size: actor.size,
      ...(actor.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
    },
    ...(goal === undefined ? {} : { goal }),
  });
}

function actorsForCreative(
  creative: ProjectCreativeState,
  goal: WorldState["goal"] | undefined,
): RuntimeActorMutable[] {
  const actorInputs = creative.actors?.length ? creative.actors : [defaultActor()];
  const byId = new Map(
    actorInputs.map((actor) => [
      actor.id,
      {
        id: actor.id,
        name: actor.name,
        world: actorWorld(actor, goal),
        visible: actor.visible,
        size: actor.size,
        ...(actor.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
        ...(actor.scripts === undefined ? {} : { scriptIds: actor.scripts }),
      },
    ]),
  );
  const orderedIds = creative.stage?.actorOrder?.length
    ? creative.stage.actorOrder
    : actorInputs.map((actor) => actor.id);
  return orderedIds.flatMap((id) => {
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
  const segments = [...nodeId.matchAll(/\/(statements|body|then)\[(\d+)\]/g)].map((match) => ({
    segment: match[1],
    index: Number(match[2]),
  }));
  let statements = script.statements;
  let current = undefined as Script["statements"][number] | undefined;
  for (const { segment, index } of segments) {
    if (segment !== "statements" && current?.type !== "repeat" && current?.type !== "if") {
      return undefined;
    }
    if (segment === "body") {
      statements = current?.type === "repeat" ? current.body : [];
    } else if (segment === "then") {
      statements = current?.type === "if" ? current.then : [];
    }
    current = statements[index];
  }
  return current;
}

function singleScriptProgram(program: ProjectProgram, script: Script): ProjectProgram {
  return {
    schema: program.schema,
    ...(program.variables === undefined ? {} : { variables: program.variables }),
    scripts: [script],
  };
}

function remapNodeId(nodeId: string, scriptIndex: number): string {
  return nodeId.replace(/^scripts\[0\]/, `scripts[${scriptIndex}]`);
}

function mergeOutcome(left: RunOutcome, right: RunOutcome): RunOutcome {
  if (left !== "completed") return left;
  return right;
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
  const actors = actorsForCreative(creative, options.goal);
  const maxSteps = normalizeMaxSteps(options.maxSteps);
  let stepsUsed = 0;
  let outcome: RunOutcome = "completed";
  const trace: MultiActorTraceEntry[] = [];
  const frames: MultiActorFrame[] = [];
  const activations: MultiActorScriptActivation[] = [];
  const queue = initialEvents(options.events);

  while (queue.length > 0) {
    const event = queue.shift();
    if (event === undefined) {
      continue;
    }
    for (const actor of actors) {
      for (const [scriptIndex, script] of scriptsForActor(validatedProgram, actor, event)) {
        if (stepsUsed >= maxSteps) {
          outcome = "budget-exceeded";
          break;
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
        });
        outcome = mergeOutcome(outcome, result.outcome);
        for (const entry of result.trace) {
          const nodeId = remapNodeId(entry.nodeId, scriptIndex);
          actor.world = cloneWorldState(entry.worldAfter);
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
            worldBefore: cloneWorldState(entry.worldBefore),
            worldAfter: cloneWorldState(entry.worldAfter),
          };
          trace.push(mapped);
          frames.push({
            step: mapped.step,
            activationId,
            actorId: actor.id,
            scriptId: script.id,
            nodeId,
            actors: snapshotActors(actors),
          });
        }
        actor.world = cloneWorldState(result.world);
        stepsUsed += result.stepsUsed;
        if (result.outcome !== "completed") break;
      }
      if (outcome !== "completed") break;
    }
    if (outcome !== "completed") break;
  }

  return {
    outcome,
    actors: snapshotActors(actors),
    frames,
    trace,
    activations,
    stepsUsed,
  };
}
