import type { OriStudioIntent } from "@agorix/ori-agent";
import type { Locale } from "../i18n.js";

/**
 * What a Scratch import could not bring, said the way Ori says things: one plain sentence a child
 * can read, from a closed list, and where the scene has a close block, an idea Ori can offer for it
 * through the same preview, use, change or reject path as any other idea. Nothing here reads the
 * file again or a model: the reasons the importer reports are matched by pattern, so it works
 * without AI and never repeats a name the child wrote.
 */
export type CutKind =
  | "extraScript"
  | "moreSprites"
  | "moreVariables"
  | "costume"
  | "ask"
  | "lists"
  | "customBlocks"
  | "pen"
  | "effect"
  | "computedMove"
  | "computedValue"
  | "condition"
  | "goto"
  | "sound"
  | "other";

const KINDS: readonly CutKind[] = [
  "extraScript",
  "moreSprites",
  "moreVariables",
  "costume",
  "ask",
  "lists",
  "customBlocks",
  "pen",
  "effect",
  "computedMove",
  "computedValue",
  "condition",
  "goto",
  "sound",
  "other",
];

export function cutKindOf(reason: string): CutKind {
  if (reason === "another script of the sprite") return "extraScript";
  if (reason.startsWith("sprite (more than")) return "moreSprites";
  if (/^(word )?variable "/.test(reason)) return "moreVariables";
  if (/^motion_movesteps \(value comes from another block\)/.test(reason)) return "computedMove";
  if (reason.includes("(value comes from another block)")) return "computedValue";
  if (reason.includes("(a condition the scene has no block for)")) return "condition";
  if (/^looks_(switch|next)(costume|backdrop)/.test(reason)) return "costume";
  if (reason.startsWith("sensing_askandwait")) return "ask";
  if (/^list "|^data_.*list/.test(reason)) return "lists";
  if (reason.startsWith("procedures_")) return "customBlocks";
  if (reason.startsWith("pen_")) return "pen";
  if (/^looks_(set|change)effect/.test(reason)) return "effect";
  if (/^motion_(goto|glide)/.test(reason)) return "goto";
  if (reason.startsWith("sound_")) return "sound";
  return "other";
}

interface CutIdea {
  readonly es: string;
  readonly en: string;
  /** The idea Ori can offer for it, from the closed list of Studio ideas. */
  readonly intent?: OriStudioIntent;
}

export const CUT_IDEAS: Readonly<Record<CutKind, CutIdea>> = {
  extraScript: {
    es: "Ese personaje tenía más de tres guiones, o dos que empezaban igual. Aquí cada personaje guarda hasta tres, uno por cada evento.",
    en: "That character had more than three scripts, or two that started the same way. Here each character keeps up to three, one for each event.",
  },
  moreSprites: {
    es: "La escena tiene lugar para 12 personajes; los demás no entraron.",
    en: "The scene has room for 12 characters; the rest did not fit.",
  },
  moreVariables: {
    es: "La escena tiene tres variables; las demás no entraron.",
    en: "The scene has three variables; the rest did not fit.",
  },
  costume: {
    es: "Cambiar de disfraz o de fondo por su nombre no se trajo. Con tus propias imágenes, «Siguiente disfraz» las recorre.",
    en: "Switching costume or backdrop by name did not come across. With your own pictures, “Next costume” steps through them.",
  },
  ask: {
    es: "«Preguntar y esperar» no se trajo. En la escena podés preguntar con una frase de la lista.",
    en: "“Ask and wait” did not come across. In the scene you can ask with a phrase from the list.",
  },
  lists: {
    es: "Algunas cosas de las listas no se trajeron: la escena tiene tres listas que empiezan vacías, y no tiene «quitar todo» ni posiciones más allá de la 10. Sí podés agregar, insertar, cambiar, quitar y leer elementos, números o palabras.",
    en: "Some list things did not come across: the scene has three lists that start empty, and no “delete all” or positions past 10. You can add, insert, replace, remove and read items, numbers or words.",
  },
  customBlocks: {
    es: "Los bloques propios de Scratch no se traen. Podés hacer los tuyos en «Mis bloques».",
    en: "Scratch's own blocks are not brought. You can make yours in “My blocks”.",
  },
  pen: {
    es: "Ese paso del lápiz no existe aquí. El lápiz tiene color, grosor, transparencia y tono.",
    en: "That pen step does not exist here. The pen has colour, size, transparency and shade.",
  },
  effect: {
    es: "Ese efecto no existe aquí. La escena tiene color, fantasma y brillo.",
    en: "That effect does not exist here. The scene has colour, ghost and brightness.",
  },
  computedMove: {
    es: "Un valor que venía de otro bloque no entra dentro de «Mover». Ori puede proponerte avanzar un poco.",
    en: "A value that came from another block does not fit inside “Move”. Ori can offer to move a bit.",
    intent: "scratchMove",
  },
  computedValue: {
    es: "Un valor que venía de otro bloque (por ejemplo un número al azar) no entra dentro de ese bloque.",
    en: "A value that came from another block (for example a random number) does not fit inside that block.",
  },
  condition: {
    es: "Esa condición no tiene bloque en la escena.",
    en: "That condition has no block in the scene.",
  },
  goto: {
    es: "«Ir a otro objeto» o «deslizarse a» no se trajo. Ori puede proponerte ir a un lugar al azar.",
    en: "“Go to another object” or “glide to” did not come across. Ori can offer to go to a random spot.",
    intent: "scratchGoTo",
  },
  sound: {
    es: "Ese sonido no está en la escena. Ori puede proponerte uno.",
    en: "That sound is not in the scene. Ori can offer one.",
    intent: "scratchSound",
  },
  other: {
    es: "Este bloque de Scratch no existe en la escena.",
    en: "This Scratch block does not exist in the scene.",
  },
};

export function cutSentence(kind: CutKind, locale: Locale): string {
  return CUT_IDEAS[kind][locale === "es" ? "es" : "en"];
}

/** The ideas Ori can offer for a set of cuts, once each, in the order of the closed list. */
export function intentsForCuts(kinds: readonly CutKind[]): readonly OriStudioIntent[] {
  const found: OriStudioIntent[] = [];
  for (const kind of kinds) {
    const intent = CUT_IDEAS[kind].intent;
    if (intent !== undefined && !found.includes(intent)) found.push(intent);
  }
  return found;
}

const KEY = "agorix.kids.importCuts.v1";

function read(storage: Pick<Storage, "getItem">): Record<string, CutKind[]> {
  try {
    const raw: unknown = JSON.parse(storage.getItem(KEY) ?? "{}");
    if (typeof raw !== "object" || raw === null) return {};
    const clean: Record<string, CutKind[]> = {};
    for (const [id, kinds] of Object.entries(raw)) {
      if (!/^studio-[a-z0-9-]{1,40}$/.test(id) || !Array.isArray(kinds)) continue;
      clean[id] = kinds.filter((kind): kind is CutKind => KINDS.includes(kind as CutKind));
    }
    return clean;
  } catch {
    return {};
  }
}

/** Only closed kinds are kept, never a name or a block from the file, and only on this device. */
export function saveImportCuts(
  projectId: string,
  kinds: readonly CutKind[],
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify({ ...read(storage), [projectId]: [...new Set(kinds)] }));
  } catch {
    // Without storage the ideas are simply not offered later.
  }
}

export function loadImportCuts(
  projectId: string,
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): readonly CutKind[] {
  return storage ? (read(storage)[projectId] ?? []) : [];
}

export function forgetImportCuts(
  projectId: string,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = browserStorage(),
): void {
  if (!storage) return;
  const all = read(storage);
  delete all[projectId];
  try {
    storage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Nothing to forget without storage.
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
