import { createOriHarness } from "./harness.mjs";
import { validateSnapshot, validateTrace } from "./contracts.mjs";

/**
 * Minimal Agorix adapter contract.
 * Host methods are injected and must be trusted server-side; no HTTP or browser access.
 * This is a synthetic integration seam, not a deployed Agorix connection.
 */
export function createAgorixAdapter(host, options = {}) {
  if (!host || typeof host !== "object" || typeof host.readProgram !== "function") {
    throw new TypeError("Agorix host must implement readProgram");
  }
  const grants = options.grants ?? ["inspectProgram", "inspectTrace"];
  const ori = createOriHarness({
    inspectProgram: async () => validateSnapshot(await host.readProgram()),
    inspectTrace: typeof host.readTrace === "function"
      ? async () => validateTrace(await host.readTrace())
      : undefined
  }, { grants });
  return Object.freeze({
    async ask(message, { attempts = 0, hintsUsed = 0, allowProposal = false } = {}) {
      return ori.respond({ message, context: { attempts, hintsUsed }, allowProposal });
    }
  });
}
