import type { Locale } from "../i18n.js";
import type { KidsScreen } from "./kidsState.js";

/**
 * What Ori is "looking at" (issue #1209, part b). The context is built **locally** from what is
 * under the cursor and drawn only from a closed vocabulary: screen, panel, kind of block and the
 * numbers on a selected sprite. It never carries a name, text typed by the child, or a program, and
 * nothing here sends it anywhere: part (c) shows it to the learner and sends it only on a click on Ori.
 */
export interface OriContext {
  readonly screen: KidsScreen;
  readonly panel?: string | undefined;
  readonly block?: string | undefined;
  readonly sprite?: { readonly x: number; readonly y: number } | undefined;
}

const PANELS: Record<string, { es: string; en: string }> = {
  stage: { es: "Escenario", en: "Stage" },
  program: { es: "Programa", en: "Program" },
  blocks: { es: "Bloques", en: "Blocks" },
  code: { es: "Código", en: "Code" },
  characters: { es: "Personajes y fondo", en: "Sprites and backdrop" },
  inspector: { es: "Objeto seleccionado", en: "Selected sprite" },
  media: { es: "Disfraces y sonidos", en: "Costumes and sounds" },
};

/** The family a block belongs to, by statement type; anything else is just "a block". */
const FAMILY: Record<string, string> = {
  move: "motion",
  goTo: "motion",
  nextCostume: "looks",
  goToTarget: "motion",
  setRotationStyle: "motion",
  setX: "motion",
  setY: "motion",
  changeX: "motion",
  changeY: "motion",
  glideTo: "motion",
  turn: "motion",
  pointInDirection: "motion",
  pointTowards: "motion",
  bounceOnEdge: "motion",
  goToLayer: "looks",
  say: "looks",
  think: "looks",
  show: "looks",
  hide: "looks",
  setSize: "looks",
  changeSize: "looks",
  switchCostume: "looks",
  switchBackdrop: "looks",
  setEffect: "looks",
  changeEffect: "looks",
  clearEffects: "looks",
  playSound: "sound",
  stopSounds: "sound",
  setVolume: "sound",
  changeVolume: "sound",
  wait: "control",
  waitUntil: "control",
  repeat: "control",
  forever: "control",
  repeatUntil: "control",
  if: "control",
  stop: "control",
  broadcast: "control",
  callProcedure: "control",
  penDown: "pen",
  penUp: "pen",
  setPenColor: "pen",
  setPenSize: "pen",
  clearPen: "pen",
  playNote: "music",
  playDrum: "music",
  setInstrument: "music",
  setTempo: "music",
  setPitch: "music",
  setPan: "music",
  setVariable: "variables",
  changeVariable: "variables",
  showVariable: "variables",
  hideVariable: "variables",
  listAdd: "variables",
  listRemoveAt: "variables",
  listInsertAt: "variables",
  listReplaceAt: "variables",
  askChoice: "control",
};

const FAMILY_LABEL: Record<string, { es: string; en: string }> = {
  motion: { es: "de Movimiento", en: "from Motion" },
  looks: { es: "de Apariencia", en: "from Looks" },
  sound: { es: "de Sonido", en: "from Sound" },
  control: { es: "de Control", en: "from Control" },
  pen: { es: "de Lápiz", en: "from Pen" },
  music: { es: "de Música", en: "from Music" },
  variables: { es: "de Variables", en: "from Variables" },
};

const SCREENS: Partial<Record<KidsScreen, { es: string; en: string }>> = {
  onboard: { es: "el inicio", en: "the start" },
  map: { es: "el mapa", en: "the map" },
  create: { es: "Crear", en: "Create" },
  studio: { es: "el editor", en: "the editor" },
  editor: { es: "el editor de la misión", en: "the mission editor" },
  projects: { es: "Mis proyectos", en: "My projects" },
  parents: { es: "Adultos", en: "Grown-ups" },
};

/** Reads the closest annotated ancestors of `target`; unknown things leave the context at screen level. */
export function contextFromTarget(target: Element | null, screen: KidsScreen): OriContext {
  const panelEl = target?.closest<HTMLElement>("[data-panel-id]");
  const panelId = panelEl?.dataset.panelId;
  const panel = panelId && PANELS[panelId] ? panelId : undefined;
  const blockEl = target?.closest<HTMLElement>("[data-ori-block]");
  const family = blockEl?.dataset.oriBlock ? FAMILY[blockEl.dataset.oriBlock] : undefined;
  const spriteEl = target?.closest<HTMLElement>("[data-ori-sprite-x]");
  const x = Number(spriteEl?.dataset.oriSpriteX);
  const y = Number(spriteEl?.dataset.oriSpriteY);
  return {
    screen,
    ...(panel ? { panel } : {}),
    ...(blockEl ? { block: family ?? "other" } : {}),
    ...(spriteEl && Number.isFinite(x) && Number.isFinite(y)
      ? { sprite: { x: Math.round(x), y: Math.round(y) } }
      : {}),
  };
}

/** A short sentence the learner can read and correct ("Estás mirando…"). */
export function describeContext(context: OriContext, locale: Locale): string {
  const es = locale === "es";
  const where = SCREENS[context.screen]?.[locale] ?? (es ? "esta pantalla" : "this screen");
  const parts: string[] = [];
  if (context.panel)
    parts.push(`${es ? "el panel" : "the panel"} ${PANELS[context.panel]![locale]}`);
  if (context.block) {
    const family = FAMILY_LABEL[context.block]?.[locale];
    parts.push(
      es ? `un bloque${family ? ` ${family}` : ""}` : `a block${family ? ` ${family}` : ""}`,
    );
  }
  if (context.sprite)
    parts.push(
      es
        ? `el objeto seleccionado (x=${context.sprite.x}, y=${context.sprite.y})`
        : `the selected sprite (x=${context.sprite.x}, y=${context.sprite.y})`,
    );
  if (parts.length === 0) return es ? `Estás en ${where}.` : `You are in ${where}.`;
  return es ? `Estás mirando ${parts.join(", ")}.` : `You are looking at ${parts.join(", ")}.`;
}
