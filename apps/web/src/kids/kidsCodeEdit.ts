import { parseAgorixCode, projectAgorixCode, type AgorixCodeErrorCode } from "@agorix/agorix-code";
import type { ProjectProgram } from "@agorix/program-model";
import type { Locale } from "../i18n.js";
import { validateStudioProgram } from "./kidsStudioModel.js";

/** A new variable typed by hand gets the next free Studio id (`studio-var-1` to `-3`). */
function newStudioVariableId(taken: ReadonlySet<string>, n: number): string {
  for (let k = Math.max(1, n); k <= 3; k += 1) {
    const id = `studio-var-${k}`;
    if (!taken.has(id)) return id;
  }
  return `studio-var-${n}`;
}

/**
 * Whether this program can be edited as text: reading the text it is shown as gives back exactly
 * this program. When a block the text cannot read is in the program, it stays editable with blocks
 * only, so a text edit can never drop something it did not show.
 */
export function agorixCodeEditable(program: ProjectProgram): boolean {
  try {
    const parsed = parseAgorixCode(projectAgorixCode(program).text, program, {
      newVariableId: newStudioVariableId,
    });
    return parsed.ok && JSON.stringify(parsed.program) === JSON.stringify(program);
  } catch {
    return false;
  }
}

export type CodeEditResult =
  | { readonly ok: true; readonly program: ProjectProgram }
  | { readonly ok: false; readonly code: AgorixCodeErrorCode; readonly line: number };

/** The text the learner typed, read into a program the scene accepts, or the first problem. */
export function applyAgorixCode(text: string, base: ProjectProgram): CodeEditResult {
  const parsed = parseAgorixCode(text, base, { newVariableId: newStudioVariableId });
  if (!parsed.ok) return { ok: false, ...parsed.errors[0]! };
  try {
    return { ok: true, program: validateStudioProgram(parsed.program) };
  } catch {
    return { ok: false, code: "notValid", line: 1 };
  }
}

const MESSAGES: Readonly<Record<AgorixCodeErrorCode, readonly [string, string]>> = {
  emptyText: ["No hay nada escrito.", "Nothing is written."],
  unknownLine: ["No entiendo esta línea todavía.", "I do not understand this line yet."],
  badIndent: [
    "La sangría debe ser de dos espacios por nivel.",
    "Indentation must be two spaces a level.",
  ],
  badNumber: ["Acá va un número.", "A number goes here."],
  badText: ["Acá va un texto entre comillas.", "A text in quotes goes here."],
  unknownName: ["Ese nombre no está declarado arriba.", "That name is not declared above."],
  elseWithoutIf: ["«else» va justo después de un «if».", "“else” goes right after an “if”."],
  emptyBody: ["Esta línea necesita bloques adentro.", "This line needs blocks inside it."],
  tooDeep: ["Hay demasiados niveles de bloques.", "There are too many levels of blocks."],
  tooLong: ["El texto es demasiado largo.", "The text is too long."],
  notValid: ["Ese programa no entra en la escena.", "That program does not fit in the scene."],
};

export function codeEditMessage(code: AgorixCodeErrorCode, line: number, locale: Locale): string {
  const [es, en] = MESSAGES[code]!;
  return `${locale === "es" ? "Línea" : "Line"} ${line}: ${locale === "es" ? es : en}`;
}
