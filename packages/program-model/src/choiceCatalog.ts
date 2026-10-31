/** Bundled, closed content. Projects store ids; children cannot author prompt or answer text. */
export const CHOICE_CATALOG = {
  path: {
    prompt: { es: "¿Qué camino elegís?", en: "Which path do you choose?" },
    options: [
      { kind: "text", es: "Izquierda", en: "Left" },
      { kind: "text", es: "Derecha", en: "Right" },
    ],
  },
  shape: {
    prompt: { es: "¿Qué figura elegís?", en: "Which shape do you choose?" },
    options: [
      { kind: "picture", es: "🔵 Círculo", en: "🔵 Circle" },
      { kind: "picture", es: "🟩 Cuadrado", en: "🟩 Square" },
      { kind: "picture", es: "🔺 Triángulo", en: "🔺 Triangle" },
    ],
  },
  count: {
    prompt: { es: "¿Cuántos pasos?", en: "How many steps?" },
    options: [
      { kind: "number", es: "1", en: "1" },
      { kind: "number", es: "2", en: "2" },
      { kind: "number", es: "3", en: "3" },
      { kind: "number", es: "4", en: "4" },
    ],
  },
} as const;

export type ChoicePromptId = keyof typeof CHOICE_CATALOG;
export const CHOICE_PROMPT_IDS = Object.freeze(Object.keys(CHOICE_CATALOG) as ChoicePromptId[]);

export function isChoicePromptId(value: unknown): value is ChoicePromptId {
  return typeof value === "string" && Object.hasOwn(CHOICE_CATALOG, value);
}
