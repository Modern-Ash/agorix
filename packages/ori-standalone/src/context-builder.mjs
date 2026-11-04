import { validateV1Envelope, V1ContractError } from "./contracts-v1.mjs";

const MAX_INPUT_BYTES = 8192;
const TOOL_NAMES = new Set(["inspectProgram", "inspectTrace"]);
const BLOCKED_KEYS = new Set(["message", "messages", "prompt", "email", "name", "age", "childId", "identity", "token", "password", "program", "trace", "project", "personalData"]);

export function buildEducationalContext(hostInput) {
  if (!hostInput || typeof hostInput !== "object" || Array.isArray(hostInput)) throw new V1ContractError("Invalid host context");
  const keys = Object.keys(hostInput);
  if (keys.some(key => BLOCKED_KEYS.has(key) || !["sessionId", "learningStage", "capabilities", "grants", "attempts", "hintsUsed"].includes(key))) throw new V1ContractError("Unexpected or sensitive context field");
  if (Buffer.byteLength(JSON.stringify(hostInput), "utf8") > MAX_INPUT_BYTES) throw new V1ContractError("Context budget exceeded");
  const context = validateV1Envelope("context", {schemaVersion:"ori/context/v1",...hostInput});
  if (context.grants.some(grant => !TOOL_NAMES.has(grant) || !context.capabilities.includes(grant))) throw new V1ContractError("Unauthorized tool grant");
  return deepFreeze(context);
}
function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
