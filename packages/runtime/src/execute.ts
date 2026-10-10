import type {
  Expression,
  ProgramVariable,
  ProgramEvent,
  ProjectProgram,
  Statement,
  Trigger,
} from "@agorix/program-model";
import { eventForTrigger, validateProgram } from "@agorix/program-model";
import {
  cloneWorldState,
  changeVariableWorld,
  getVariableWorld,
  hideWorld,
  moveWorld,
  playSoundWorld,
  sayWorld,
  setVariableVisibilityWorld,
  setVariableWorld,
  setSpriteSizeWorld,
  showWorld,
  stopSoundsWorld,
  switchBackdropWorld,
  switchCostumeWorld,
  thinkWorld,
  touchingGoal,
  turnWorld,
  type WorldState,
} from "./world.js";
import { RuntimeExecutionError } from "./errors.js";
import { assertAllowedRuntimeOperation, assertProgramOperationsAllowed } from "./operations.js";

export { RuntimeExecutionError };

export const DEFAULT_EXECUTION_BUDGET = 1_000;

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
}

export interface ExecutionTraceEntry {
  readonly step: number;
  readonly nodeId: string;
  readonly path: string;
  readonly statementType: Statement["type"];
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
    .replace(/\.body/g, "/body")
    .replace(/\.then/g, "/then");
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
    case "not":
      return !coerceBoolean(evaluateExpression(expression.value, `${path}.value`, state));
    case "random": {
      const min = coerceNumber(evaluateExpression(expression.min, `${path}.min`, state));
      const max = coerceNumber(evaluateExpression(expression.max, `${path}.max`, state));
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return normalizeRuntimeNumber(lower + nextRandomUnit(state) * (upper - lower), path);
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

function executeStatement(statement: Statement, path: string, state: MutableRunState): void {
  assertStatementBoundary(path, state);
  assertAllowedRuntimeOperation("statement", statement.type, path);
  const nodeId = nodeIdFromPath(path);
  const before = cloneWorldState(state.world);
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
      state.world = moveWorld(state.world, statement.steps);
      break;
    case "turn":
      state.world = turnWorld(state.world, statement.degrees);
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
      for (let i = 0; i < statement.count; i += 1) {
        executeStatements(statement.body, `${path}.body`, state);
      }
      break;
    }
    case "if":
      if (coerceBoolean(evaluateExpression(statement.condition, `${path}.condition`, state))) {
        executeStatements(statement.then, `${path}.then`, state);
      }
      break;
    default: {
      const unknown = statement as { type?: unknown };
      throw new RuntimeExecutionError(path, String(unknown.type));
    }
  }

  state.stepsUsed += 1;
  const worldAfter = cloneWorldState(state.world);
  state.trace.push({
    step: state.stepsUsed,
    nodeId,
    path: nodeId,
    statementType: statement.type,
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
    world: seedProgramVariables(initialWorld, validated.variables),
    stepsUsed: 0,
    maxSteps: normalizeBudget(options.maxSteps),
    options,
    event,
    trace: [],
    observations: [],
    randomState: normalizeRandomSeed(options.randomSeed),
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
