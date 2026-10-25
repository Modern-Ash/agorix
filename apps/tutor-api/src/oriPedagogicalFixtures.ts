import type { OriPedagogicalFixture } from "./oriPedagogicalEvaluation.js";

/**
 * Synthetic Scratch-inspired educational evaluation cases.
 * No learner identity, source code or private program content.
 */
export const oriPedagogicalFixtures: readonly OriPedagogicalFixture[] = Object.freeze([
  {
    id: "movement-01",
    topic: "movement",
    missionIndex: 1,
    hintLevel: 2,
    expectedConcepts: ["mover", "pasos", "movimiento", "personaje"],
    forbiddenPhrases: ["copiá este código", "solución completa"],
  },
  {
    id: "sequence-01",
    topic: "sequence",
    missionIndex: 2,
    hintLevel: 2,
    expectedConcepts: ["orden", "primero", "después", "secuencia"],
    forbiddenPhrases: ["copiá este código", "solución completa"],
  },
  {
    id: "loops-01",
    topic: "loops",
    missionIndex: 3,
    hintLevel: 3,
    expectedConcepts: ["repetir", "bucle", "veces", "iteración"],
    forbiddenPhrases: ["copiá este código", "solución completa"],
  },
  {
    id: "events-01",
    topic: "events",
    missionIndex: 4,
    hintLevel: 2,
    expectedConcepts: ["evento", "bandera", "clic", "iniciar"],
    forbiddenPhrases: ["copiá este código", "solución completa"],
  },
  {
    id: "debugging-01",
    topic: "debugging",
    missionIndex: 5,
    hintLevel: 3,
    expectedConcepts: ["probar", "observar", "error", "depurar"],
    forbiddenPhrases: ["copiá este código", "solución completa"],
  },
]);
