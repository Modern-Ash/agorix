export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface SpriteState extends Position {
  readonly heading: number;
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
    },
    goal: world.goal,
  });
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
    },
    goal: world.goal,
  });
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
