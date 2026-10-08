export interface StagePosition {
  readonly x: number;
  readonly y: number;
}

export interface StageSprite extends StagePosition {
  readonly heading: number;
  readonly radius: number;
  readonly visible: boolean;
  readonly size: number;
  readonly costumeId?: string;
  readonly bubble?: StageBubble;
}

export interface StageBubble {
  readonly kind: "say" | "think";
  readonly text: string;
}

export interface StageGoal extends StagePosition {
  readonly radius: number;
}

export interface StageViewport {
  readonly width: number;
  readonly height: number;
}

export interface StageVariableWatcher {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly visible: boolean;
}

export interface StageSoundState {
  readonly activeSoundIds: readonly string[];
}

export interface StageState {
  readonly sprite: StageSprite;
  readonly goal: StageGoal;
  readonly viewport: StageViewport;
  readonly backdropId?: string;
  readonly variables?: readonly StageVariableWatcher[];
  readonly sounds?: StageSoundState;
}

export interface StageStateInput {
  readonly sprite?: Partial<StageSprite>;
  readonly goal?: Partial<StageGoal>;
  readonly viewport?: Partial<StageViewport>;
  readonly backdropId?: string;
  readonly variables?: readonly Partial<StageVariableWatcher>[];
  readonly sounds?: Partial<StageSoundState>;
}

export interface StageSession {
  readonly initial: StageState;
  readonly current: StageState;
}

export type StageCommand =
  | { readonly type: "move"; readonly steps: number }
  | { readonly type: "turn"; readonly degrees: number }
  | { readonly type: "reset" };

const COORDINATE_SCALE = 1_000_000_000;

export function normalizeStageCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`stage coordinate must be finite: ${value}`);
  }
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE;
}

export function normalizeStageHeading(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`stage heading must be finite: ${degrees}`);
  }
  const normalized = degrees % 360;
  return Object.is(normalized, -0) ? 0 : normalized < 0 ? normalized + 360 : normalized;
}

function normalizeRadius(value: number, path: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${path} must be a finite non-negative number: ${value}`);
  }
  return normalizeStageCoordinate(value);
}

function normalizeViewportDimension(value: number, path: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${path} must be a finite positive number: ${value}`);
  }
  return normalizeStageCoordinate(value);
}

function normalizeVariableWatchers(
  variables: readonly Partial<StageVariableWatcher>[] | undefined,
): readonly StageVariableWatcher[] | undefined {
  if (variables === undefined) {
    return undefined;
  }
  return variables
    .filter((variable) => variable.id !== undefined)
    .map((variable) => {
      const id = variable.id ?? "";
      return {
        id,
        label: variable.label ?? id,
        value: normalizeStageCoordinate(variable.value ?? 0),
        visible: variable.visible ?? false,
      };
    });
}

function normalizeSoundState(
  sounds: Partial<StageSoundState> | undefined,
): StageSoundState | undefined {
  if (sounds?.activeSoundIds === undefined) {
    return undefined;
  }
  return { activeSoundIds: [...sounds.activeSoundIds] };
}

export function createStageState(input: StageStateInput = {}): StageState {
  const variables = normalizeVariableWatchers(input.variables);
  const sounds = normalizeSoundState(input.sounds);
  return {
    sprite: {
      x: normalizeStageCoordinate(input.sprite?.x ?? 0),
      y: normalizeStageCoordinate(input.sprite?.y ?? 0),
      heading: normalizeStageHeading(input.sprite?.heading ?? 0),
      radius: normalizeRadius(input.sprite?.radius ?? 10, "sprite.radius"),
      visible: input.sprite?.visible ?? true,
      size: normalizeStageCoordinate(input.sprite?.size ?? 100),
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
      x: normalizeStageCoordinate(input.goal?.x ?? 100),
      y: normalizeStageCoordinate(input.goal?.y ?? 0),
      radius: normalizeRadius(input.goal?.radius ?? 10, "goal.radius"),
    },
    viewport: {
      width: normalizeViewportDimension(input.viewport?.width ?? 480, "viewport.width"),
      height: normalizeViewportDimension(input.viewport?.height ?? 320, "viewport.height"),
    },
    ...(input.backdropId === undefined ? {} : { backdropId: input.backdropId }),
    ...(variables === undefined ? {} : { variables }),
    ...(sounds === undefined ? {} : { sounds }),
  };
}

export function cloneStageState(state: StageState): StageState {
  return createStageState(state);
}

export function createStageSession(initial: StageStateInput = {}): StageSession {
  const state = createStageState(initial);
  return { initial: state, current: cloneStageState(state) };
}

export function moveStage(state: StageState, steps: number): StageState {
  if (!Number.isFinite(steps)) {
    throw new RangeError(`steps must be finite: ${steps}`);
  }
  const radians = (state.sprite.heading * Math.PI) / 180;
  return createStageState({
    ...state,
    sprite: {
      ...state.sprite,
      x: state.sprite.x + Math.cos(radians) * steps,
      y: state.sprite.y + Math.sin(radians) * steps,
    },
  });
}

export function turnStage(state: StageState, degrees: number): StageState {
  if (!Number.isFinite(degrees)) {
    throw new RangeError(`degrees must be finite: ${degrees}`);
  }
  return createStageState({
    ...state,
    sprite: { ...state.sprite, heading: state.sprite.heading + degrees },
  });
}

export function resetStageSession(session: StageSession): StageSession {
  return { initial: cloneStageState(session.initial), current: cloneStageState(session.initial) };
}

export function applyStageCommand(session: StageSession, command: StageCommand): StageSession {
  switch (command.type) {
    case "move":
      return { ...session, current: moveStage(session.current, command.steps) };
    case "turn":
      return { ...session, current: turnStage(session.current, command.degrees) };
    case "reset":
      return resetStageSession(session);
  }
}

export function touchingStageGoal(state: StageState): boolean {
  const dx = normalizeStageCoordinate(state.sprite.x - state.goal.x);
  const dy = normalizeStageCoordinate(state.sprite.y - state.goal.y);
  const distance = normalizeStageCoordinate(Math.hypot(dx, dy));
  return distance <= normalizeStageCoordinate(state.sprite.radius + state.goal.radius);
}
