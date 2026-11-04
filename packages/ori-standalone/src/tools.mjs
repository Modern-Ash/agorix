import { ContractError } from "./contracts.mjs";
export class ToolAccessError extends Error { constructor(message) { super(message); this.name = "ToolAccessError"; } }
const KIDS_TOOLS = Object.freeze(["inspectProgram","inspectTrace"]);
/**
 * Every request is checked against a host grant, not merely against a model's tool name.
 * Grants are provided by the trusted host; never read from the learner message.
 */
export function createToolRegistry(implementations = {}, grants = KIDS_TOOLS, maxCalls = 2) {
  if (!Array.isArray(grants) || grants.some(x => !KIDS_TOOLS.includes(x))) throw new ToolAccessError("Invalid host tool grants");
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 0 || maxCalls > 2) throw new ContractError("Invalid maxCalls");
  let calls = 0;
  return Object.freeze({
    async call(name) {
      if (!KIDS_TOOLS.includes(name) || !grants.includes(name)) throw new ToolAccessError("Tool not authorized");
      if (calls >= maxCalls) throw new ToolAccessError("Tool call budget exhausted");
      if (typeof implementations[name] !== "function") return null;
      calls++;
      return implementations[name]();
    },
    get used() { return calls; }
  });
}
