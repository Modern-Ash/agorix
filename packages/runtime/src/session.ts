import {
  validateProgram,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import {
  runMultiActorProgram,
  type MultiActorRunResult,
  type MultiActorRuntimeActor,
  type MultiActorRuntimeStage,
  type RuntimeEvent,
} from "./multiActor.js";
import { cloneWorldState, type WorldState } from "./world.js";

/**
 * Incremental runtime for same-room games (ADR 0010, F3). `runMultiActorProgram` is a finite
 * call: it starts from a creative project and returns the result. This session keeps the actor
 * worlds, stage order and PRNG state between calls, so one ordered frame can be applied at a time
 * and every device can reach the same snapshot from the same inputs.
 */

export const RUNTIME_SESSION_VERSION = 1;
export const DEFAULT_SESSION_STEPS = 1_000;

export interface RuntimeSessionOptions {
  readonly program: ProjectProgram;
  readonly creative?: ProjectCreativeState;
  readonly goal?: WorldState["goal"];
  readonly randomSeed?: number;
  /** Step budget per `step`, not for the whole match. */
  readonly maxStepsPerStep?: number;
}

export interface RuntimeStepOptions {
  readonly maxSteps?: number;
}

export interface RuntimeSessionSnapshot {
  readonly version: number;
  readonly stage: MultiActorRuntimeStage;
  readonly actors: readonly MultiActorRuntimeActor[];
  readonly randomState?: number;
}

export interface RuntimeSessionState {
  readonly stage: MultiActorRuntimeStage;
  readonly actors: readonly MultiActorRuntimeActor[];
  readonly randomState?: number;
}

function cloneStage(stage: MultiActorRuntimeStage): MultiActorRuntimeStage {
  return {
    actorOrder: [...stage.actorOrder],
    ...(stage.backdropId === undefined ? {} : { backdropId: stage.backdropId }),
    ...(stage.width === undefined ? {} : { width: stage.width }),
    ...(stage.height === undefined ? {} : { height: stage.height }),
  };
}

function cloneActor(actor: MultiActorRuntimeActor): MultiActorRuntimeActor {
  return {
    id: actor.id,
    name: actor.name,
    world: cloneWorldState(actor.world),
    visible: actor.visible,
    size: actor.size,
    ...(actor.costumeId === undefined ? {} : { costumeId: actor.costumeId }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(value: unknown): RuntimeSessionState {
  if (!isRecord(value) || value["version"] !== RUNTIME_SESSION_VERSION) {
    throw new RangeError("invalid runtime session snapshot");
  }
  const stage = value["stage"];
  const actors = value["actors"];
  const randomState = value["randomState"];
  if (
    !isRecord(stage) ||
    !Array.isArray(stage["actorOrder"]) ||
    stage["actorOrder"].length > 256 ||
    stage["actorOrder"].some((id) => typeof id !== "string") ||
    new Set(stage["actorOrder"]).size !== stage["actorOrder"].length ||
    (stage["backdropId"] !== undefined && typeof stage["backdropId"] !== "string") ||
    (stage["width"] !== undefined && !Number.isFinite(stage["width"])) ||
    (stage["height"] !== undefined && !Number.isFinite(stage["height"])) ||
    !Array.isArray(actors) ||
    actors.length > 256 ||
    (randomState !== undefined &&
      (typeof randomState !== "number" ||
        !Number.isInteger(randomState) ||
        randomState < 0 ||
        randomState > 0xffff_ffff))
  ) {
    throw new RangeError("invalid runtime session snapshot");
  }

  const parsedActors: MultiActorRuntimeActor[] = [];
  const ids = new Set<string>();
  for (const raw of actors) {
    if (
      !isRecord(raw) ||
      typeof raw["id"] !== "string" ||
      raw["id"].length === 0 ||
      ids.has(raw["id"]) ||
      typeof raw["name"] !== "string" ||
      typeof raw["visible"] !== "boolean" ||
      typeof raw["size"] !== "number" ||
      !Number.isFinite(raw["size"]) ||
      raw["size"] < 0 ||
      (raw["costumeId"] !== undefined && typeof raw["costumeId"] !== "string") ||
      !isRecord(raw["world"])
    ) {
      throw new RangeError("invalid runtime session snapshot");
    }
    ids.add(raw["id"]);
    let world: WorldState;
    try {
      world = cloneWorldState(raw["world"] as unknown as WorldState);
    } catch {
      throw new RangeError("invalid runtime session snapshot");
    }
    parsedActors.push({
      id: raw["id"],
      name: raw["name"],
      world,
      visible: raw["visible"],
      size: raw["size"],
      ...(raw["costumeId"] === undefined ? {} : { costumeId: raw["costumeId"] }),
    });
  }

  return {
    stage: {
      actorOrder: [...(stage["actorOrder"] as string[])],
      ...(stage["backdropId"] === undefined ? {} : { backdropId: stage["backdropId"] as string }),
      ...(stage["width"] === undefined ? {} : { width: stage["width"] as number }),
      ...(stage["height"] === undefined ? {} : { height: stage["height"] as number }),
    },
    actors: parsedActors,
    ...(randomState === undefined ? {} : { randomState: randomState as number }),
  };
}

function digestState(state: RuntimeSessionState): number {
  const text = JSON.stringify({
    stage: state.stage,
    actors: state.actors,
    ...(state.randomState === undefined ? {} : { randomState: state.randomState }),
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class RuntimeSession {
  private readonly program: ProjectProgram;
  private readonly creative: ProjectCreativeState;
  private readonly goal: WorldState["goal"] | undefined;
  private readonly maxSteps: number;
  private stage: MultiActorRuntimeStage;
  private actors: readonly MultiActorRuntimeActor[];
  private worlds: Readonly<Record<string, WorldState>>;
  private randomState: number | undefined;

  constructor(options: RuntimeSessionOptions) {
    this.program = validateProgram(options.program);
    this.creative = validateProjectCreativeState(options.creative ?? {}, this.program);
    this.goal = options.goal;
    this.maxSteps = options.maxStepsPerStep ?? DEFAULT_SESSION_STEPS;
    if (!Number.isInteger(this.maxSteps) || this.maxSteps < 0) {
      throw new RangeError("maxStepsPerStep must be a non-negative integer");
    }
    const initial = runMultiActorProgram(this.program, this.creative, {
      events: [],
      maxSteps: 0,
      ...(this.goal === undefined ? {} : { goal: this.goal }),
      ...(options.randomSeed === undefined ? {} : { randomSeed: options.randomSeed }),
    });
    this.stage = cloneStage(initial.stage);
    this.actors = initial.actors.map(cloneActor);
    this.worlds = this.worldsOf(this.actors);
    this.randomState = initial.randomState;
  }

  /** Apply one ordered frame. An empty event list is a valid no-op frame. */
  step(events: readonly RuntimeEvent[], options: RuntimeStepOptions = {}): MultiActorRunResult {
    const result = runMultiActorProgram(this.program, this.creative, {
      events,
      maxSteps: options.maxSteps ?? this.maxSteps,
      ...(this.goal === undefined ? {} : { goal: this.goal }),
      ...(this.randomState === undefined ? {} : { randomSeed: this.randomState }),
      initialWorlds: this.worlds,
      initialStage: this.stage,
    });
    this.apply(result);
    return result;
  }

  snapshot(): RuntimeSessionSnapshot {
    return {
      version: RUNTIME_SESSION_VERSION,
      stage: cloneStage(this.stage),
      actors: this.actors.map(cloneActor),
      ...(this.randomState === undefined ? {} : { randomState: this.randomState }),
    };
  }

  restore(snapshot: unknown): void {
    const state = parseSnapshot(snapshot);
    this.stage = state.stage;
    this.actors = state.actors.map(cloneActor);
    this.worlds = this.worldsOf(this.actors);
    this.randomState = state.randomState;
  }

  digest(): number {
    return digestState({
      stage: this.stage,
      actors: this.actors,
      ...(this.randomState === undefined ? {} : { randomState: this.randomState }),
    });
  }

  private apply(result: MultiActorRunResult): void {
    this.stage = cloneStage(result.stage);
    this.actors = result.actors.map(cloneActor);
    this.worlds = this.worldsOf(this.actors);
    this.randomState = result.randomState;
  }

  private worldsOf(
    actors: readonly MultiActorRuntimeActor[],
  ): Readonly<Record<string, WorldState>> {
    return Object.fromEntries(
      actors.map((actor) => [actor.id, cloneWorldState(actor.world)] as const),
    );
  }
}
