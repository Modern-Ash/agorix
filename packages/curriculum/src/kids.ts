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

function ladder(hints: KidsCopy["hints"]): readonly MissionHint[] {
  return hints.map((text, index) => ({
    level: (index + 1) as MissionHint["level"],
    text,
  }));
}

function buildMission(spec: KidsMissionSpec, locale: SupportedLocale): MissionDefinition {
  const copy = COPY[spec.id]?.[locale];
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

export function getKidsMission(id: string, locale: string | undefined): MissionDefinition {
  const spec = SPECS.find((candidate) => candidate.id === id);
  if (spec === undefined) {
    throw new RangeError(`unknown kids mission: ${id}`);
  }
  return buildMission(spec, normalizeLocale(locale));
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
