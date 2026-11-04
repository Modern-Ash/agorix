/**
 * Reference Agorix-like host for contract tests, not a real Agorix integration.
 * Provides bounded canonical block and execution-trace snapshots only.
 */
import { validateSnapshot, validateTrace } from "./contracts.mjs";
export function createAgorixFixture({ allowedBlocks = ["move", "turn"], traceSteps = [] } = {}) {
  const snapshot = validateSnapshot({ allowedBlocks });
  const trace = validateTrace({ steps: traceSteps });
  return Object.freeze({
    readProgram: async () => ({ allowedBlocks: [...snapshot.allowedBlocks] }),
    readTrace: async () => ({ steps: trace.steps.map(s => ({ ...s })) })
  });
}
