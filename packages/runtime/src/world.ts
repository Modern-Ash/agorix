export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface SpriteState extends Position {
  readonly heading: number;
  /** Looks are stored only when they differ from the defaults, so plain worlds stay unchanged. */
  readonly hidden?: true;
  readonly sizePercent?: number;
  readonly say?: string;
}

export interface WorldState {
  readonly sprite: SpriteState;
  readonly goal: Position;
}

export interface WorldStateInput {
  readonly sprite?: Partial<SpriteState>;
  readonly goal?: Partial<Position>;
}

const COORDINATE_SCALE = 1_000_000_000;

export function normalizeCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`coordinate must be finite: ${value}`);
  }
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE;
}

export function normalizeHeading(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`heading must be finite: ${degrees}`);
  }
  const normalized = degrees % 360;
  return Object.is(normalized, -0) ? 0 : normalized < 0 ? normalized + 360 : normalized;
}

export function createWorldState(input: WorldStateInput = {}): WorldState {
  return {
    sprite: {
      x: normalizeCoordinate(input.sprite?.x ?? 0),
      y: normalizeCoordinate(input.sprite?.y ?? 0),
      heading: normalizeHeading(input.sprite?.heading ?? 0),
      ...(input.sprite?.hidden === true ? { hidden: true as const } : {}),
      ...(input.sprite?.sizePercent !== undefined && input.sprite.sizePercent !== 100
        ? { sizePercent: normalizeCoordinate(input.sprite.sizePercent) }
        : {}),
      ...(input.sprite?.say !== undefined && input.sprite.say !== ""
        ? { say: input.sprite.say }
        : {}),
    },
    goal: {
      x: normalizeCoordinate(input.goal?.x ?? 0),
      y: normalizeCoordinate(input.goal?.y ?? 0),
    },
  };
}

export function cloneWorldState(world: WorldState): WorldState {
  return createWorldState(world);
}

export function moveWorld(world: WorldState, steps: number): WorldState {
  if (!Number.isFinite(steps)) {
    throw new RangeError(`steps must be finite: ${steps}`);
  }
  const radians = (world.sprite.heading * Math.PI) / 180;
  return createWorldState({
    sprite: {
      x: world.sprite.x + Math.cos(radians) * steps,
      y: world.sprite.y + Math.sin(radians) * steps,
      heading: world.sprite.heading,
      ...looksOf(world),
    },
    goal: world.goal,
  });
}

function looksOf(world: WorldState): Partial<SpriteState> {
  const { hidden, sizePercent, say } = world.sprite;
  return {
    ...(hidden === undefined ? {} : { hidden }),
    ...(sizePercent === undefined ? {} : { sizePercent }),
    ...(say === undefined ? {} : { say }),
  };
}

export function turnWorld(world: WorldState, degrees: number): WorldState {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`degrees must be finite: ${degrees}`);
  }
  return createWorldState({
    sprite: {
      x: world.sprite.x,
      y: world.sprite.y,
      heading: world.sprite.heading + degrees,
      ...looksOf(world),
    },
    goal: world.goal,
  });
}

export function setWorldX(world: WorldState, x: number): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, x } });
}

export function setWorldY(world: WorldState, y: number): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, y } });
}

export function showWorld(world: WorldState): WorldState {
  const sprite: { -readonly [K in keyof SpriteState]?: SpriteState[K] } = { ...world.sprite };
  delete sprite.hidden;
  return createWorldState({ ...world, sprite });
}

export function hideWorld(world: WorldState): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, hidden: true } });
}

export function setWorldSize(world: WorldState, percent: number): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, sizePercent: percent } });
}

export function sayWorld(world: WorldState, message: string): WorldState {
  const sprite: { -readonly [K in keyof SpriteState]?: SpriteState[K] } = { ...world.sprite };
  delete sprite.say;
  if (message !== "") sprite.say = message;
  return createWorldState({ ...world, sprite });
}

export function touchingGoal(world: WorldState): boolean {
  return (
    normalizeCoordinate(world.sprite.x) === normalizeCoordinate(world.goal.x) &&
    normalizeCoordinate(world.sprite.y) === normalizeCoordinate(world.goal.y)
  );
}

export function resetWorldState(initialWorld: WorldState): WorldState {
  return cloneWorldState(initialWorld);
}
