/**
 * Deterministic step-by-step interpreter for `agorix/program/v1` programs.
 *
 * Produces one `StepObservation` per executed statement, addressed by the
 * same path-derived node id scheme as `@agorix/code-generator`
 * (`scripts[i]/statements[j]`, nested via `body`/`then`), so the UI can
 * highlight the same code range the runtime is currently executing.
 *
 * The runtime is the sole source of truth for "did the learner reach the
 * goal" and for any fact a debugger/tutor may cite — an AI proposal or
 * message must never assert program state this module did not produce.
 */
import type { Expression, ProjectProgram, Script, Statement } from "@agorix/program-model";

export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface WorldConfig {
  readonly start: Position;
  readonly startHeading: number;
  readonly goal: Position;
  readonly goalRadius: number;
}

export interface StepObservation {
  readonly nodeId: string;
  readonly statementType: Statement["type"];
  readonly position: Position;
  readonly heading: number;
  readonly touchingGoal: boolean;
  readonly stepIndex: number;
}

export interface RunResult {
  readonly observations: readonly StepObservation[];
  readonly reachedGoal: boolean;
  readonly finalPosition: Position;
  readonly finalHeading: number;
}

export class RuntimeStepLimitError extends Error {
  constructor(limit: number) {
    super(`Program exceeded the deterministic step limit of ${limit}`);
    this.name = "RuntimeStepLimitError";
  }
}

const DEFAULT_MAX_STEPS = 5_000;

interface MutableState {
  x: number;
  y: number;
  heading: number;
}

function touchingGoal(state: MutableState, world: WorldConfig): boolean {
  const dx = state.x - world.goal.x;
  const dy = state.y - world.goal.y;
  return Math.sqrt(dx * dx + dy * dy) <= world.goalRadius;
}

function evaluateExpression(expression: Expression, state: MutableState, world: WorldConfig): boolean {
  switch (expression.type) {
    case "touchingGoal":
      return touchingGoal(state, world);
    case "booleanLiteral":
      return expression.value;
    case "numericLiteral":
      return expression.value !== 0;
    default: {
      const unknown = expression as { type?: unknown };
      throw new Error(`Unsupported expression type ${String(unknown.type)}`);
    }
  }
}

interface ExecutionContext {
  readonly state: MutableState;
  readonly world: WorldConfig;
  readonly observations: StepObservation[];
  readonly maxSteps: number;
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function recordObservation(context: ExecutionContext, nodeId: string, statementType: Statement["type"]): void {
  if (context.observations.length >= context.maxSteps) {
    throw new RuntimeStepLimitError(context.maxSteps);
  }
  context.observations.push({
    nodeId,
    statementType,
    position: { x: context.state.x, y: context.state.y },
    heading: context.state.heading,
    touchingGoal: touchingGoal(context.state, context.world),
    stepIndex: context.observations.length,
  });
}

function executeStatements(
  statements: readonly Statement[],
  path: string,
  segment: "statements" | "body" | "then",
  context: ExecutionContext,
): void {
  for (let i = 0; i < statements.length; i += 1) {
    const statement = statements[i];
    if (statement === undefined) {
      continue;
    }
    const nodeId = `${path}/${segment}[${i}]`;
    executeStatement(statement, nodeId, context);
  }
}

function executeStatement(statement: Statement, nodeId: string, context: ExecutionContext): void {
  switch (statement.type) {
    case "move": {
      const angle = radians(context.state.heading);
      context.state.x += Math.cos(angle) * statement.steps;
      context.state.y += Math.sin(angle) * statement.steps;
      recordObservation(context, nodeId, statement.type);
      return;
    }
    case "turn": {
      context.state.heading = (context.state.heading + statement.degrees) % 360;
      recordObservation(context, nodeId, statement.type);
      return;
    }
    case "repeat": {
      for (let i = 0; i < statement.count; i += 1) {
        executeStatements(statement.body, nodeId, "body", context);
      }
      return;
    }
    case "if": {
      const conditionMet = evaluateExpression(statement.condition, context.state, context.world);
      if (conditionMet) {
        executeStatements(statement.then, nodeId, "then", context);
      }
      return;
    }
    default: {
      const unknown = statement as { type?: unknown };
      throw new Error(`Unsupported statement type ${String(unknown.type)} at ${nodeId}`);
    }
  }
}

/**
 * Executes the first `onStart` script deterministically to completion and
 * returns every intermediate observation plus the final outcome. Pure aside
 * from the step-limit guard: same program + world always yields identical
 * output.
 */
export function runProgram(
  program: ProjectProgram,
  world: WorldConfig,
  options?: { readonly maxSteps?: number },
): RunResult {
  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS;
  const state: MutableState = { x: world.start.x, y: world.start.y, heading: world.startHeading };
  const context: ExecutionContext = { state, world, observations: [], maxSteps };

  const onStartScript: Script | undefined = program.scripts.find((script) => script.trigger.type === "onStart");
  if (onStartScript !== undefined) {
    const scriptIndex = program.scripts.indexOf(onStartScript);
    executeStatements(onStartScript.statements, `scripts[${scriptIndex}]`, "statements", context);
  }

  return {
    observations: context.observations,
    reachedGoal: touchingGoal(state, world),
    finalPosition: { x: state.x, y: state.y },
    finalHeading: state.heading,
  };
}

/**
 * Deterministic debugger fact sheet: cites only values `runProgram` actually
 * produced. Never invokes an AI provider and never asserts state beyond the
 * last observation.
 */
export function describeRunResult(result: RunResult, world: WorldConfig): string {
  if (result.reachedGoal) {
    return `Reached the goal at (${result.finalPosition.x.toFixed(1)}, ${result.finalPosition.y.toFixed(1)}) after ${result.observations.length} step(s).`;
  }
  const last = result.observations[result.observations.length - 1];
  if (last === undefined) {
    return `The program ran no statements. Sprite remained at start position (${world.start.x}, ${world.start.y}).`;
  }
  const dx = world.goal.x - last.position.x;
  const dy = world.goal.y - last.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return `After ${result.observations.length} step(s), last action was "${last.statementType}" at ${last.nodeId}. ` +
    `Sprite is at (${last.position.x.toFixed(1)}, ${last.position.y.toFixed(1)}), heading ${last.heading}°, ` +
    `${distance.toFixed(1)} units from the goal.`;
}
