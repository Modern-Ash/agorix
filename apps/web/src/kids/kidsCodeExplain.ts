import type { Statement } from "@agorix/program-model";
import type { Locale } from "../i18n.js";

/**
 * "How do you say this in code?": the line of the block in the language the learner is looking at,
 * with what each part means. It is written here from the block's kind, not by a model, so it is
 * always there and always matches the code on screen.
 */
export type ExplainedLanguage = "agorix" | "python" | "typescript" | "java";

export interface CodePart {
  readonly code: string;
  readonly meaning: string;
}

export interface CodeExplanation {
  readonly line: string;
  readonly parts: readonly CodePart[];
}

type Text = { readonly es: string; readonly en: string };
const t = (es: string, en: string): Text => ({ es, en });

interface Doc {
  readonly name: Text;
  readonly args?: readonly Text[];
}

/** What a call to a block does, and what each value in it means. */
const DOC: Partial<Record<Statement["type"], Doc>> = {
  move: {
    name: t("mueve al personaje hacia donde mira", "moves the character where it faces"),
    args: [t("cuántos pasos da (40 es una casilla)", "how many steps (40 is one square)")],
  },
  turn: {
    name: t("gira al personaje", "turns the character"),
    args: [
      t(
        "cuántos grados (90 es un cuarto de vuelta; negativo gira al otro lado)",
        "how many degrees (90 is a quarter turn; negative turns the other way)",
      ),
    ],
  },
  goTo: {
    name: t("lo manda a una posición del escenario", "sends it to a place on the stage"),
    args: [t("x: de lado a lado", "x: left to right"), t("y: arriba y abajo", "y: up and down")],
  },
  glideTo: {
    name: t("lo desliza hasta una posición", "glides it to a place"),
    args: [
      t("x: de lado a lado", "x: left to right"),
      t("y: arriba y abajo", "y: up and down"),
      t("cuántos segundos tarda", "how many seconds it takes"),
    ],
  },
  setX: {
    name: t("fija solo la posición de lado a lado", "sets only the left-right position"),
    args: [t("el valor de x", "the value of x")],
  },
  setY: {
    name: t("fija solo la altura", "sets only the height"),
    args: [t("el valor de y", "the value of y")],
  },
  changeX: {
    name: t("lo corre hacia un lado", "slides it sideways"),
    args: [t("cuánto cambia x", "how much x changes")],
  },
  changeY: {
    name: t("lo sube o lo baja", "moves it up or down"),
    args: [t("cuánto cambia y", "how much y changes")],
  },
  say: {
    name: t("muestra una burbuja de texto", "shows a speech bubble"),
    args: [
      t("lo que dice", "what it says"),
      t("cuántos segundos queda", "how many seconds it stays"),
    ],
  },
  think: {
    name: t("muestra una burbuja de pensamiento", "shows a thought bubble"),
    args: [
      t("lo que piensa", "what it thinks"),
      t("cuántos segundos queda", "how many seconds it stays"),
    ],
  },
  wait: {
    name: t("espera antes de seguir", "waits before going on"),
    args: [t("cuántos segundos espera", "how many seconds it waits")],
  },
  show: { name: t("hace que se vea", "makes it visible") },
  hide: { name: t("lo esconde", "hides it") },
  setSize: {
    name: t("fija su tamaño", "sets its size"),
    args: [t("el tamaño en % (100 es el normal)", "the size in % (100 is normal)")],
  },
  changeSize: {
    name: t("lo agranda o lo achica", "makes it bigger or smaller"),
    args: [t("cuánto cambia el tamaño", "how much the size changes")],
  },
  playSound: {
    name: t("hace sonar un sonido", "plays a sound"),
    args: [t("cuál sonido", "which sound")],
  },
  stopSounds: { name: t("para todos los sonidos", "stops every sound") },
  bounceOnEdge: { name: t("rebota si toca el borde", "bounces if it touches the edge") },
  goToTarget: {
    name: t(
      "va al azar, hacia el ratón o hacia otro personaje",
      "goes to a random place, to the mouse or to another character",
    ),
  },
};

/** The first-level pieces of an argument list: commas inside quotes or brackets do not split. */
function splitArguments(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const char of text) {
    if (quote !== "") {
      current += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim() !== "") out.push(current.trim());
  return out;
}

const LOOPS = {
  repeat: (statement: Extract<Statement, { type: "repeat" }>, locale: Locale): string =>
    locale === "es"
      ? `repite lo de adentro ${statement.count} veces`
      : `repeats what is inside ${statement.count} times`,
  repeatUntil: (_statement: unknown, locale: Locale): string =>
    locale === "es"
      ? "repite lo de adentro hasta que la condición sea verdadera"
      : "repeats what is inside until the condition is true",
  forever: (_statement: unknown, locale: Locale): string =>
    locale === "es" ? "repite lo de adentro sin parar" : "repeats what is inside without stopping",
  if: (_statement: unknown, locale: Locale): string =>
    locale === "es"
      ? "hace lo de adentro solo si la condición es verdadera"
      : "does what is inside only if the condition is true",
};

export function explainCodeLine(
  statement: Statement,
  line: string,
  language: ExplainedLanguage,
  locale: Locale,
): CodeExplanation {
  const text = line.trim();
  // Blocks that hold other blocks: one sentence for the whole line.
  if (statement.type === "repeat")
    return { line: text, parts: [{ code: text, meaning: LOOPS.repeat(statement, locale) }] };
  if (statement.type === "repeatUntil" || statement.type === "forever" || statement.type === "if")
    return {
      line: text,
      parts: [{ code: text, meaning: LOOPS[statement.type](statement, locale) }],
    };
  const doc = DOC[statement.type];
  // Agorix Code reads like a sentence already; the others are calls with values to explain.
  if (language === "agorix" || doc === undefined) return { line: text, parts: [] };
  const call = /^(?:sprite\.)?([A-Za-z_][A-Za-z0-9_]*)\((.*)\)\s*;?$/.exec(text);
  if (!call) return { line: text, parts: [] };
  const parts: CodePart[] = [{ code: `${call[1]}()`, meaning: doc.name[locale] }];
  splitArguments(call[2] ?? "").forEach((arg, index) => {
    const meaning = doc.args?.[index]?.[locale];
    if (meaning !== undefined) parts.push({ code: arg, meaning });
  });
  return { line: text, parts };
}

export const LANGUAGE_NAME: Readonly<Record<ExplainedLanguage, string>> = {
  agorix: "Agorix Code",
  python: "Python",
  typescript: "TypeScript",
  java: "Java",
};
