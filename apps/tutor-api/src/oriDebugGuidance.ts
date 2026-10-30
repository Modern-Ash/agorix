/** Only these fixed, trace-count-bound questions may reach Kids from Ori debug. */
export interface OriDebugGuidance {
  readonly schema: "agorix/ori-debug-guidance/v1";
  readonly nextStep: string;
  readonly question: string;
  readonly appliedChanges: false;
}

export function parseOriDebugPlan(raw: unknown, observedSteps: number): OriDebugGuidance | null {
  if (!Number.isSafeInteger(observedSteps) || observedSteps < 1 || observedSteps > 100) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const plan = raw as Record<string, unknown>;
  if (
    Object.keys(plan).sort().join() !== "schemaVersion,steps" ||
    plan["schemaVersion"] !== "ori/plan/v1" ||
    !Array.isArray(plan["steps"]) ||
    plan["steps"].length !== 3
  )
    return null;
  const goals = [
    `Revisar el paso ${observedSteps} de la traza verificada por el host`,
    "Preguntarse si ese paso produjo lo que esperabas",
    "Formular una hipótesis y probar un cambio pequeño",
  ];
  if (
    !plan["steps"].every((value: unknown, index: number) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const step = value as Record<string, unknown>;
      return (
        Object.keys(step).sort().join() === "goal,id" &&
        step["id"] === `step-${index + 1}` &&
        step["goal"] === goals[index]
      );
    })
  )
    return null;
  return Object.freeze({
    schema: "agorix/ori-debug-guidance/v1",
    nextStep: goals[0]!,
    question: goals[1]!,
    appliedChanges: false,
  });
}

export function validOriDebugGuidance(
  raw: unknown,
  observedSteps?: number,
): raw is OriDebugGuidance {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const value = raw as Record<string, unknown>;
  return (
    Object.keys(value).sort().join() === "appliedChanges,nextStep,question,schema" &&
    value["schema"] === "agorix/ori-debug-guidance/v1" &&
    typeof value["nextStep"] === "string" &&
    (observedSteps === undefined
      ? /^Revisar el paso (?:[1-9]|[1-9][0-9]|100) de la traza verificada por el host$/.test(
          value["nextStep"],
        )
      : Number.isSafeInteger(observedSteps) &&
        observedSteps >= 1 &&
        observedSteps <= 100 &&
        value["nextStep"] ===
          `Revisar el paso ${observedSteps} de la traza verificada por el host`) &&
    value["question"] === "Preguntarse si ese paso produjo lo que esperabas" &&
    value["appliedChanges"] === false
  );
}
