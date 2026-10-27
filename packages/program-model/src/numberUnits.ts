import type { Procedure, ProcedureParamId } from "./schema.js";

/** The kind of value a custom block's number carries, inferred from the first block that uses it. */
export type ProcedureNumberUnit = "steps" | "degrees" | "seconds" | "count" | "number";

/** Closed values a call may pass for each unit; the pickers and the host allow-list share them. */
export const PROCEDURE_NUMBER_CHOICES: Readonly<Record<ProcedureNumberUnit, readonly number[]>> =
  Object.freeze({
    steps: Object.freeze([-200, -100, -60, -40, -20, 20, 40, 60, 100, 200]),
    degrees: Object.freeze([-180, -90, -45, 45, 90, 180]),
    seconds: Object.freeze([0.5, 1, 2, 3]),
    count: Object.freeze([2, 3, 5]),
    number: Object.freeze([-50, -10, -5, -1, 0, 1, 5, 10, 50]),
  });

/** The value a new picker starts with, per unit. */
export const PROCEDURE_NUMBER_DEFAULTS: Readonly<Record<ProcedureNumberUnit, number>> =
  Object.freeze({
    steps: 40,
    degrees: 90,
    seconds: 1,
    count: 2,
    number: 1,
  });

const PARAM_IDS: readonly ProcedureParamId[] = ["p1", "p2", "p3"];

const SLOT_UNIT: Readonly<Record<string, ProcedureNumberUnit>> = {
  stepsFrom: "steps",
  degreesFrom: "degrees",
  secondsFrom: "seconds",
  countFrom: "count",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rebuild a tree of statements, letting `visit` replace any object (return undefined to recurse). */
function deepMap(
  node: unknown,
  visit: (item: Record<string, unknown>) => unknown | undefined,
): unknown {
  if (Array.isArray(node)) return node.map((item) => deepMap(item, visit));
  if (!isRecord(node)) return node;
  const replaced = visit(node);
  if (replaced !== undefined) return replaced;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, deepMap(value, visit)]),
  );
}

/**
 * The unit of each of a custom block's numbers, from the first block in it that uses the number, or
 * the number of another block it is handed on to (`all` are the character's blocks).
 */
export function procedureNumberUnits(
  procedure: Procedure,
  all: readonly Procedure[] = [],
  depth = 0,
): ProcedureNumberUnit[] {
  const units: (ProcedureNumberUnit | undefined)[] = (procedure.params ?? []).map(() => undefined);
  const claim = (id: unknown, unit: ProcedureNumberUnit) => {
    const at = PARAM_IDS.indexOf(id as ProcedureParamId);
    if (at >= 0 && at < units.length && units[at] === undefined) units[at] = unit;
  };
  deepMap(procedure.body, (item) => {
    if (item.type === "param") claim(item.paramId, "number");
    if (item.type === "callProcedure" && Array.isArray(item.args) && depth < 4) {
      const callee = all.find((entry) => entry.id === item.procedureId);
      const inner = callee ? procedureNumberUnits(callee, all, depth + 1) : [];
      item.args.forEach((arg, index) => {
        if (isRecord(arg) && arg.type === "param") claim(arg.paramId, inner[index] ?? "number");
      });
    }
    for (const [key, value] of Object.entries(item)) {
      const unit = SLOT_UNIT[key];
      if (unit) claim(value, unit);
    }
    return undefined;
  });
  return units.map((unit) => unit ?? "number");
}
