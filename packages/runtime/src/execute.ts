import type {
  Expression,
  ProcedureParamId,
  ProgramList,
  ProgramVariable,
  ProgramEvent,
  ProjectProgram,
  Script,
  Statement,
  Trigger,
} from "@agorix/program-model";
import {
  MOVE_STEPS_MAX,
  MOVE_STEPS_MIN,
  PROCEDURE_MAX_CALL_DEPTH,
  REPEAT_COUNT_MAX,
  REPEAT_COUNT_MIN,
  REPEAT_UNTIL_MAX_PASSES,
  TURN_DEGREES_MAX,
  TURN_DEGREES_MIN,
  WAIT_SECONDS_MAX,
  WAIT_SECONDS_MIN,
  eventForTrigger,
  validateProgram,
} from "@agorix/program-model";
import {
  cloneWorldState,
  createWorldState,
  changeVariableWorld,
  getListItemWorld,
  getListLengthWorld,
  getVariableWorld,
  listAddWorld,
  listRemoveAtWorld,
  listInsertAtWorld,
  listReplaceAtWorld,
  hideWorld,
  moveWorld,
  goToWorld,
  normalizeCoordinate,
  playSoundWorld,
  sayWorld,
  setVariableVisibilityWorld,
  setVariableWorld,
  setSpriteSizeWorld,
  setEffectWorld,
  changeEffectWorld,
  clearEffectsWorld,
  penDownWorld,
  penUpWorld,
  setPenColorWorld,
  setPenSizeWorld,
  clearPenWorld,
  drawPenTrail,
  changeSpriteSizeWorld,
  showWorld,
  stopSoundsWorld,
  setVolumeWorld,
  changeVolumeWorld,
  switchBackdropWorld,
  switchCostumeWorld,
  thinkWorld,
  touchingGoal,
  turnWorld,
  pointInDirectionWorld,
  pointTowardsWorld,
  bounceOnEdgeWorld,
  DEFAULT_STAGE_BOUNDS,
  type WorldState,
} from "./world.js";
import { RuntimeExecutionError } from "./errors.js";
import { assertAllowedRuntimeOperation, assertProgramOperationsAllowed } from "./operations.js";

export { RuntimeExecutionError };

export const DEFAULT_EXECUTION_BUDGET = 1_000;
/** Total virtual time one run may wait; past it the run stops like an exhausted step budget. */
export const MAX_VIRTUAL_SECONDS = 60;

export type RunOutcome = "completed" | "budget-exceeded" | "stopped";

export interface ExecutionBoundary {
  readonly path: string;
  readonly stepsUsed: number;
  readonly world: WorldState;
}

export interface ExecutionOptions {
  readonly maxSteps?: number;
  readonly stopAfterSteps?: number;
  readonly shouldStop?: (boundary: ExecutionBoundary) => boolean;
  readonly collectObservations?: boolean;
  readonly randomSeed?: number;
  readonly event?: ProgramEvent;
  /** Keys held for the whole run, for `keyDown`; at most 12. The key that started a script counts too. */
  readonly keysDown?: readonly string[];
  /** Other actors at activation start; never includes the running actor. */
  readonly sensorActors?: readonly {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
  }[];
}

export interface ExecutionTraceEntry {
  readonly step: number;
  readonly nodeId: string;
  readonly path: string;
  readonly statementType: Statement["type"];
  /** Emitted only for playSound, so audio playback follows executed statements exactly. */
  readonly soundId?: string;
  /** Deterministic outcome of an if condition, available for learner-facing evidence. */
  readonly conditionResult?: boolean;
  /** The numbers a custom block call received; present only for calls to blocks that take numbers. */
  readonly args?: readonly number[];
  readonly worldBefore: WorldState;
  readonly worldAfter: WorldState;
  readonly actorId?: string;
  readonly scriptId?: string;
}

export type RuntimeObservationKind = "statement-start" | "statement-end" | "run-complete";

export interface RuntimeObservation {
  readonly kind: RuntimeObservationKind;
  readonly step: number;
  readonly nodeId: string;
  readonly statementType?: Statement["type"];
  readonly outcome?: RunOutcome;
  readonly world: WorldState;
  readonly actorId?: string;
  readonly scriptId?: string;
  /** The program event that activated this run, so traces can explain "why did this run?". */
  readonly event?: ProgramEvent;
}

export interface SanitizedTutorContext {
  readonly outcome: RunOutcome;
  readonly stepsUsed: number;
  readonly finalWorld: WorldState;
  readonly observations: readonly RuntimeObservation[];
}

export interface RunResult {
  readonly outcome: RunOutcome;
  readonly world: WorldState;
  readonly stepsUsed: number;
  readonly trace: readonly ExecutionTraceEntry[];
  readonly observations: readonly RuntimeObservation[];
  /**
   * Ending PRNG state, so callers can continue one deterministic random stream.
   * Always present from `runProgram`; optional for synthetic/derived results.
   */
  readonly randomState?: number;
  /** Present only when the run used `wait`, so other results are unchanged. */
  readonly virtualSeconds?: number;
  /** Present only when a list operation was out of range or full. */
  readonly notes?: readonly string[];
}

class ExecutionHalt {
  readonly outcome: Exclude<RunOutcome, "completed">;

  constructor(outcome: Exclude<RunOutcome, "completed">) {
    this.outcome = outcome;
  }
}

interface MutableRunState {
  world: WorldState;
  stepsUsed: number;
  readonly maxSteps: number;
  readonly options: ExecutionOptions;
  readonly event: ProgramEvent;
  readonly trace: ExecutionTraceEntry[];
  readonly observations: RuntimeObservation[];
  randomState: number;
  /** Virtual seconds waited so far; a clock for ordering, never a timer. */
  virtualSeconds: number;
  /** The script being run, so a call can find its own custom blocks. */
  script?: Script;
  scriptIndex: number;
  callDepth: number;
  /** One entry per active custom-block call that took numbers; the last one is the current call. */
  readonly paramFrames: (readonly number[])[];
  /** Short machine notes (capped), e.g. a list read out of range; surfaced only when non-empty. */
  readonly notes: string[];
}

function normalizeBudget(maxSteps: number | undefined): number {
  const budget = maxSteps ?? DEFAULT_EXECUTION_BUDGET;
  if (!Number.isInteger(budget) || budget < 0) {
    throw new RangeError("maxSteps must be a non-negative integer");
  }
  return budget;
}

function nodeIdFromPath(path: string): string {
  return path
    .replace(/\.statements/g, "/statements")
    .replace(/\.procedures/g, "/procedures")
    .replace(/\.body/g, "/body")
    .replace(/\.then/g, "/then")
    .replace(/\.else/g, "/else");
}

function recordObservation(state: MutableRunState, observation: RuntimeObservation): void {
  if (state.options.collectObservations === true) {
    state.observations.push(observation);
  }
}

function shouldStop(path: string, state: MutableRunState): boolean {
  const boundary = {
    path: nodeIdFromPath(path),
    stepsUsed: state.stepsUsed,
    world: cloneWorldState(state.world),
  };
  if (
    state.options.stopAfterSteps !== undefined &&
    state.stepsUsed >= state.options.stopAfterSteps
  ) {
    return true;
  }
  return state.options.shouldStop?.(boundary) ?? false;
}

function assertStatementBoundary(path: string, state: MutableRunState): void {
  if (shouldStop(path, state)) {
    throw new ExecutionHalt("stopped");
  }
  if (state.stepsUsed >= state.maxSteps) {
    throw new ExecutionHalt("budget-exceeded");
  }
}

type ExpressionValue = boolean | number;

function coerceNumber(value: ExpressionValue): number {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

function coerceBoolean(value: ExpressionValue): boolean {
  return typeof value === "boolean" ? value : value !== 0;
}

function normalizeRuntimeNumber(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new RuntimeExecutionError(path, String(value));
  }
  return value;
}

function normalizeRandomSeed(seed: number | undefined): number {
  if (seed === undefined) {
    return 0x6d2b79f5;
  }
  if (!Number.isFinite(seed)) {
    throw new RangeError("randomSeed must be a finite number");
  }
  return Math.trunc(seed) >>> 0;
}

function advanceVirtualClock(state: MutableRunState, seconds: number): void {
  state.virtualSeconds = Math.round((state.virtualSeconds + seconds) * 1000) / 1000;
  if (state.virtualSeconds > MAX_VIRTUAL_SECONDS) throw new ExecutionHalt("budget-exceeded");
}

function addNote(state: MutableRunState, note: string): void {
  if (state.notes.length < 20) state.notes.push(note);
}

function nextRandomUnit(state: MutableRunState): number {
  state.randomState = (Math.imul(state.randomState, 1664525) + 1013904223) >>> 0;
  return state.randomState / 0x100000000;
}

function evaluateExpression(
  expression: Expression,
  path: string,
  state: MutableRunState,
): ExpressionValue {
  assertAllowedRuntimeOperation("expression", expression.type, path);
  switch (expression.type) {
    case "touchingGoal":
      return touchingGoal(state.world);
    case "touchingActor": {
      if (state.world.sprite.visible === false) return false;
      const target = state.options.sensorActors?.find((actor) => actor.id === expression.actorId);
      return (
        target !== undefined &&
        target.visible &&
        Math.hypot(state.world.sprite.x - target.x, state.world.sprite.y - target.y) <= 24
      );
    }
    case "touchingStageEdge": {
      const { x, y } = state.world.sprite;
      return (
        x <= expression.minX + 12 ||
        x >= expression.maxX - 12 ||
        y <= expression.minY + 12 ||
        y >= expression.maxY - 12
      );
    }
    case "distanceToActor": {
      const target = state.options.sensorActors?.find((actor) => actor.id === expression.actorId);
      return target === undefined
        ? -1
        : normalizeCoordinate(
            Math.hypot(state.world.sprite.x - target.x, state.world.sprite.y - target.y),
          );
    }
    case "xPosition":
      return state.world.sprite.x;
    case "yPosition":
      return state.world.sprite.y;
    case "timer":
      return state.virtualSeconds;
    case "keyDown":
      return (
        state.event === `key:${expression.key}` ||
        state.options.keysDown?.includes(expression.key) === true
      );
    case "booleanLiteral":
      return expression.value;
    case "numericLiteral":
      return expression.value;
    case "variable":
      return getVariableWorld(state.world, expression.variableId);
    case "add":
      return normalizeRuntimeNumber(
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) +
          coerceNumber(evaluateExpression(expression.right, `${path}.right`, state)),
        path,
      );
    case "subtract":
      return normalizeRuntimeNumber(
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) -
          coerceNumber(evaluateExpression(expression.right, `${path}.right`, state)),
        path,
      );
    case "multiply":
      return normalizeRuntimeNumber(
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) *
          coerceNumber(evaluateExpression(expression.right, `${path}.right`, state)),
        path,
      );
    case "divide": {
      const denominator = coerceNumber(
        evaluateExpression(expression.right, `${path}.right`, state),
      );
      if (denominator === 0) {
        throw new RuntimeExecutionError(`${path}.right`, "divide-by-zero");
      }
      return normalizeRuntimeNumber(
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) / denominator,
        path,
      );
    }
    case "modulo": {
      const divisor = coerceNumber(evaluateExpression(expression.right, `${path}.right`, state));
      if (divisor === 0) {
        throw new RuntimeExecutionError(`${path}.right`, "modulo-by-zero");
      }
      const dividend = coerceNumber(evaluateExpression(expression.left, `${path}.left`, state));
      return normalizeRuntimeNumber(((dividend % divisor) + divisor) % divisor, path);
    }
    case "lessThan":
      return (
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) <
        coerceNumber(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "greaterThan":
      return (
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) >
        coerceNumber(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "lessOrEqual":
      return (
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) <=
        coerceNumber(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "greaterOrEqual":
      return (
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) >=
        coerceNumber(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "equals":
      return (
        coerceNumber(evaluateExpression(expression.left, `${path}.left`, state)) ===
        coerceNumber(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "and":
      return (
        coerceBoolean(evaluateExpression(expression.left, `${path}.left`, state)) &&
        coerceBoolean(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "or":
      return (
        coerceBoolean(evaluateExpression(expression.left, `${path}.left`, state)) ||
        coerceBoolean(evaluateExpression(expression.right, `${path}.right`, state))
      );
    case "mathFunction": {
      const operand = coerceNumber(evaluateExpression(expression.value, `${path}.value`, state));
      const result =
        expression.function === "abs"
          ? Math.abs(operand)
          : expression.function === "round"
            ? Math.round(operand)
            : expression.function === "floor"
              ? Math.floor(operand)
              : Math.ceil(operand);
      return normalizeRuntimeNumber(result + 0, path);
    }
    case "not":
      return !coerceBoolean(evaluateExpression(expression.value, `${path}.value`, state));
    case "random": {
      const min = coerceNumber(evaluateExpression(expression.min, `${path}.min`, state));
      const max = coerceNumber(evaluateExpression(expression.max, `${path}.max`, state));
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return normalizeRuntimeNumber(lower + nextRandomUnit(state) * (upper - lower), path);
    }
    case "listLength":
      return getListLengthWorld(state.world, expression.listId);
    case "listItem": {
      const index = coerceNumber(evaluateExpression(expression.index, `${path}.index`, state));
      const item = getListItemWorld(state.world, expression.listId, index);
      if (item === undefined) {
        addNote(state, `list-index-out-of-range:${expression.listId}:${path}`);
        return 0;
      }
      return item;
    }
    case "param":
      return paramValue(state, expression.paramId);
    case "randomInteger": {
      const min = coerceNumber(evaluateExpression(expression.min, `${path}.min`, state));
      const max = coerceNumber(evaluateExpression(expression.max, `${path}.max`, state));
      const lower = Math.round(Math.min(min, max));
      const upper = Math.round(Math.max(min, max));
      return normalizeRuntimeNumber(
        lower + Math.floor(nextRandomUnit(state) * (upper - lower + 1)),
        path,
      );
    }
    default: {
      const unknown = expression as { type?: unknown };
      throw new RuntimeExecutionError(path, String(unknown.type));
    }
  }
}

function evaluateNumber(expression: Expression, path: string, state: MutableRunState): number {
  return coerceNumber(evaluateExpression(expression, path, state));
}

/** Out of range or not a number: use the nearest allowed value, never stop the run. */
function clampToRange(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return Math.min(max, Math.max(min, 0));
  return Math.min(max, Math.max(min, value));
}

/** The value a custom block received for `id` in the current call (0 outside any call). */
function paramValue(state: MutableRunState, id: ProcedureParamId): number {
  const frame = state.paramFrames[state.paramFrames.length - 1];
  return frame?.[Number(id.slice(1)) - 1] ?? 0;
}

function executeStatement(statement: Statement, path: string, state: MutableRunState): void {
  assertStatementBoundary(path, state);
  assertAllowedRuntimeOperation("statement", statement.type, path);
  const nodeId = nodeIdFromPath(path);
  const before = cloneWorldState(state.world);
  let conditionResult: boolean | undefined;
  let callArgs: readonly number[] | undefined;
  recordObservation(state, {
    kind: "statement-start",
    step: state.stepsUsed + 1,
    nodeId,
    statementType: statement.type,
    world: before,
    event: state.event,
  });

  switch (statement.type) {
    case "move":
      state.world = moveWorld(
        state.world,
        statement.stepsFrom === undefined
          ? statement.steps
          : clampToRange(paramValue(state, statement.stepsFrom), MOVE_STEPS_MIN, MOVE_STEPS_MAX),
      );
      break;
    case "goTo":
      state.world = goToWorld(state.world, statement.x, statement.y);
      break;
    case "glideTo":
      state.world = goToWorld(state.world, statement.x, statement.y);
      advanceVirtualClock(state, statement.seconds);
      break;
    case "turn":
      state.world = turnWorld(
        state.world,
        statement.degreesFrom === undefined
          ? statement.degrees
          : clampToRange(
              paramValue(state, statement.degreesFrom),
              TURN_DEGREES_MIN,
              TURN_DEGREES_MAX,
            ),
      );
      break;
    case "pointInDirection":
      state.world = pointInDirectionWorld(state.world, statement.degrees);
      break;
    case "pointTowards": {
      const target = state.options.sensorActors?.find((item) => item.id === statement.actorId);
      if (target === undefined) {
        addNote(state, `pointTowards: no actor ${statement.actorId} on the stage`);
      } else {
        state.world = pointTowardsWorld(state.world, target);
      }
      break;
    }
    case "setEffect":
      state.world = setEffectWorld(state.world, statement.effect, statement.value);
      break;
    case "changeEffect":
      state.world = changeEffectWorld(state.world, statement.effect, statement.delta);
      break;
    case "clearEffects":
      state.world = clearEffectsWorld(state.world);
      break;
    case "penDown":
      state.world = penDownWorld(state.world);
      break;
    case "penUp":
      state.world = penUpWorld(state.world);
      break;
    case "setPenColor":
      state.world = setPenColorWorld(state.world, statement.color);
      break;
    case "setPenSize":
      state.world = setPenSizeWorld(state.world, statement.size);
      break;
    case "clearPen":
      state.world = clearPenWorld(state.world);
      break;
    case "goToLayer":
      // The stage order belongs to the multi-actor run; for one sprite this is only a step.
      break;
    case "bounceOnEdge":
      state.world = bounceOnEdgeWorld(state.world, DEFAULT_STAGE_BOUNDS);
      break;
    case "say":
      state.world = sayWorld(state.world, statement.text);
      break;
    case "think":
      state.world = thinkWorld(state.world, statement.text);
      break;
    case "show":
      state.world = showWorld(state.world);
      break;
    case "hide":
      state.world = hideWorld(state.world);
      break;
    case "setSize":
      state.world = setSpriteSizeWorld(state.world, statement.size);
      break;
    case "changeSize":
      state.world = changeSpriteSizeWorld(state.world, statement.delta);
      break;
    case "listAdd": {
      const value = evaluateNumber(statement.value, `${path}.value`, state);
      const next = listAddWorld(state.world, statement.listId, value);
      if (next === state.world) addNote(state, `list-full:${statement.listId}:${path}`);
      state.world = next;
      break;
    }
    case "listRemoveAt": {
      const index = evaluateNumber(statement.index, `${path}.index`, state);
      const next = listRemoveAtWorld(state.world, statement.listId, index);
      if (next === state.world)
        addNote(state, `list-index-out-of-range:${statement.listId}:${path}`);
      state.world = next;
      break;
    }
    case "listInsertAt":
    case "listReplaceAt": {
      const index = evaluateNumber(statement.index, `${path}.index`, state);
      const value = evaluateNumber(statement.value, `${path}.value`, state);
      const next =
        statement.type === "listInsertAt"
          ? listInsertAtWorld(state.world, statement.listId, index, value)
          : listReplaceAtWorld(state.world, statement.listId, index, value);
      if (next === state.world)
        addNote(
          state,
          `list-${statement.type === "listInsertAt" ? "insert" : "replace"}-unavailable:${statement.listId}:${path}`,
        );
      state.world = next;
      break;
    }
    case "wait":
      advanceVirtualClock(
        state,
        statement.secondsFrom === undefined
          ? statement.seconds
          : clampToRange(
              paramValue(state, statement.secondsFrom),
              WAIT_SECONDS_MIN,
              WAIT_SECONDS_MAX,
            ),
      );
      break;
    case "switchCostume":
      state.world = switchCostumeWorld(state.world, statement.costumeId);
      break;
    case "switchBackdrop":
      state.world = switchBackdropWorld(state.world, statement.backdropId);
      break;
    case "playSound":
      state.world = playSoundWorld(state.world, statement.soundId);
      break;
    case "stopSounds":
      state.world = stopSoundsWorld(state.world);
      break;
    case "setVolume":
      state.world = setVolumeWorld(state.world, statement.volume);
      break;
    case "changeVolume":
      state.world = changeVolumeWorld(state.world, statement.delta);
      break;
    case "broadcast":
      state.world = cloneWorldState(state.world);
      break;
    case "setVariable":
      state.world = setVariableWorld(
        state.world,
        statement.variableId,
        evaluateNumber(statement.value, `${path}.value`, state),
      );
      break;
    case "changeVariable":
      state.world = changeVariableWorld(
        state.world,
        statement.variableId,
        evaluateNumber(statement.delta, `${path}.delta`, state),
      );
      break;
    case "showVariable":
      state.world = setVariableVisibilityWorld(state.world, statement.variableId, true);
      break;
    case "hideVariable":
      state.world = setVariableVisibilityWorld(state.world, statement.variableId, false);
      break;
    case "repeat": {
      if (!Number.isInteger(statement.count)) {
        throw new RuntimeExecutionError(`${path}.count`, String(statement.count));
      }
      const times =
        statement.countFrom === undefined
          ? statement.count
          : Math.round(
              clampToRange(
                paramValue(state, statement.countFrom),
                REPEAT_COUNT_MIN,
                REPEAT_COUNT_MAX,
              ),
            );
      for (let i = 0; i < times; i += 1) {
        executeStatements(statement.body, `${path}.body`, state);
      }
      break;
    }
    case "callProcedure": {
      const procedures = state.script?.procedures ?? [];
      const procedureIndex = procedures.findIndex((item) => item.id === statement.procedureId);
      const procedure = procedures[procedureIndex];
      if (procedure === undefined) {
        throw new RuntimeExecutionError(`${path}.procedureId`, statement.procedureId);
      }
      if (state.callDepth >= PROCEDURE_MAX_CALL_DEPTH) {
        addNote(state, `callProcedure: stopped at depth ${PROCEDURE_MAX_CALL_DEPTH}`);
        throw new ExecutionHalt("budget-exceeded");
      }
      state.callDepth += 1;
      const takesNumbers = (procedure.params?.length ?? 0) > 0;
      if (takesNumbers) {
        // Read before the new frame exists, so a number passed on is the caller's own.
        callArgs = (statement.args ?? []).map((arg) =>
          arg.type === "param" ? paramValue(state, arg.paramId) : arg.value,
        );
        state.paramFrames.push(callArgs);
      }
      try {
        executeStatements(
          procedure.body,
          `scripts[${state.scriptIndex}].procedures[${procedureIndex}].body`,
          state,
        );
      } finally {
        state.callDepth -= 1;
        if (takesNumbers) state.paramFrames.pop();
      }
      break;
    }
    case "repeatUntil": {
      let passes = 0;
      while (!coerceBoolean(evaluateExpression(statement.condition, `${path}.condition`, state))) {
        if (passes >= REPEAT_UNTIL_MAX_PASSES) {
          addNote(state, `repeatUntil: stopped after ${REPEAT_UNTIL_MAX_PASSES} passes`);
          break;
        }
        passes += 1;
        executeStatements(statement.body, `${path}.body`, state);
      }
      break;
    }
    case "if":
      conditionResult = coerceBoolean(
        evaluateExpression(statement.condition, `${path}.condition`, state),
      );
      if (conditionResult) {
        executeStatements(statement.then, `${path}.then`, state);
      } else if (statement.else !== undefined) {
        executeStatements(statement.else, `${path}.else`, state);
      }
      break;
    default: {
      const unknown = statement as { type?: unknown };
      throw new RuntimeExecutionError(path, String(unknown.type));
    }
  }

  if (
    statement.type === "move" ||
    statement.type === "goTo" ||
    statement.type === "glideTo" ||
    statement.type === "bounceOnEdge"
  ) {
    // Only the statement that moved the sprite draws; a loop around it must not draw twice.
    const trail = drawPenTrail(before, state.world);
    state.world = trail.world;
    if (trail.full) addNote(state, "pen: drawing limit reached");
  }

  state.stepsUsed += 1;
  const worldAfter = cloneWorldState(state.world);
  state.trace.push({
    step: state.stepsUsed,
    nodeId,
    path: nodeId,
    statementType: statement.type,
    ...(statement.type === "playSound" ? { soundId: statement.soundId } : {}),
    ...(conditionResult === undefined ? {} : { conditionResult }),
    ...(callArgs === undefined ? {} : { args: callArgs }),
    worldBefore: before,
    worldAfter,
  });
  recordObservation(state, {
    kind: "statement-end",
    step: state.stepsUsed,
    nodeId,
    statementType: statement.type,
    world: worldAfter,
    event: state.event,
  });
}

function seedProgramLists(
  world: WorldState,
  lists: readonly ProgramList[] | undefined,
): WorldState {
  if (lists === undefined || lists.length === 0) return world;
  let next = world;
  for (const list of lists) {
    if (next.lists?.[list.id] === undefined) {
      next = createWorldState({
        ...next,
        lists: { ...next.lists, [list.id]: { items: list.initialItems, visible: list.visible } },
      });
    }
  }
  return next;
}

function seedProgramVariables(
  world: WorldState,
  variables: readonly ProgramVariable[] | undefined,
): WorldState {
  if (variables === undefined || variables.length === 0) {
    return cloneWorldState(world);
  }
  let next = cloneWorldState(world);
  for (const variable of variables) {
    if (next.variables?.[variable.id] === undefined) {
      next = setVariableWorld(next, variable.id, variable.initialValue);
      next = setVariableVisibilityWorld(next, variable.id, variable.visible);
    }
  }
  return next;
}

function executeStatements(
  statements: readonly Statement[],
  path: string,
  state: MutableRunState,
): void {
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (statement !== undefined) {
      executeStatement(statement, `${path}[${i}]`, state);
    }
  }
}

function assertTrigger(trigger: Trigger, path: string): void {
  assertAllowedRuntimeOperation("trigger", trigger.type, path);
  switch (trigger.type) {
    case "greenFlag":
    case "onStart":
    case "onKeyPressed":
    case "onActorClicked":
    case "onMessage":
      return;
    default: {
      const unknown = trigger as { type?: unknown };
      throw new RuntimeExecutionError(path, String(unknown.type));
    }
  }
}

export function runProgram(
  program: ProjectProgram,
  initialWorld: WorldState,
  options: ExecutionOptions = {},
): RunResult {
  const validated = validateProgram(program);
  assertProgramOperationsAllowed(validated);
  const event = options.event ?? "greenFlag";
  const state: MutableRunState = {
    world: seedProgramLists(
      seedProgramVariables(initialWorld, validated.variables),
      validated.lists,
    ),
    stepsUsed: 0,
    maxSteps: normalizeBudget(options.maxSteps),
    options,
    event,
    trace: [],
    observations: [],
    randomState: normalizeRandomSeed(options.randomSeed),
    virtualSeconds: 0,
    scriptIndex: 0,
    callDepth: 0,
    paramFrames: [],
    notes: [],
  };

  try {
    for (let i = 0; i < validated.scripts.length; i += 1) {
      const script = validated.scripts[i];
      if (script === undefined) {
        continue;
      }
      assertTrigger(script.trigger, `scripts[${i}].trigger`);
      if (eventForTrigger(script.trigger) !== event) {
        continue;
      }
      state.script = script;
      state.scriptIndex = i;
      executeStatements(script.statements, `scripts[${i}].statements`, state);
    }
    const world = cloneWorldState(state.world);
    recordObservation(state, {
      kind: "run-complete",
      step: state.stepsUsed,
      nodeId: "$",
      outcome: "completed",
      world,
      event: state.event,
    });
    return {
      outcome: "completed",
      world,
      stepsUsed: state.stepsUsed,
      trace: state.trace,
      observations: state.observations,
      randomState: state.randomState,
      ...(state.virtualSeconds > 0 ? { virtualSeconds: state.virtualSeconds } : {}),
      ...(state.notes.length > 0 ? { notes: state.notes } : {}),
    };
  } catch (error) {
    if (error instanceof ExecutionHalt) {
      const world = cloneWorldState(state.world);
      recordObservation(state, {
        kind: "run-complete",
        step: state.stepsUsed,
        nodeId: "$",
        outcome: error.outcome,
        world,
        event: state.event,
      });
      return {
        outcome: error.outcome,
        world,
        stepsUsed: state.stepsUsed,
        trace: state.trace,
        observations: state.observations,
        randomState: state.randomState,
        ...(state.virtualSeconds > 0 ? { virtualSeconds: state.virtualSeconds } : {}),
        ...(state.notes.length > 0 ? { notes: state.notes } : {}),
      };
    }
    throw error;
  }
}

export function toSanitizedTutorContext(result: RunResult): SanitizedTutorContext {
  return {
    outcome: result.outcome,
    stepsUsed: result.stepsUsed,
    finalWorld: cloneWorldState(result.world),
    observations: result.observations.map((observation) => ({
      ...observation,
      world: cloneWorldState(observation.world),
    })),
  };
}
