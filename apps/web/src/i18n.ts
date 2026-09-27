import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
} from "@agorix/curriculum";

export type Locale = SupportedLocale;
export type MessageKey = keyof typeof messages.en;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

const messages = {
  en: {
    addMoveBlock: "Add a Move block to start.",
    appEyebrow: "Agorix First Mission",
    appTitle: "Build with blocks. See the code.",
    attemptsHints: "Attempts: {attempts} · Hints: {hints}",
    blockCount: "{count} blocks",
    blockLabel: "{name} block",
    blockNoteIf: "If Touching the goal?, then run inside blocks.",
    blocks: "Blocks",
    build: "Build",
    code: "Code",
    codeAria: "Code",
    codeBehindBlocks: "This is the code behind your blocks.",
    currentNode: "Current node: {code}",
    delete: "Delete",
    down: "Down",
    degrees: "degrees",
    fieldCount: "count",
    emptyRunMessage: "Nothing happens yet — add a block to 'When you press Run' to get started.",
    evidenceGoalReached: "Goal reached",
    evidenceReachGoal: "Reach the goal",
    freePlay: "Free play",
    freePlayUnlocked: "Free play unlocked. Keep experimenting with your program.",
    getHint: "Get hint",
    hintLevel: "Level {level}/5",
    hintLevelOf: "Hint level {level} of 5",
    hintMeter: "Hints used: {count}",
    keepBuilding: "Keep building",
    keepBlocksTryAgain: "Keep your blocks and try again.",
    localeLabel: "Product language",
    missionPrefix: "Mission: {title}.",
    missionProgress: "Mission progress step {step} of 3",
    move: "Move",
    repeat: "Repeat",
    proposalReview: "Tutor suggestion — may not be right",
    reflect: "Reflect",
    reflection: "Reflection: {prompt}",
    reset: "Reset",
    resetMessage: "Reset",
    run: "Run",
    runAgain: "Try again",
    running: "Running…",
    runSetupError: "This block setup needs a small fix before it can run.",
    stage: "Stage",
    stageAria: "Sprite and goal stage",
    step: "Step",
    stop: "Stop",
    stopped: "Stopped",
    steps: "steps",
    toolboxIfGoal: "If touching goal",
    toolboxMove: "Move",
    toolboxRepeatDecide: "Repeat & Decide",
    tutorError: "The tutor needs a runnable block setup before it can help.",
    tutorIntro:
      "Ask for a hint when you want a small nudge. The first hint will not give away the full answer.",
    tutorOffline: "Offline",
    touchingGoal: "Touching the goal?",
    turn: "Turn",
    up: "Up",
    whenRun: "When you press Run",
  },
  es: {
    addMoveBlock: "Agrega un bloque Mover para empezar.",
    appEyebrow: "Primera misión de Agorix",
    appTitle: "Construye con bloques. Mira el código.",
    attemptsHints: "Intentos: {attempts} · Pistas: {hints}",
    blockCount: "{count} bloques",
    blockLabel: "Bloque {name}",
    blockNoteIf: "Si ¿toca la meta?, ejecuta los bloques internos.",
    blocks: "Bloques",
    build: "Construir",
    code: "Código",
    codeAria: "Código",
    codeBehindBlocks: "Este es el código detrás de tus bloques.",
    currentNode: "Nodo actual: {code}",
    delete: "Borrar",
    down: "Bajar",
    degrees: "grados",
    fieldCount: "cantidad",
    emptyRunMessage:
      "Todavía no pasa nada: agrega un bloque a 'Cuando presionas Ejecutar' para empezar.",
    evidenceGoalReached: "Meta alcanzada",
    evidenceReachGoal: "Alcanza la meta",
    freePlay: "Juego libre",
    freePlayUnlocked: "Juego libre desbloqueado. Sigue experimentando con tu programa.",
    getHint: "Pedir pista",
    hintLevel: "Nivel {level}/5",
    hintLevelOf: "Nivel de pista {level} de 5",
    hintMeter: "Pistas usadas: {count}",
    keepBuilding: "Seguir construyendo",
    keepBlocksTryAgain: "Conserva tus bloques y vuelve a intentar.",
    localeLabel: "Idioma del producto",
    missionPrefix: "Misión: {title}.",
    missionProgress: "Progreso de misión, paso {step} de 3",
    move: "Mover",
    repeat: "Repetir",
    proposalReview: "Sugerencia del tutor — puede no estar correcta",
    reflect: "Reflexionar",
    reflection: "Reflexión: {prompt}",
    reset: "Reiniciar",
    resetMessage: "Reiniciado",
    run: "Ejecutar",
    runAgain: "Intentar otra vez",
    running: "Ejecutando…",
    runSetupError: "Esta combinación de bloques necesita un pequeño ajuste antes de ejecutarse.",
    stage: "Escenario",
    stageAria: "Escenario con personaje y meta",
    step: "Paso",
    stop: "Detener",
    stopped: "Detenido",
    steps: "pasos",
    toolboxIfGoal: "Si toca la meta",
    toolboxMove: "Movimiento",
    toolboxRepeatDecide: "Repetir y decidir",
    tutorError: "El tutor necesita bloques que se puedan ejecutar antes de ayudar.",
    tutorIntro:
      "Pide una pista cuando quieras un pequeño empujón. La primera pista no revela toda la respuesta.",
    tutorOffline: "Sin conexión",
    touchingGoal: "¿Toca la meta?",
    turn: "Girar",
    up: "Subir",
    whenRun: "Cuando presionas Ejecutar",
  },
} as const;

export function resolveLocale(locale: string | undefined): Locale {
  return normalizeLocale(locale);
}

export function t(
  locale: string | undefined,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const resolved = resolveLocale(locale);
  const template = messages[resolved][key] ?? messages[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    String(values[name] ?? `{${name}}`),
  );
}

export function assertCatalogCompleteness(): void {
  const defaultKeys = Object.keys(messages[DEFAULT_LOCALE]) as MessageKey[];
  for (const locale of SUPPORTED_LOCALES) {
    const missing = defaultKeys.filter((key) => messages[locale][key] === undefined);
    if (missing.length > 0) {
      throw new Error(`Missing ${locale} translations: ${missing.join(", ")}`);
    }
  }
}
