import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const names = ["context", "plan", "tool-call", "proposal", "trace-evidence", "refusal", "error"];
export const v1Schemas = Object.freeze(Object.fromEntries(names.map(name => [
  name, Object.freeze(JSON.parse(readFileSync(join(root, "schemas", name + "-v1.schema.json"), "utf8")))
])));

export class V1ContractError extends Error {
  constructor(message) { super(message); this.name = "V1ContractError"; }
}
function assert(value, schema, path) {
  if (schema.const !== undefined && value !== schema.const) throw new V1ContractError(path + ": invalid constant");
  if (schema.enum && !schema.enum.includes(value)) throw new V1ContractError(path + ": invalid enum");
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new V1ContractError(path + ": expected object");
    for (const field of schema.required ?? []) if (!Object.hasOwn(value, field)) throw new V1ContractError(path + ": missing " + field);
    if (schema.additionalProperties === false) for (const field of Object.keys(value)) if (!Object.hasOwn(schema.properties ?? {}, field)) throw new V1ContractError(path + ": unknown " + field);
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) throw new V1ContractError(path + ": too many properties");
    for (const [field, sub] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, field)) assert(value[field], sub, path + "." + field);
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new V1ContractError(path + ": expected array");
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new V1ContractError(path + ": too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new V1ContractError(path + ": too many items");
    if (schema.uniqueItems && new Set(value.map(x => JSON.stringify(x))).size !== value.length) throw new V1ContractError(path + ": duplicates");
    for (const [index, item] of value.entries()) assert(item, schema.items, path + "[" + index + "]");
  }
  if (schema.type === "string") {
    if (typeof value !== "string") throw new V1ContractError(path + ": expected string");
    if (schema.minLength !== undefined && [...value].length < schema.minLength) throw new V1ContractError(path + ": too short");
    if (schema.maxLength !== undefined && [...value].length > schema.maxLength) throw new V1ContractError(path + ": too long");
  }
  if (schema.type === "integer" && (!Number.isSafeInteger(value) || (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) throw new V1ContractError(path + ": invalid integer");
  if (schema.type === "boolean" && typeof value !== "boolean") throw new V1ContractError(path + ": expected boolean");
}
export function validateV1Envelope(kind, value) {
  if (!Object.hasOwn(v1Schemas, kind)) throw new V1ContractError("Unknown envelope kind");
  assert(value, v1Schemas[kind], kind);
  return structuredClone(value);
}
