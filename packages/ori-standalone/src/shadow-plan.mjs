import { validateShadowMetadata } from "./shadow-metadata.mjs";

/**
 * Metadata-only educational planning experiment. No child text, no project AST,
 * no model provider, and no claims about program behavior.
 */
const STAGES = Object.freeze([
  Object.freeze(["Pensar qué queremos lograr", "Elegir una acción pequeña", "Probar y observar"]),
  Object.freeze(["Predecir el resultado", "Revisar un paso", "Comparar con lo esperado"]),
  Object.freeze(["Identificar el problema", "Cambiar una instrucción", "Ejecutar otra vez"]),
  Object.freeze(["Explicar el cambio", "Probar otra alternativa", "Comparar resultados"]),
  Object.freeze(["Justificar la solución", "Explorar una variante", "Reflexionar sobre lo aprendido"])
]);
export function planShadowMetadata(raw) {
  const { missionIndex, hintLevel, scriptCount } = validateShadowMetadata(raw);
  const steps = STAGES[hintLevel - 1];
  return Object.freeze({
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: hintLevel,
    steps,
    hint: scriptCount === 0
      ? "¿Qué acción pequeña querés probar primero?"
      : "¿Qué esperás que pase si ejecutás tu programa?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    // Only used to choose a generic activity; no inferred runtime success.
    context: Object.freeze({ missionStage: missionIndex })
  });
}
