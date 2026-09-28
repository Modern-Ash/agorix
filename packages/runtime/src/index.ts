/** Executes program-model deterministically and produces events/observations. */
export const PACKAGE_NAME = "@agorix/runtime";

export type { Position, RunResult, StepObservation, WorldConfig } from "./run.js";
export { RuntimeStepLimitError, describeRunResult, runProgram } from "./run.js";
