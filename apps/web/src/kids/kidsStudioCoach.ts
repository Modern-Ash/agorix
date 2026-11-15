import type { ProjectCreativeState, ProjectProgram } from "@agorix/program-model";
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import type { AgeBand } from "./kidsAgeBand.js";
import type { Locale } from "../i18n.js";

/**
 * Ori looks at what a run really did (issues #603 to #606). Everything here is read from the
 * runtime's own trace and final state; nothing is guessed, and a sentence is only written when the
 * trace shows it.
 */

export const DIRECTIONS = ["right", "left", "up", "down", "stay"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const DIRECTION_LABEL: Record<Locale, Record<Direction, string>> = {
  es: {
    right: "a la derecha",
    left: "a la izquierda",
    up: "arriba",
    down: "abajo",
    stay: "se queda donde está",
  },
  en: {
    right: "to the right",
    left: "to the left",
    up: "up",
    down: "down",
    stay: "stays where it is",
  },
};

interface Point {
  readonly x: number;
  readonly y: number;
}

/** On the stage a larger y is lower on the screen. A small wobble counts as staying. */
export function directionBetween(from: Point, to: Point): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return "stay";
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export interface ActorFacts {
  readonly steps: number;
  /** How many copies of this actor are on the stage when the run ends. */
  readonly copies: number;
  readonly start: Point;
  readonly end: Point;
  readonly direction: Direction;
  /** Statement types that moved this actor, in the order they did. */
  readonly movedBy: readonly string[];
  /** First step where a move did not change the position. */
  readonly stuckAt: { readonly step: number; readonly type: string } | null;
  readonly condition: { readonly yes: number; readonly no: number };
  readonly outcome: string;
  readonly lastStep: { readonly step: number; readonly type: string } | null;
}

const BLOCK_NAME: Record<Locale, Record<string, string>> = {
  es: {
    move: "Mover",
    turn: "Girar",
    goTo: "Ir a",
    nextCostume: "Siguiente disfraz",
    goToTarget: "Ir a",
    createCopies: "Crear copias",
    setText: "Guardar palabra",
    setRotationStyle: "Estilo de giro",
    setX: "Fijar x",
    setY: "Fijar y",
    changeX: "Cambiar x",
    changeY: "Cambiar y",
    glideTo: "Deslizar a",
    pointInDirection: "Apuntar hacia",
    pointTowards: "Apuntar a",
    bounceOnEdge: "Rebotar en el borde",
    say: "Decir",
    think: "Pensar",
    wait: "Esperar",
    repeat: "Repetir",
    repeatUntil: "Repetir hasta",
    if: "Si",
    playSound: "Sonar",
    callProcedure: "Mi bloque",
  },
  en: {
    move: "Move",
    turn: "Turn",
    goTo: "Go to",
    nextCostume: "Next costume",
    goToTarget: "Go to",
    createCopies: "Make copies",
    setText: "Save word",
    setRotationStyle: "Rotation style",
    setX: "Set x",
    setY: "Set y",
    changeX: "Change x",
    changeY: "Change y",
    glideTo: "Glide to",
    pointInDirection: "Point toward",
    pointTowards: "Point at",
    bounceOnEdge: "Bounce on edge",
    say: "Say",
    think: "Think",
    wait: "Wait",
    repeat: "Repeat",
    repeatUntil: "Repeat until",
    if: "If",
    playSound: "Play sound",
    callProcedure: "My block",
  },
};

/** A block's name as the child sees it on the palette. */
export function blockName(type: string, locale: Locale): string {
  return BLOCK_NAME[locale][type] ?? type;
}

const MOVES = new Set([
  "move",
  "goTo",
  "glideTo",
  "goToTarget",
  "setX",
  "setY",
  "changeX",
  "changeY",
]);

export function factsOfRun(run: MultiActorRunResult, actorId: string): ActorFacts {
  const entries = run.trace.filter((entry) => entry.actorId === actorId);
  const first = entries[0];
  const final = run.actors.find((entry) => entry.id === actorId)?.world.sprite;
  const start = first
    ? { x: first.worldBefore.sprite.x, y: first.worldBefore.sprite.y }
    : { x: final?.x ?? 0, y: final?.y ?? 0 };
  const end = final ? { x: final.x, y: final.y } : start;
  const movedBy: string[] = [];
  let stuckAt: ActorFacts["stuckAt"] = null;
  let yes = 0;
  let no = 0;
  for (const entry of entries) {
    const before = entry.worldBefore.sprite;
    const after = entry.worldAfter.sprite;
    const moved = before.x !== after.x || before.y !== after.y;
    if (MOVES.has(entry.statementType)) {
      if (moved) movedBy.push(entry.statementType);
      else if (!stuckAt) stuckAt = { step: entry.step, type: entry.statementType };
    }
    if (entry.conditionResult === true) yes += 1;
    if (entry.conditionResult === false) no += 1;
  }
  const last = entries.at(-1);
  return {
    steps: entries.length,
    copies: run.actors.find((entry) => entry.id === actorId)?.world.copies?.length ?? 0,
    start: { x: Math.round(start.x), y: Math.round(start.y) },
    end: { x: Math.round(end.x), y: Math.round(end.y) },
    direction: directionBetween(start, end),
    movedBy,
    stuckAt,
    condition: { yes, no },
    outcome: run.outcome,
    lastStep: last ? { step: last.step, type: last.statementType } : null,
  };
}

const OUTCOME: Record<Locale, Record<string, string>> = {
  es: {
    "budget-exceeded": "usó demasiados pasos",
    blocked: "no pudo seguir",
  },
  en: {
    "budget-exceeded": "used too many steps",
    blocked: "could not go on",
  },
};

/** Plain sentences about a run. Each one is backed by the trace. */
export function explainRun(facts: ActorFacts, name: string, locale: Locale): readonly string[] {
  const es = locale === "es";
  const lines: string[] = [];
  if (facts.steps === 0) {
    lines.push(es ? `${name} no ejecutó ningún bloque.` : `${name} ran no blocks.`);
    return lines;
  }
  lines.push(
    es
      ? `${name} ejecutó ${facts.steps} ${facts.steps === 1 ? "bloque" : "bloques"}: empezó en (${facts.start.x}, ${facts.start.y}) y terminó en (${facts.end.x}, ${facts.end.y}).`
      : `${name} ran ${facts.steps} ${facts.steps === 1 ? "block" : "blocks"}: it started at (${facts.start.x}, ${facts.start.y}) and ended at (${facts.end.x}, ${facts.end.y}).`,
  );
  if (facts.condition.yes + facts.condition.no > 0)
    lines.push(
      es
        ? `La condición dio "sí" ${facts.condition.yes} ${facts.condition.yes === 1 ? "vez" : "veces"} y "no" ${facts.condition.no} ${facts.condition.no === 1 ? "vez" : "veces"}.`
        : `The condition said "yes" ${facts.condition.yes} ${facts.condition.yes === 1 ? "time" : "times"} and "no" ${facts.condition.no} ${facts.condition.no === 1 ? "time" : "times"}.`,
    );
  if (facts.stuckAt)
    lines.push(
      es
        ? `En el paso ${facts.stuckAt.step} el bloque "${blockName(facts.stuckAt.type, "es")}" no cambió la posición.`
        : `At step ${facts.stuckAt.step} the "${blockName(facts.stuckAt.type, "en")}" block did not change the position.`,
    );
  if (facts.outcome !== "completed" && facts.lastStep)
    lines.push(
      es
        ? `El programa se detuvo antes de terminar (${OUTCOME.es[facts.outcome] ?? facts.outcome}). Lo último que pasó fue el paso ${facts.lastStep.step}: "${blockName(facts.lastStep.type, "es")}".`
        : `The program stopped before the end (${OUTCOME.en[facts.outcome] ?? facts.outcome}). The last thing that happened was step ${facts.lastStep.step}: "${blockName(facts.lastStep.type, "en")}".`,
    );
  return lines;
}

/** Compare what the child expected with what the run did. */
export function judgePrediction(
  predicted: Direction,
  facts: ActorFacts,
  name: string,
  locale: Locale,
): { readonly match: boolean; readonly text: string } {
  const label = DIRECTION_LABEL[locale];
  const match = predicted === facts.direction;
  const es = locale === "es";
  return {
    match,
    text: match
      ? es
        ? `Pensaste que ${name} iba ${label[predicted]} y pasó eso.`
        : `You thought ${name} would go ${label[predicted]}, and it did.`
      : es
        ? `Pensaste que ${name} iba ${label[predicted]}, pero fue ${label[facts.direction]}.`
        : `You thought ${name} would go ${label[predicted]}, but it went ${label[facts.direction]}.`,
  };
}

/** What a child can be asked to guess as a number, when the program has a block that makes one. */
export type QuantityKind = "copies" | "steps";

/** A number worth guessing: how many copies, or how many blocks run when something repeats. */
export function quantityKindFor(statementTypes: readonly string[]): QuantityKind | null {
  if (statementTypes.includes("createCopies")) return "copies";
  if (statementTypes.includes("repeat") && !statementTypes.includes("forever")) return "steps";
  return null;
}

export const QUANTITY_MAX = 99;

/** The guess against what the run did. The number comes from the run, never from a model. */
export function judgeQuantity(
  kind: QuantityKind,
  predicted: number,
  facts: ActorFacts,
  name: string,
  locale: Locale,
): { readonly match: boolean; readonly text: string } {
  const actual = kind === "copies" ? facts.copies : facts.steps;
  const match = predicted === actual;
  const es = locale === "es";
  const what =
    kind === "copies"
      ? es
        ? `copias de ${name}`
        : `copies of ${name}`
      : es
        ? "bloques ejecutados"
        : "blocks run";
  return {
    match,
    text: match
      ? es
        ? `Pensaste ${predicted} ${what} y fueron ${actual}.`
        : `You thought ${predicted} ${what} and it was ${actual}.`
      : es
        ? `Pensaste ${predicted} ${what}, pero fueron ${actual}.`
        : `You thought ${predicted} ${what}, but it was ${actual}.`,
  };
}

export type RunChange = "place" | "steps" | "copies" | "same";
export const RUN_CHANGES: readonly RunChange[] = ["place", "steps", "copies", "same"];

/** What differs between two runs of one character; all that apply, or `same` when nothing does. */
export function changesBetween(before: ActorFacts, after: ActorFacts): readonly RunChange[] {
  const changes: RunChange[] = [];
  if (Math.abs(before.end.x - after.end.x) >= 1 || Math.abs(before.end.y - after.end.y) >= 1)
    changes.push("place");
  if (before.steps !== after.steps) changes.push("steps");
  if (before.copies !== after.copies) changes.push("copies");
  return changes.length > 0 ? changes : ["same"];
}

export const RUN_CHANGE_LABEL: Record<Locale, Record<RunChange, string>> = {
  es: {
    place: "Terminó en otro lugar",
    steps: "Se ejecutaron otros bloques",
    copies: "Hay otra cantidad de copias",
    same: "Salió igual",
  },
  en: {
    place: "It ended somewhere else",
    steps: "A different number of blocks ran",
    copies: "There are a different number of copies",
    same: "It came out the same",
  },
};

export type Reflection =
  | { readonly kind: "expected"; readonly question: string }
  | {
      readonly kind: "cause";
      readonly question: string;
      readonly options: readonly string[];
      readonly answers: readonly string[];
    }
  | {
      readonly kind: "count";
      readonly question: string;
      readonly options: readonly number[];
      readonly answer: number;
    };

/** One question after the run, simpler for the youngest and closer to the evidence for the oldest. */
export function reflectionFor(
  band: AgeBand,
  facts: ActorFacts,
  blockTypes: readonly string[],
  name: string,
  locale: Locale,
): Reflection | null {
  const es = locale === "es";
  if (facts.steps === 0) return null;
  if (band === "6-8")
    return {
      kind: "expected",
      question: es ? "¿Pasó lo que esperabas?" : "Did what you expected happen?",
    };
  if (band === "9-12") {
    const options = [...new Set(blockTypes)];
    const answers = [...new Set(facts.movedBy)];
    if (options.length < 2 || answers.length === 0) return null;
    return {
      kind: "cause",
      question: es ? `¿Qué bloque movió a ${name}?` : `Which block moved ${name}?`,
      options,
      answers,
    };
  }
  const real = facts.steps;
  const options = [...new Set([real, real + 2, Math.max(1, real - 1)])].sort((a, b) => a - b);
  return {
    kind: "count",
    question: es ? "¿Cuántos bloques se ejecutaron en total?" : "How many blocks ran in total?",
    options,
    answer: real,
  };
}

/** What a program does, in the few words a child hears; used to say what an idea would stop. */
export type BehaviourKind = "motion" | "sound" | "speech" | "drawing";

const BEHAVIOUR_OF_STATEMENT: Readonly<Record<string, BehaviourKind>> = {
  move: "motion",
  goTo: "motion",
  goToTarget: "motion",
  setX: "motion",
  setY: "motion",
  changeX: "motion",
  changeY: "motion",
  glideTo: "motion",
  turn: "motion",
  playSound: "sound",
  playNote: "sound",
  playDrum: "sound",
  say: "speech",
  think: "speech",
  penDown: "drawing",
  stamp: "drawing",
};

function behavioursOf(run: MultiActorRunResult): ReadonlySet<BehaviourKind> {
  const kinds = new Set<BehaviourKind>();
  for (const entry of run.trace) {
    const kind = BEHAVIOUR_OF_STATEMENT[entry.statementType];
    if (kind !== undefined) kinds.add(kind);
  }
  return kinds;
}

/** The same steps ending in the same worlds: running the program gives the learner nothing new. */
function sameRun(before: MultiActorRunResult, after: MultiActorRunResult): boolean {
  return (
    before.trace.length === after.trace.length &&
    before.trace.every((entry, at) => entry.statementType === after.trace[at]!.statementType) &&
    JSON.stringify(before.actors.map((actor) => actor.world)) ===
      JSON.stringify(after.actors.map((actor) => actor.world))
  );
}

export interface CandidatePreview {
  /** Behaviours the program has now and the idea would stop (an idea may take one away on purpose). */
  readonly lost: readonly BehaviourKind[];
  /** The idea changes nothing that happens when the program runs. */
  readonly unchanged: boolean;
  /** How the program ends now, so "the idea stops it" is only said of a program that did end. */
  readonly outcomeBefore: string;
  readonly outcome: string;
  readonly stepsBefore: number;
  readonly stepsAfter: number;
  readonly from: Point;
  readonly to: Point;
}

/**
 * What would really happen with a candidate program: the same deterministic runtime on a copy,
 * next to what the current program does. Nothing is saved (issues #602, #603 and #605).
 */
export function previewCandidate(
  current: ProjectProgram,
  candidate: ProjectProgram,
  creative: ProjectCreativeState,
  actorId: string,
  keysDown: readonly string[],
): CandidatePreview | null {
  const before = runMultiActorProgram(current, creative, { keysDown });
  const after = runMultiActorProgram(candidate, creative, { keysDown });
  const from = before.actors.find((entry) => entry.id === actorId)?.world.sprite;
  const to = after.actors.find((entry) => entry.id === actorId)?.world.sprite;
  if (!from || !to) return null;
  const stillThere = behavioursOf(after);
  return {
    lost: [...behavioursOf(before)].filter((kind) => !stillThere.has(kind)).sort(),
    unchanged: sameRun(before, after),
    outcomeBefore: before.outcome,
    outcome: after.outcome,
    stepsBefore: before.stepsUsed,
    stepsAfter: after.stepsUsed,
    from: { x: Math.round(from.x), y: Math.round(from.y) },
    to: { x: Math.round(to.x), y: Math.round(to.y) },
  };
}

const LOST_WORDS: Readonly<Record<BehaviourKind, readonly [string, string]>> = {
  motion: ["el movimiento", "the movement"],
  sound: ["el sonido", "the sound"],
  speech: ["lo que dice", "what it says"],
  drawing: ["el dibujo", "the drawing"],
};

/**
 * What an idea would change, in the sentences a card adds under "where it would end": that it
 * changes nothing, and what the program does now that it would stop. Empty when there is no
 * surprise to report.
 */
export function ideaPreviewNotes(
  preview: CandidatePreview,
  locale: Locale,
  /** A tidy-up (join repeated blocks) is meant to do exactly what the program did before. */
  options: { readonly meantToDoTheSame?: boolean } = {},
): readonly string[] {
  const es = locale === "es";
  const notes: string[] = [];
  if (options.meantToDoTheSame === true) {
    notes.push(
      preview.unchanged
        ? es
          ? "Lo probé en una copia: el programa hace exactamente lo mismo."
          : "I tried it on a copy: the program does exactly the same."
        : es
          ? "Ojo: probé el cambio en una copia y no hace exactamente lo mismo que antes."
          : "Careful: I tried the change on a copy and it does not do exactly the same as before.",
    );
    return notes;
  }
  if (preview.outcomeBefore === "completed" && preview.outcome !== "completed")
    notes.push(
      es
        ? "Ojo: con esta idea el programa no llega al final. Podés cambiarla o rechazarla."
        : "Careful: with this idea the program does not reach the end. You can change or reject it.",
    );
  if (preview.unchanged)
    notes.push(
      es
        ? "Esta idea no cambia lo que pasa al jugar. Podés usarla igual o rechazarla."
        : "This idea does not change what happens when you play. You can use it anyway or reject it.",
    );
  if (preview.lost.length > 0) {
    const words = preview.lost.map((kind) => LOST_WORDS[kind][es ? 0 : 1]).join(", ");
    notes.push(
      es
        ? `Ojo: con esta idea ya no pasaría ${words}.`
        : `Careful: with this idea this would stop happening: ${words}.`,
    );
  }
  return notes;
}
