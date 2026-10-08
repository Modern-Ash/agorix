export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface SpriteState extends Position {
  readonly heading: number;
  readonly visible: boolean;
  readonly size: number;
  readonly costumeId?: string;
  readonly bubble?: LooksBubble;
}

export interface LooksBubble {
  readonly kind: "say" | "think";
  readonly text: string;
}

export interface VariableState {
  readonly value: number;
  readonly visible: boolean;
}

export interface SoundState {
  readonly activeSoundIds: readonly string[];
}

export interface WorldState {
  readonly sprite: SpriteState;
  readonly goal: Position;
  readonly backdropId?: string;
  readonly variables?: Readonly<Record<string, VariableState>>;
  readonly sounds?: SoundState;
}

export interface WorldStateInput {
  readonly sprite?: Partial<SpriteState>;
  readonly goal?: Partial<Position>;
  readonly backdropId?: string;
  readonly variables?: Readonly<Record<string, Partial<VariableState> | undefined>>;
  readonly sounds?: Partial<SoundState>;
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

function normalizeVariables(
  variables: Readonly<Record<string, Partial<VariableState> | undefined>> | undefined,
): Readonly<Record<string, VariableState>> | undefined {
  if (variables === undefined) {
    return undefined;
  }
  const normalized: Record<string, VariableState> = {};
  for (const key of Object.keys(variables).sort()) {
    const variable = variables[key];
    if (variable === undefined) {
      continue;
    }
    normalized[key] = {
      value: normalizeCoordinate(variable.value ?? 0),
      visible: variable.visible ?? false,
    };
  }
  return normalized;
}

export function createWorldState(input: WorldStateInput = {}): WorldState {
  const variables = normalizeVariables(input.variables);
  const activeSoundIds =
    input.sounds?.activeSoundIds === undefined ? undefined : [...input.sounds.activeSoundIds];
  return {
    sprite: {
      x: normalizeCoordinate(input.sprite?.x ?? 0),
      y: normalizeCoordinate(input.sprite?.y ?? 0),
      heading: normalizeHeading(input.sprite?.heading ?? 0),
      visible: input.sprite?.visible ?? true,
      size: normalizeCoordinate(input.sprite?.size ?? 100),
      ...(input.sprite?.costumeId === undefined ? {} : { costumeId: input.sprite.costumeId }),
      ...(input.sprite?.bubble === undefined
        ? {}
        : {
            bubble: {
              kind: input.sprite.bubble.kind,
              text: input.sprite.bubble.text,
            },
          }),
    },
    goal: {
      x: normalizeCoordinate(input.goal?.x ?? 0),
      y: normalizeCoordinate(input.goal?.y ?? 0),
    },
    ...(input.backdropId === undefined ? {} : { backdropId: input.backdropId }),
    ...(variables === undefined ? {} : { variables }),
    ...(activeSoundIds === undefined ? {} : { sounds: { activeSoundIds } }),
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
    ...world,
    sprite: {
      ...world.sprite,
      x: world.sprite.x + Math.cos(radians) * steps,
      y: world.sprite.y + Math.sin(radians) * steps,
      heading: world.sprite.heading,
    },
  });
}

export function turnWorld(world: WorldState, degrees: number): WorldState {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`degrees must be finite: ${degrees}`);
  }
  return createWorldState({
    ...world,
    sprite: {
      ...world.sprite,
      x: world.sprite.x,
      y: world.sprite.y,
      heading: world.sprite.heading + degrees,
    },
  });
}

export function sayWorld(world: WorldState, text: string): WorldState {
  return createWorldState({
    ...world,
    sprite: { ...world.sprite, bubble: { kind: "say", text } },
  });
}

export function thinkWorld(world: WorldState, text: string): WorldState {
  return createWorldState({
    ...world,
    sprite: { ...world.sprite, bubble: { kind: "think", text } },
  });
}

export function showWorld(world: WorldState): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, visible: true } });
}

export function hideWorld(world: WorldState): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, visible: false } });
}

export function setSpriteSizeWorld(world: WorldState, size: number): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, size } });
}

export function switchCostumeWorld(world: WorldState, costumeId: string): WorldState {
  return createWorldState({ ...world, sprite: { ...world.sprite, costumeId } });
}

export function switchBackdropWorld(world: WorldState, backdropId: string): WorldState {
  return createWorldState({ ...world, backdropId });
}

export function playSoundWorld(world: WorldState, soundId: string): WorldState {
  const current = world.sounds?.activeSoundIds ?? [];
  return createWorldState({
    ...world,
    sounds: {
      activeSoundIds: current.includes(soundId) ? current : [...current, soundId],
    },
  });
}

export function stopSoundsWorld(world: WorldState): WorldState {
  return createWorldState({ ...world, sounds: { activeSoundIds: [] } });
}

export function getVariableWorld(world: WorldState, variableId: string): number {
  return world.variables?.[variableId]?.value ?? 0;
}

export function setVariableWorld(world: WorldState, variableId: string, value: number): WorldState {
  if (!Number.isFinite(value)) {
    throw new RangeError(`variable value must be finite: ${value}`);
  }
  const previous = world.variables?.[variableId];
  return createWorldState({
    ...world,
    variables: {
      ...world.variables,
      [variableId]: { value, visible: previous?.visible ?? false },
    },
  });
}

export function changeVariableWorld(
  world: WorldState,
  variableId: string,
  delta: number,
): WorldState {
  if (!Number.isFinite(delta)) {
    throw new RangeError(`variable delta must be finite: ${delta}`);
  }
  return setVariableWorld(world, variableId, getVariableWorld(world, variableId) + delta);
}

export function setVariableVisibilityWorld(
  world: WorldState,
  variableId: string,
  visible: boolean,
): WorldState {
  const previous = world.variables?.[variableId];
  return createWorldState({
    ...world,
    variables: {
      ...world.variables,
      [variableId]: { value: previous?.value ?? 0, visible },
    },
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
