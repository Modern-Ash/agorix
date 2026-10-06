import type {
  Expression,
  ProgramEvent,
  ProjectProgram,
  Statement,
  Trigger,
} from "@agorix/program-model";
import { eventForTrigger, validateProgram } from "@agorix/program-model";
import {
  cloneWorldState,
  moveWorld,
  setWorldX,
  setWorldY,
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
  /** The event to dispatch; scripts whose trigger answers to it run, in order. Default: green flag. */
  readonly event?: ProgramEvent;
}

export interface ExecutionTraceEntry {
  readonly step: number;
  readonly nodeId: string;
  readonly path: string;
  readonly statementType: Statement["type"];
  readonly worldBefore: WorldState;
  readonly worldAfter: WorldState;
}

export type RuntimeObservationKind = "statement-start" | "statement-end" | "run-complete";

export interface RuntimeObservation {
  readonly kind: RuntimeObservationKind;
  readonly step: number;
  readonly nodeId: string;
  readonly statementType?: Statement["type"];
  readonly outcome?: RunOutcome;
  readonly world: WorldState;
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
  readonly trace: ExecutionTraceEntry[];
  readonly observations: RuntimeObservation[];
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

function evaluateExpression(expression: Expression, path: string, world: WorldState): boolean {
  assertAllowedRuntimeOperation("expression", expression.type, path);
  switch (expression.type) {
    case "touchingGoal":
      return touchingGoal(world);
    case "booleanLiteral":
      return expression.value;
    case "numericLiteral":
      return expression.value !== 0;
    default: {
      const unknown = expression as { type?: unknown };
      throw new RuntimeExecutionError(path, String(unknown.type));
    }
  }
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
  });

  switch (statement.type) {
    case "move":
      state.world = moveWorld(state.world, statement.steps);
      break;
    case "turn":
      state.world = turnWorld(state.world, statement.degrees);
      break;
    case "setX":
      state.world = setWorldX(state.world, statement.x);
      break;
    case "setY":
      state.world = setWorldY(state.world, statement.y);
      break;
    case "wait":
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
      if (evaluateExpression(statement.condition, `${path}.condition`, state.world)) {
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
  });
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
    case "onStart":
    case "greenFlag":
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
    world: cloneWorldState(initialWorld),
    stepsUsed: 0,
    maxSteps: normalizeBudget(options.maxSteps),
    options,
    trace: [],
    observations: [],
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
