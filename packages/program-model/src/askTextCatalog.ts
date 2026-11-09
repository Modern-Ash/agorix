/**
 * Bundled questions whose answer the child types. Projects store the id; the question text is
 * ours, and the answer is a short word that stays on the device, in a text variable.
 */
export const ASK_TEXT_CATALOG = {
  name: { prompt: { es: "¿Cómo te llamás?", en: "What is your name?" } },
  word: { prompt: { es: "Escribí una palabra", en: "Type a word" } },
  animal: { prompt: { es: "¿Cuál es tu animal favorito?", en: "What is your favorite animal?" } },
  color: { prompt: { es: "¿Cuál es tu color favorito?", en: "What is your favorite color?" } },
} as const;

export type AskTextPromptId = keyof typeof ASK_TEXT_CATALOG;
export const ASK_TEXT_PROMPT_IDS = Object.freeze(
  Object.keys(ASK_TEXT_CATALOG) as AskTextPromptId[],
);

export function isAskTextPromptId(value: unknown): value is AskTextPromptId {
  return typeof value === "string" && Object.hasOwn(ASK_TEXT_CATALOG, value);
}
