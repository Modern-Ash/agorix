import { SCHEMA_VERSION, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram, type RunResult, type WorldState } from "@agorix/runtime";
import {
  MISSION_SCHEMA_VERSION,
  normalizeLocale,
  validateMission,
  type MissionConcept,
  type MissionDefinition,
  type MissionHint,
  type SupportedLocale,
} from "./index.js";

/**
 * Agorix Kids worlds and missions (issue #372).
 *
 * The prototype plays on a 6x4 grid of cells; the runtime moves in pixels and has no world
 * edge. This module is the adapter: a cell scale, three missions written as ordinary
 * `MissionDefinition`s, and an interpretation of a runtime trace in cells (including the
 * "wall" outcome). Runtime semantics are untouched.
 */
export const KIDS_GRID = Object.freeze({ cols: 6, rows: 4, cellSize: 40 });

export type KidsDirection = "E" | "S" | "W" | "N";
export type KidsOutcome = "success" | "wall" | "passed" | "short";
export type KidsGoalCheck = "touches-goal" | "touches-goal-after-turn";

export interface KidsCell {
  readonly cx: number;
  readonly cy: number;
}

const DIRECTIONS: readonly KidsDirection[] = ["E", "S", "W", "N"];

export function cellToWorld(cell: KidsCell): { readonly x: number; readonly y: number } {
  return { x: cell.cx * KIDS_GRID.cellSize, y: cell.cy * KIDS_GRID.cellSize };
}

export function worldToCell(position: { readonly x: number; readonly y: number }): KidsCell {
  return {
    cx: Math.round(position.x / KIDS_GRID.cellSize),
    cy: Math.round(position.y / KIDS_GRID.cellSize),
  };
}

/** A Move block of `cells` squares is a runtime `move` of this many steps. */
export function kidsMoveSteps(cells: number): number {
  return cells * KIDS_GRID.cellSize;
}

function insideGrid(cell: KidsCell): boolean {
  return cell.cx >= 0 && cell.cy >= 0 && cell.cx < KIDS_GRID.cols && cell.cy < KIDS_GRID.rows;
}

function sameCell(a: KidsCell, b: KidsCell): boolean {
  return a.cx === b.cx && a.cy === b.cy;
}

interface KidsMissionSpec {
  readonly id: string;
  readonly start: KidsCell;
  readonly goal: KidsCell;
  readonly concepts: readonly MissionConcept[];
}

export const KIDS_MISSION_IDS = Object.freeze([
  "kids.m1.straight",
  "kids.m2.corner",
  "kids.m3.zigzag",
] as const);
export const KIDS_FREE_MISSION_ID = "kids.free";

/** Kids uses the mission/evidence scale 1-5; zero means no help was delivered. */
export const KIDS_HINT_LEVELS = Object.freeze([1, 2, 3, 4, 5] as const);
export type KidsHintLevel = (typeof KIDS_HINT_LEVELS)[number];
export const KIDS_DIRECT_HELP_LEVEL: KidsHintLevel = 5;

/** A hint can be shown only after every lighter hint has actually been used. */
export function kidsHintUnlocked(level: number, usedLevels: readonly number[]): boolean {
  if (!KIDS_HINT_LEVELS.some((candidate) => candidate === level)) return false;
  const used = new Set(usedLevels);
  return KIDS_HINT_LEVELS.every((candidate) => candidate >= level || used.has(candidate));
}

/** Returns no hint when it is locked; callers must record a level only after display. */
export function getKidsHint(
  mission: MissionDefinition,
  level: number,
  usedLevels: readonly number[],
): MissionHint | undefined {
  if (!kidsHintUnlocked(level, usedLevels)) return undefined;
  return mission.hintLadder.find((hint) => hint.level === level);
}

const SPECS: readonly KidsMissionSpec[] = [
  {
    id: KIDS_MISSION_IDS[0],
    start: { cx: 0, cy: 2 },
    goal: { cx: 4, cy: 2 },
    concepts: ["sequence", "movement"],
  },
  {
    id: KIDS_MISSION_IDS[1],
    start: { cx: 0, cy: 3 },
    goal: { cx: 3, cy: 1 },
    concepts: ["sequence", "movement"],
  },
  {
    id: KIDS_MISSION_IDS[2],
    start: { cx: 0, cy: 0 },
    goal: { cx: 3, cy: 3 },
    concepts: ["sequence", "movement", "repetition"],
  },
];

const FREE_START: KidsCell = { cx: 0, cy: 2 };

interface KidsCopy {
  readonly title: string;
  readonly goalTitle: string;
  readonly learnerFacing: string;
  readonly hints: readonly [string, string, string, string, string];
  readonly reflectionPrompt: string;
}

const COPY: Record<string, Record<SupportedLocale, KidsCopy>> = {
  [KIDS_MISSION_IDS[0]]: {
    es: {
      title: "Camino recto",
      goalTitle: "Llegá a la meta",
      learnerFacing: "Mové a tu personaje en línea recta hasta la meta.",
      hints: [
        "Mirá dónde está la meta. ¿Está cerca o lejos?",
        "Contá los cuadritos que hay entre tu personaje y la meta.",
        "Un bloque Mover avanza tantos cuadritos como indica su número.",
        "Probá un bloque Mover con el número de cuadritos que contaste.",
        "Una idea: un solo bloque Mover con el número 4.",
      ],
      reflectionPrompt: "¿Qué número usaste en Mover y por qué?",
    },
    en: {
      title: "Straight path",
      goalTitle: "Reach the goal",
      learnerFacing: "Move your character in a straight line to the goal.",
      hints: [
        "Look at where the goal is. Is it near or far?",
        "Count the squares between your character and the goal.",
        "A Move block goes forward as many squares as its number says.",
        "Try a Move block with the number of squares you counted.",
        "One idea: a single Move block set to 4.",
      ],
      reflectionPrompt: "Which number did you use in Move, and why?",
    },
  },
  [KIDS_MISSION_IDS[1]]: {
    es: {
      title: "La esquina",
      goalTitle: "Llegá a la meta doblando",
      learnerFacing: "La meta está arriba. Avanzá y girá para llegar.",
      hints: [
        "La meta no está en tu fila. ¿Hacia dónde tenés que ir?",
        "Primero avanzá hacia el lado de la meta y después tenés que girar.",
        "Girar a la izquierda hace que tu personaje mire hacia arriba.",
        "Probá: Mover, Girar a la izquierda y otro Mover.",
        "Una idea: Mover 3, Girar a la izquierda, Mover 2.",
      ],
      reflectionPrompt: "¿Por qué tuviste que girar en tu programa?",
    },
    en: {
      title: "The corner",
      goalTitle: "Reach the goal by turning",
      learnerFacing: "The goal is up there. Go forward and turn to reach it.",
      hints: [
        "The goal is not in your row. Which way do you need to go?",
        "First go toward the side of the goal, then you will need to turn.",
        "Turning left makes your character face up.",
        "Try: Move, Turn left and another Move.",
        "One idea: Move 3, Turn left, Move 2.",
      ],
      reflectionPrompt: "Why did your program need a turn?",
    },
  },
  [KIDS_MISSION_IDS[2]]: {
    es: {
      title: "El zigzag",
      goalTitle: "Llegá a la meta con giros",
      learnerFacing: "Baja, gira y avanza hasta la meta. Repetir te puede ayudar.",
      hints: [
        "Mirá el camino: la meta está abajo y a la derecha.",
        "Tu personaje empieza mirando a la derecha. ¿Qué giro lo hace mirar hacia abajo?",
        "Cuando repites la misma acción varias veces, el bloque Repetir te ahorra bloques.",
        "Probá: Girar a la derecha, avanzar, Girar a la izquierda y avanzar otra vez.",
        "Una idea: Girar a la derecha, Mover 3, Girar a la izquierda, Mover 3.",
      ],
      reflectionPrompt: "¿Dónde podrías usar Repetir para tener menos bloques?",
    },
    en: {
      title: "The zigzag",
      goalTitle: "Reach the goal with turns",
      learnerFacing: "Go down, turn and move to the goal. Repeat can help.",
      hints: [
        "Look at the path: the goal is down and to the right.",
        "Your character starts facing right. Which turn makes it face down?",
        "When you do the same action many times, the Repeat block saves you blocks.",
        "Try: Turn right, move, Turn left and move again.",
        "One idea: Turn right, Move 3, Turn left, Move 3.",
      ],
      reflectionPrompt: "Where could you use Repeat to have fewer blocks?",
    },
  },
  [KIDS_FREE_MISSION_ID]: {
    es: {
      title: "Tu propio mundo",
      goalTitle: "Elegí tu meta",
      learnerFacing: "Tocá el mundo para poner la meta y luego llegá hasta ella.",
      hints: [
        "Tocá un cuadrito del mundo para poner tu meta.",
        "Mirá cuántos cuadritos hay hasta tu meta.",
        "Mover avanza y Girar cambia hacia dónde mira tu personaje.",
        "Combiná Mover y Girar para dibujar tu camino.",
        "Una idea: elegí una meta en tu misma fila y usá un solo Mover.",
      ],
      reflectionPrompt: "¿Qué meta elegiste y cómo llegaste?",
    },
    en: {
      title: "Your own world",
      goalTitle: "Pick your goal",
      learnerFacing: "Tap the world to place the goal, then reach it.",
      hints: [
        "Tap a square of the world to place your goal.",
        "Count how many squares there are to your goal.",
        "Move goes forward and Turn changes where your character looks.",
        "Combine Move and Turn to draw your path.",
        "One idea: pick a goal in your own row and use a single Move.",
      ],
      reflectionPrompt: "Which goal did you pick and how did you get there?",
    },
  },
};

/**
 * Each world has its own three missions (issue #612). The mission id is the slot (first, second,
 * third), so saved projects, progress keys and the tutor keep working unchanged; the world only
 * changes where the character starts, where the goal is and how the mission talks. The space world
 * keeps the original layouts and copy.
 */
export const KIDS_MISSION_WORLDS = Object.freeze(["space", "ocean", "robots", "city"] as const);
export type KidsMissionWorld = (typeof KIDS_MISSION_WORLDS)[number];

interface WorldLayout {
  readonly start: KidsCell;
  readonly goal: KidsCell;
  readonly concepts: readonly MissionConcept[];
}

const WORLD_LAYOUTS: Readonly<
  Record<Exclude<KidsMissionWorld, "space">, readonly [WorldLayout, WorldLayout, WorldLayout]>
> = {
  ocean: [
    { start: { cx: 1, cy: 0 }, goal: { cx: 5, cy: 0 }, concepts: ["sequence", "movement"] },
    { start: { cx: 0, cy: 0 }, goal: { cx: 3, cy: 2 }, concepts: ["sequence", "movement"] },
    {
      start: { cx: 0, cy: 3 },
      goal: { cx: 5, cy: 1 },
      concepts: ["sequence", "movement", "repetition"],
    },
  ],
  robots: [
    { start: { cx: 0, cy: 3 }, goal: { cx: 3, cy: 3 }, concepts: ["sequence", "movement"] },
    { start: { cx: 1, cy: 0 }, goal: { cx: 4, cy: 3 }, concepts: ["sequence", "movement"] },
    {
      start: { cx: 0, cy: 1 },
      goal: { cx: 5, cy: 3 },
      concepts: ["sequence", "movement", "repetition"],
    },
  ],
  city: [
    { start: { cx: 0, cy: 1 }, goal: { cx: 5, cy: 1 }, concepts: ["sequence", "movement"] },
    { start: { cx: 2, cy: 3 }, goal: { cx: 5, cy: 1 }, concepts: ["sequence", "movement"] },
    {
      start: { cx: 0, cy: 0 },
      goal: { cx: 4, cy: 3 },
      concepts: ["sequence", "movement", "repetition"],
    },
  ],
};

const WORLD_STORY: Readonly<
  Record<
    Exclude<KidsMissionWorld, "space">,
    Record<
      SupportedLocale,
      { titles: readonly [string, string, string]; verb: string; place: string; goalTitle: string }
    >
  >
> = {
  ocean: {
    es: {
      titles: ["Corriente recta", "Doblar el arrecife", "Zigzag entre corales"],
      verb: "Nadá",
      place: "el tesoro",
      goalTitle: "Llegá al tesoro",
    },
    en: {
      titles: ["Straight current", "Round the reef", "Zigzag through the coral"],
      verb: "Swim",
      place: "the treasure",
      goalTitle: "Reach the treasure",
    },
  },
  robots: {
    es: {
      titles: ["Cinta transportadora", "Girar en la fábrica", "Escalera de engranajes"],
      verb: "Rodá",
      place: "el cargador",
      goalTitle: "Llegá al cargador",
    },
    en: {
      titles: ["Conveyor belt", "Turn in the factory", "Gear staircase"],
      verb: "Roll",
      place: "the charger",
      goalTitle: "Reach the charger",
    },
  },
  city: {
    es: {
      titles: ["Calle principal", "Doblar en la esquina", "Cruzar la plaza"],
      verb: "Caminá",
      place: "la parada",
      goalTitle: "Llegá a la parada",
    },
    en: {
      titles: ["Main street", "Turn at the corner", "Across the square"],
      verb: "Walk",
      place: "the bus stop",
      goalTitle: "Reach the bus stop",
    },
  },
};

/** Copy for a world's mission, with the squares counted from its own layout. */
function worldCopy(
  world: Exclude<KidsMissionWorld, "space">,
  slot: 0 | 1 | 2,
  layout: WorldLayout,
  locale: SupportedLocale,
): KidsCopy {
  const story = WORLD_STORY[world][locale];
  const dx = layout.goal.cx - layout.start.cx;
  const dy = layout.goal.cy - layout.start.cy;
  const down = dy > 0;
  const rows = Math.abs(dy);
  const es = locale === "es";
  const turn = es ? (down ? "derecha" : "izquierda") : down ? "right" : "left";
  const toward = es ? (down ? "abajo" : "arriba") : down ? "down" : "up";
  const base = COPY[KIDS_MISSION_IDS[slot]]![locale]!;
  if (slot === 0) {
    return {
      title: story.titles[0],
      goalTitle: story.goalTitle,
      learnerFacing: es
        ? `${story.verb} en línea recta hasta ${story.place}.`
        : `${story.verb} in a straight line to ${story.place}.`,
      hints: es
        ? [
            "Mirá dónde está la meta. ¿Está cerca o lejos?",
            `Contá los cuadritos entre tu personaje y la meta: son ${dx}.`,
            "Un bloque Mover avanza tantos cuadritos como indica su número.",
            `Probá un bloque Mover con el número ${dx}.`,
            `Una idea: Mover ${dx}.`,
          ]
        : [
            "Look at where the goal is. Is it near or far?",
            `Count the squares between your character and the goal: there are ${dx}.`,
            "A Move block goes as many squares as its number says.",
            `Try a Move block with the number ${dx}.`,
            `One idea: Move ${dx}.`,
          ],
      reflectionPrompt: base.reflectionPrompt,
    };
  }
  if (slot === 1) {
    return {
      title: story.titles[1],
      goalTitle: story.goalTitle,
      learnerFacing: es
        ? `${story.verb} hasta ${story.place}: avanzá y doblá una vez.`
        : `${story.verb} to ${story.place}: move, then turn once.`,
      hints: es
        ? [
            `Mirá el camino: la meta está ${dx} cuadritos a la derecha y ${rows} hacia ${toward}.`,
            `Tu personaje empieza mirando a la derecha. ¿Qué giro lo hace mirar hacia ${toward}?`,
            "Mover avanza y Girar cambia hacia dónde mira tu personaje. Combinalos.",
            "Primero avanzá hacia la derecha; cuando llegues a la columna de la meta, girá.",
            `Una idea: Mover ${dx}, Girar a la ${turn}, Mover ${rows}.`,
          ]
        : [
            `Look at the path: the goal is ${dx} squares to the right and ${rows} ${toward}.`,
            `Your character starts facing right. Which turn makes it face ${toward}?`,
            "Move goes forward and Turn changes where your character looks. Combine them.",
            "First go right; when you reach the goal's column, turn.",
            `One idea: Move ${dx}, Turn ${turn}, Move ${rows}.`,
          ],
      reflectionPrompt: base.reflectionPrompt,
    };
  }
  return {
    title: story.titles[2],
    goalTitle: es ? `${story.goalTitle} con giros` : `${story.goalTitle} with turns`,
    learnerFacing: es
      ? `${story.verb} hasta ${story.place} con giros. Repetir te puede ayudar.`
      : `${story.verb} to ${story.place} with turns. Repeat can help.`,
    hints: es
      ? [
          `Mirá el camino: la meta está ${dx} cuadritos a la derecha y ${rows} hacia ${toward}.`,
          `Tu personaje empieza mirando a la derecha. ¿Qué giro lo hace mirar hacia ${toward}?`,
          "Cuando repetís la misma acción varias veces, el bloque Repetir te ahorra bloques.",
          "Probá avanzar de a un cuadrito con Repetir, y girar cuando llegues a la columna de la meta.",
          `Una idea: Mover ${dx}, Girar a la ${turn}, Mover ${rows}.`,
        ]
      : [
          `Look at the path: the goal is ${dx} squares to the right and ${rows} ${toward}.`,
          `Your character starts facing right. Which turn makes it face ${toward}?`,
          "When you do the same action many times, the Repeat block saves you blocks.",
          "Try moving one square at a time with Repeat, and turn when you reach the goal's column.",
          `One idea: Move ${dx}, Turn ${turn}, Move ${rows}.`,
        ],
    reflectionPrompt: base.reflectionPrompt,
  };
}

/**
 * The missions as data (issue #616): where each one starts and ends, and the words it uses. The
 * built-in catalog is what the code ships; an administrator can publish another one, and every
 * entry has to pass the checks below before it is stored. Hints are not edited by hand: they are
 * counted from the layout, so they cannot disagree with it.
 */
export interface KidsCatalogEntry {
  readonly start: KidsCell;
  readonly goal: KidsCell;
  readonly title: Readonly<Record<SupportedLocale, string>>;
  readonly story: Readonly<Record<SupportedLocale, string>>;
}
export type KidsCatalog = Readonly<
  Record<KidsMissionWorld, readonly [KidsCatalogEntry, KidsCatalogEntry, KidsCatalogEntry]>
>;

export function defaultKidsCatalog(): KidsCatalog {
  const entry = (world: KidsMissionWorld, slot: 0 | 1 | 2): KidsCatalogEntry => {
    const id = KIDS_MISSION_IDS[slot];
    const { start, goal } = kidsMissionLayout(id, world);
    const es = getKidsMission(id, "es", world);
    const en = getKidsMission(id, "en", world);
    return {
      start,
      goal,
      title: { es: es.title, en: en.title },
      story: { es: es.goal.learnerFacing, en: en.goal.learnerFacing },
    };
  };
  const world = (name: KidsMissionWorld) =>
    [entry(name, 0), entry(name, 1), entry(name, 2)] as const;
  return {
    space: world("space"),
    ocean: world("ocean"),
    robots: world("robots"),
    city: world("city"),
  };
}

const CATALOG_TEXT = /^[\p{L}\p{N} .,;:¡!¿?'’()-]+$/u;
export const KIDS_CATALOG_TITLE_MAX = 40;
export const KIDS_CATALOG_STORY_MAX = 120;

function catalogCell(value: unknown): KidsCell {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("cell");
  const cell = value as Record<string, unknown>;
  if (Object.keys(cell).sort().join() !== "cx,cy") throw new RangeError("cell");
  const parsed = { cx: cell.cx as number, cy: cell.cy as number };
  if (!Number.isInteger(parsed.cx) || !Number.isInteger(parsed.cy) || !insideGrid(parsed)) {
    throw new RangeError("cell outside the grid");
  }
  return parsed;
}

function catalogText(value: unknown, max: number): Record<SupportedLocale, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RangeError("text");
  const text = value as Record<string, unknown>;
  if (Object.keys(text).sort().join() !== "en,es") throw new RangeError("text");
  const read = (locale: SupportedLocale): string => {
    const item = text[locale];
    if (
      typeof item !== "string" ||
      item.trim() !== item ||
      item.length < 1 ||
      item.length > max ||
      !CATALOG_TEXT.test(item)
    ) {
      throw new RangeError("text");
    }
    return item;
  };
  return { es: read("es"), en: read("en") };
}

/** Shape and limits of a catalog. Whether each mission can be won is `unsolvableKidsMissions`. */
export function validateKidsCatalog(raw: unknown): KidsCatalog {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RangeError("catalog");
  const root = raw as Record<string, unknown>;
  if (Object.keys(root).sort().join() !== [...KIDS_MISSION_WORLDS].sort().join()) {
    throw new RangeError("catalog worlds");
  }
  const worlds = {} as Record<KidsMissionWorld, KidsCatalogEntry[]>;
  for (const world of KIDS_MISSION_WORLDS) {
    const list = root[world];
    if (!Array.isArray(list) || list.length !== 3) throw new RangeError("catalog missions");
    worlds[world] = list.map((item): KidsCatalogEntry => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new RangeError("entry");
      const entry = item as Record<string, unknown>;
      if (Object.keys(entry).sort().join() !== "goal,start,story,title") {
        throw new RangeError("entry");
      }
      const start = catalogCell(entry.start);
      const goal = catalogCell(entry.goal);
      // Right of the start, so the hints and the shortest answer stay honest.
      if (goal.cx <= start.cx) throw new RangeError("goal must be to the right of the start");
      return {
        start,
        goal,
        title: catalogText(entry.title, KIDS_CATALOG_TITLE_MAX),
        story: catalogText(entry.story, KIDS_CATALOG_STORY_MAX),
      };
    });
  }
  return worlds as unknown as KidsCatalog;
}

/** The missions of a catalog that the canonical runtime cannot win, as `world:slot`. */
export function unsolvableKidsMissions(catalog: KidsCatalog): readonly string[] {
  const failed: string[] = [];
  for (const world of KIDS_MISSION_WORLDS) {
    catalog[world].forEach((entry, slot) => {
      const mission = getKidsMission(KIDS_MISSION_IDS[slot]!, "es", world, catalog);
      const route: Statement[] = [
        { type: "move", steps: kidsMoveSteps(entry.goal.cx - entry.start.cx) },
      ];
      const dy = entry.goal.cy - entry.start.cy;
      if (dy !== 0) {
        route.push({ type: "turn", degrees: dy > 0 ? 90 : -90 });
        route.push({ type: "move", steps: kidsMoveSteps(Math.abs(dy)) });
      }
      const result = runProgram(
        {
          schema: SCHEMA_VERSION,
          scripts: [{ id: "witness", trigger: { type: "greenFlag" }, statements: route }],
        },
        createWorldState(mission.starterStage),
      );
      if (evaluateKidsRun({ mission, result }).outcome !== "success") {
        failed.push(`${world}:${slot}`);
      }
    });
  }
  return failed;
}

/** The layout of a mission in a world, in cells (used by tests and the map). */
export function kidsMissionLayout(
  id: string,
  world: KidsMissionWorld = "space",
): { readonly start: KidsCell; readonly goal: KidsCell } {
  const slot = KIDS_MISSION_IDS.findIndex((candidate) => candidate === id);
  if (slot < 0) throw new RangeError(`unknown kids mission: ${id}`);
  const layout = world === "space" ? SPECS[slot]! : WORLD_LAYOUTS[world][slot as 0 | 1 | 2];
  return { start: layout.start, goal: layout.goal };
}

function ladder(hints: KidsCopy["hints"]): readonly MissionHint[] {
  return hints.map((text, index) => ({
    level: (index + 1) as MissionHint["level"],
    text,
  }));
}

function buildMission(
  spec: KidsMissionSpec,
  locale: SupportedLocale,
  override?: KidsCopy,
): MissionDefinition {
  const copy = override ?? COPY[spec.id]?.[locale];
  if (copy === undefined) {
    throw new RangeError(`unknown kids mission: ${spec.id}`);
  }
  const start = cellToWorld(spec.start);
  const goal = cellToWorld(spec.goal);
  return validateMission({
    schema: MISSION_SCHEMA_VERSION,
    id: spec.id,
    version: 1,
    title: copy.title,
    goal: { title: copy.goalTitle, learnerFacing: copy.learnerFacing },
    concepts: spec.concepts,
    starterProject: {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements: [] }],
    },
    starterStage: { sprite: { x: start.x, y: start.y, heading: 0 }, goal },
    completion: { type: "spriteTouchingGoal" },
    constraints: [
      {
        id: "kids-grid",
        description: `The world is a ${KIDS_GRID.cols}x${KIDS_GRID.rows} grid; leaving it is a wall bump, judged from the run trace.`,
      },
      {
        id: "runtime-completion",
        description: "Completion is evaluated from runtime world state, not an LLM judgment.",
      },
    ],
    hintLadder: ladder(copy.hints),
    reflectionPrompt: copy.reflectionPrompt,
  });
}

export function getKidsMission(
  id: string,
  locale: string | undefined,
  world: KidsMissionWorld = "space",
  catalog?: KidsCatalog,
): MissionDefinition {
  const spec = SPECS.find((candidate) => candidate.id === id);
  if (spec === undefined) {
    throw new RangeError(`unknown kids mission: ${id}`);
  }
  const language = normalizeLocale(locale);
  const slot = KIDS_MISSION_IDS.findIndex((candidate) => candidate === id) as 0 | 1 | 2;
  const builtIn =
    world === "space"
      ? buildMission(spec, language)
      : (() => {
          const layout = WORLD_LAYOUTS[world]?.[slot];
          if (layout === undefined) throw new RangeError(`unknown kids world: ${world}`);
          return buildMission(
            { id, start: layout.start, goal: layout.goal, concepts: layout.concepts },
            language,
            worldCopy(world, slot, layout, language),
          );
        })();
  const entry = catalog?.[world]?.[slot];
  if (entry === undefined) return builtIn;
  const original = kidsMissionLayout(id, world);
  const sameLayout = sameCell(entry.start, original.start) && sameCell(entry.goal, original.goal);
  const base = buildMission(
    { id, start: entry.start, goal: entry.goal, concepts: spec.concepts },
    language,
    {
      title: entry.title[language],
      goalTitle: builtIn.goal.title,
      learnerFacing: entry.story[language],
      // Counted from the layout when it moved; the hand-written ones still fit when it did not.
      hints: sameLayout
        ? (builtIn.hintLadder.map((hint) => hint.text) as unknown as KidsCopy["hints"])
        : worldCopy("ocean", slot, { ...entry, concepts: spec.concepts }, language).hints,
      reflectionPrompt: builtIn.reflectionPrompt ?? "",
    },
  );
  return base;
}

/** The free world: the child taps a cell to place the goal; the start is fixed. */
export function createFreeWorldMission(
  goal: KidsCell,
  locale: string | undefined,
): MissionDefinition {
  if (!Number.isInteger(goal.cx) || !Number.isInteger(goal.cy) || !insideGrid(goal)) {
    throw new RangeError("the goal must be a whole cell inside the grid");
  }
  if (sameCell(goal, FREE_START)) {
    throw new RangeError("the goal cannot be on the start cell");
  }
  const mission = buildMission(
    { id: KIDS_FREE_MISSION_ID, start: FREE_START, goal, concepts: ["sequence", "movement"] },
    normalizeLocale(locale),
  );
  // Prove reachability through the same canonical runtime the child uses. The witness stays
  // private: it is never inserted into the learner's project or offered as a solution.
  const route: Statement[] = [];
  if (goal.cx > FREE_START.cx) route.push({ type: "move", steps: kidsMoveSteps(goal.cx) });
  const vertical = goal.cy - FREE_START.cy;
  if (vertical !== 0) {
    route.push({ type: "turn", degrees: vertical > 0 ? 90 : -90 });
    route.push({ type: "move", steps: kidsMoveSteps(Math.abs(vertical)) });
  }
  const witness = runProgram(
    {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "reachability", trigger: { type: "greenFlag" }, statements: route }],
    },
    createWorldState(mission.starterStage),
  );
  if (evaluateKidsRun({ mission, result: witness }).outcome !== "success") {
    throw new RangeError("the free-world goal is not reachable");
  }
  return mission;
}

/** Prove an invented challenge with the same runtime and grid interpretation used by play. */
export function verifyKidsFreeGoal(
  goal: KidsCell,
  check: KidsGoalCheck,
  locale: string | undefined,
): MissionDefinition {
  const mission = createFreeWorldMission(goal, locale);
  if (check === "touches-goal") return mission;
  if (check !== "touches-goal-after-turn") throw new RangeError("unsupported Kids goal check");
  const statements: Statement[] = [];
  if (goal.cy !== FREE_START.cy) {
    if (goal.cx > 0) statements.push({ type: "move", steps: kidsMoveSteps(goal.cx) });
    statements.push({ type: "turn", degrees: goal.cy > FREE_START.cy ? 90 : -90 });
    statements.push({ type: "move", steps: kidsMoveSteps(Math.abs(goal.cy - FREE_START.cy)) });
  } else {
    statements.push(
      { type: "turn", degrees: 90 },
      { type: "move", steps: kidsMoveSteps(1) },
      { type: "turn", degrees: -90 },
      { type: "move", steps: kidsMoveSteps(goal.cx) },
      { type: "turn", degrees: -90 },
      { type: "move", steps: kidsMoveSteps(1) },
    );
  }
  const witness = runProgram(
    {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "goal-witness", trigger: { type: "greenFlag" }, statements }],
    },
    createWorldState(mission.starterStage),
  );
  if (evaluateKidsGoalRun(mission, witness, check).outcome !== "success")
    throw new RangeError("the Kids goal cannot be proved by the runtime");
  return mission;
}

export interface KidsRunEvaluation {
  readonly outcome: KidsOutcome;
  /** Every cell visited in order, including the start and cells crossed inside one Move. */
  readonly trail: readonly KidsCell[];
  readonly final: KidsCell;
  readonly heading: KidsDirection;
  /** The first cell outside the grid the character tried to enter, when it hit the edge. */
  readonly wallAt?: KidsCell;
  readonly missingTurn?: boolean;
}

export function evaluateKidsGoalRun(
  mission: MissionDefinition,
  result: RunResult,
  check: KidsGoalCheck,
): KidsRunEvaluation {
  const evaluation = evaluateKidsRun({ mission, result });
  if (check === "touches-goal") return evaluation;
  if (check !== "touches-goal-after-turn") throw new RangeError("unsupported Kids goal check");
  const goal = worldToCell(mission.starterStage.goal as { x: number; y: number });
  const firstArrival = result.trace.findIndex((entry) =>
    sameCell(worldToCell(entry.worldAfter.sprite), goal),
  );
  if (
    evaluation.outcome !== "success" ||
    result.trace.some(
      (entry, index) =>
        entry.statementType === "turn" && (firstArrival < 0 || index < firstArrival),
    )
  )
    return evaluation;
  return { ...evaluation, outcome: "short", missingTurn: true };
}

function compass(degrees: number): KidsDirection {
  const quarter = Math.round((((degrees % 360) + 360) % 360) / 90) % 4;
  return DIRECTIONS[quarter] ?? "E";
}

function cellsBetween(from: KidsCell, to: KidsCell): readonly KidsCell[] {
  const cells: KidsCell[] = [];
  const dx = Math.sign(to.cx - from.cx);
  const dy = Math.sign(to.cy - from.cy);
  if (dx !== 0 && dy !== 0) {
    return [to];
  }
  let cursor = from;
  while (!sameCell(cursor, to)) {
    cursor = { cx: cursor.cx + dx, cy: cursor.cy + dy };
    cells.push(cursor);
  }
  return cells;
}

/**
 * Interprets a runtime run in grid cells, from its execution trace (always present, so
 * `collectObservations` is not required). The runtime has no world edge, so the first step
 * outside the grid ends the interpretation as a "wall" and the character stays on the last
 * cell inside (the prototype's behaviour).
 */
export function evaluateKidsRun(input: {
  readonly mission: MissionDefinition;
  readonly result: RunResult;
}): KidsRunEvaluation {
  const start = worldToCell(input.mission.starterStage.sprite as { x: number; y: number });
  const goal = worldToCell(input.mission.starterStage.goal as { x: number; y: number });
  const ends: readonly WorldState[] = input.result.trace.map((entry) => entry.worldAfter);

  const trail: KidsCell[] = [start];
  let current = start;
  let heading = compass(input.mission.starterStage.sprite?.heading ?? 0);
  let wallAt: KidsCell | undefined;

  for (const world of ends) {
    const next = worldToCell(world.sprite);
    heading = compass(world.sprite.heading);
    for (const cell of cellsBetween(current, next)) {
      if (!insideGrid(cell)) {
        wallAt = cell;
        break;
      }
      trail.push(cell);
      current = cell;
    }
    if (wallAt !== undefined) {
      break;
    }
  }

  let outcome: KidsOutcome;
  if (wallAt !== undefined) {
    outcome = "wall";
  } else if (sameCell(current, goal)) {
    outcome = "success";
  } else if (trail.some((cell) => sameCell(cell, goal))) {
    outcome = "passed";
  } else {
    outcome = "short";
  }
  return {
    outcome,
    trail,
    final: current,
    heading,
    ...(wallAt === undefined ? {} : { wallAt }),
  };
}
