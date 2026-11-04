import { validateV1Envelope, V1ContractError } from "./contracts-v1.mjs";

const GOALS = Object.freeze({
  help: ["Aclarar el objetivo", "Elegir un experimento pequeño", "Predecir y observar"],
  repeat: ["Identificar la acción repetida", "Predecir cuántas repeticiones hacen falta", "Probar una repetición"],
  turn: ["Observar la orientación", "Predecir el giro", "Comparar el resultado"],
  move: ["Estimar la distancia", "Predecir un movimiento", "Observar el resultado"],
  debug: ["Reproducir el problema", "Examinar evidencia del host", "Formular una hipótesis"],
  unknown: ["Aclarar la intención", "Elegir una acción pequeña"]
});
const INTENTS = new Set(Object.keys(GOALS));

/**
 * Deterministic, host-neutral pedagogical plan. No tools are executed.
 * Model-provided plans must be independently validated before future use.
 */
export function createEducationalPlan(context, { intent = "unknown" } = {}) {
  const checked = validateV1Envelope("context", context);
  if (!INTENTS.has(intent)) throw new V1ContractError("Unknown pedagogical intent");
  const attempts = checked.attempts ?? 0;
  const hintsUsed = checked.hintsUsed ?? 0;
  const base = [...GOALS[intent]];
  if (attempts === 0 && intent === "debug") base[0] = "Realizar una primera ejecución supervisada";
  if (hintsUsed >= 2 && attempts > 0) base.push("Revisar una propuesta pequeña con aprobación del aprendiz");
  const steps = base.map((goal, index) => ({ id: "step-" + (index + 1), goal }));
  return deepFreeze(validateV1Envelope("plan", { schemaVersion: "ori/plan/v1", steps }));
}
function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
