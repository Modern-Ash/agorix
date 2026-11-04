import { validateSnapshot, validateTrace } from "./contracts.mjs";

/**
 * Converts real Agorix program/v1 and runtime RunResult shapes into Ori's
 * deliberately minimal read-only host contract. No Agorix package dependency.
 * This is a pure boundary adapter; Agorix owns validation and execution.
 */
const SCHEMA = "agorix/program/v1";
export function programToOriSnapshot(program) {
  if (!program || program.schema !== SCHEMA || !Array.isArray(program.scripts)) {
    throw new TypeError("Expected canonical agorix/program/v1");
  }
  // This MVP supports proposals only for canonical move statements.
  // Turn in Agorix uses degrees, not left/right as Ori v0 currently does.
  return validateSnapshot({ allowedBlocks: ["move"] });
}
export function runResultToOriTrace(result) {
  if (!result || !Array.isArray(result.trace) || !["completed","budget-exceeded","stopped"].includes(result.outcome)) {
    throw new TypeError("Expected Agorix RunResult");
  }
  const steps = result.trace.slice(-100).map(entry => {
    if (!Number.isSafeInteger(entry.step) || entry.step < 0 || typeof entry.statementType !== "string") {
      throw new TypeError("Invalid Agorix execution entry");
    }
    // No learner text, world state, identifiers, actor names or paths.
    return { index: entry.step, description: `Bloque ${entry.statementType}` };
  });
  return validateTrace({ steps });
}
export function createCanonicalAgorixHost({ readCanonicalProgram, readRunResult }) {
  if (typeof readCanonicalProgram !== "function") throw new TypeError("Missing readCanonicalProgram");
  return Object.freeze({
    readProgram: async () => programToOriSnapshot(await readCanonicalProgram()),
    ...(typeof readRunResult === "function"
      ? { readTrace: async () => runResultToOriTrace(await readRunResult()) }
      : {})
  });
}
