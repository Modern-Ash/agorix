import type { ProjectProgram, Statement } from "@agorix/program-model";

/**
 * Kids mastery stages (docs/superpowers/specs/2026-10-26-kids-mastery-stages-design.md).
 *
 * Six concepts, six stages each, moved only by deterministic evidence. Everything here is a pure
 * function of small counters, so every transition can be proved by a test, and nothing the child
 * typed or built is kept: only counters, a stage, and the last changes with a day and a reason code.
 */
export const MASTERY_VERSION = 1;

export const MASTERY_CONCEPTS = [
  "programming.sequence",
  "programming.events",
  "programming.repetition",
  "programming.conditions",
  "programming.state.variables",
  "programming.decomposition.functions",
] as const;
export type MasteryConcept = (typeof MASTERY_CONCEPTS)[number];

/** 0 means no evidence yet; 1 to 6 are Descubre, Imita, Prueba, Crea, Explica, Enseña. */
export const MASTERY_STAGE_NAMES = [
  "discover",
  "imitate",
  "try",
  "create",
  "explain",
  "teach",
] as const;
export type MasteryStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MASTERY_REASONS = [
  "first-run",
  "helped-run",
  "independent-runs",
  "free-creation",
  "explained",
  "reused-block",
  "struggling",
  "recovered",
] as const;
export type MasteryReason = (typeof MASTERY_REASONS)[number];

export const COUNTER_CAP = 99;
export const LOG_LIMIT = 20;
/** Failed runs in a row, with no success in between, that lower a stage by one. */
export const STRUGGLE_RUNS = 3;

export interface MasteryCounts {
  /** Completed runs that use the concept. */
  readonly runs: number;
  readonly helpedRuns: number;
  readonly independentRuns: number;
  /** Completed free creations without help. */
  readonly creations: number;
  /** Predictions and reflections about it that matched the run. */
  readonly explained: number;
  /** Custom blocks that use it and were called at least twice. */
  readonly reused: number;
  readonly failedRuns: number;
}

export interface MasteryChange {
  /** A local day, `YYYY-MM-DD`; the time of day is never kept. */
  readonly day: string;
  readonly from: MasteryStage;
  readonly to: MasteryStage;
  readonly because: MasteryReason;
}

export interface ConceptMastery {
  readonly counts: MasteryCounts;
  /** Failed runs in a row since the last completed one. */
  readonly failuresInARow: number;
  readonly stage: MasteryStage;
  readonly log: readonly MasteryChange[];
}

export interface MasteryState {
  readonly version: typeof MASTERY_VERSION;
  readonly concepts: Readonly<Record<MasteryConcept, ConceptMastery>>;
}

export type MasteryEvidence =
  | {
      readonly kind: "run";
      readonly concepts: readonly MasteryConcept[];
      readonly completed: boolean;
      readonly helped: boolean;
      readonly free: boolean;
    }
  | { readonly kind: "explained"; readonly concepts: readonly MasteryConcept[] }
  | { readonly kind: "reuse"; readonly concepts: readonly MasteryConcept[] };

const ZERO: MasteryCounts = {
  runs: 0,
  helpedRuns: 0,
  independentRuns: 0,
  creations: 0,
  explained: 0,
  reused: 0,
  failedRuns: 0,
};

function emptyConcept(): ConceptMastery {
  return { counts: ZERO, failuresInARow: 0, stage: 0, log: [] };
}

export function emptyMastery(): MasteryState {
  return {
    version: MASTERY_VERSION,
    concepts: Object.fromEntries(
      MASTERY_CONCEPTS.map((concept) => [concept, emptyConcept()]),
    ) as Record<MasteryConcept, ConceptMastery>,
  };
}

// --- which concepts a program uses -------------------------------------------------------------

function inBody(statements: readonly Statement[], into: Set<MasteryConcept>): void {
  for (const statement of statements) {
    switch (statement.type) {
      case "repeat":
      case "repeatUntil":
        into.add("programming.repetition");
        inBody(statement.body, into);
        break;
      case "if":
        into.add("programming.conditions");
        inBody(statement.then, into);
        inBody(statement.else ?? [], into);
        break;
      case "setVariable":
      case "changeVariable":
        into.add("programming.state.variables");
        break;
      case "broadcast":
        into.add("programming.events");
        break;
      case "callProcedure":
        into.add("programming.decomposition.functions");
        break;
      default:
        break;
    }
  }
}

/** The concepts the child's program uses, read from the canonical program only. */
export function conceptsOfProgram(program: ProjectProgram): readonly MasteryConcept[] {
  const found = new Set<MasteryConcept>();
  for (const script of program.scripts) {
    if (script.statements.length >= 2) found.add("programming.sequence");
    if (script.trigger.type !== "greenFlag" && script.trigger.type !== "onStart")
      found.add("programming.events");
    inBody(script.statements, found);
    for (const procedure of script.procedures ?? []) inBody(procedure.body, found);
  }
  return MASTERY_CONCEPTS.filter((concept) => found.has(concept));
}

function callsOf(statements: readonly Statement[], procedureId: string): number {
  let total = 0;
  for (const statement of statements) {
    if (statement.type === "callProcedure" && statement.procedureId === procedureId) total += 1;
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      total += callsOf(statement.body, procedureId);
    if (statement.type === "if")
      total += callsOf(statement.then, procedureId) + callsOf(statement.else ?? [], procedureId);
  }
  return total;
}

/** The concepts used inside custom blocks that the program calls at least twice. */
export function reusedConcepts(program: ProjectProgram): readonly MasteryConcept[] {
  const found = new Set<MasteryConcept>();
  for (const script of program.scripts) {
    for (const procedure of script.procedures ?? []) {
      const calls =
        callsOf(script.statements, procedure.id) +
        (script.procedures ?? []).reduce((sum, item) => sum + callsOf(item.body, procedure.id), 0);
      if (calls < 2) continue;
      const inside = new Set<MasteryConcept>();
      inBody(procedure.body, inside);
      if (procedure.body.length >= 2) inside.add("programming.sequence");
      for (const concept of inside) found.add(concept);
    }
  }
  return MASTERY_CONCEPTS.filter((concept) => found.has(concept));
}

// --- the rules ---------------------------------------------------------------------------------

/** The highest rung the counters earn; a higher rung implies the lower ones. */
export function rungOf(counts: MasteryCounts): MasteryStage {
  if (counts.reused >= 1) return 6;
  if (counts.explained >= 1) return 5;
  if (counts.creations >= 1) return 4;
  if (counts.independentRuns >= 2) return 3;
  if (counts.helpedRuns >= 1 || counts.independentRuns >= 1) return 2;
  if (counts.runs >= 1) return 1;
  return 0;
}

/** The stage: the rung earned, one lower while the child is struggling with the concept. */
export function stageOf(counts: MasteryCounts, failuresInARow: number): MasteryStage {
  const rung = rungOf(counts);
  if (rung >= 3 && failuresInARow >= STRUGGLE_RUNS) return (rung - 1) as MasteryStage;
  return rung;
}

function reasonFor(
  before: ConceptMastery,
  after: ConceptMastery,
  stage: MasteryStage,
): MasteryReason {
  if (stage < before.stage) return "struggling";
  if (after.failuresInARow === 0 && before.failuresInARow >= STRUGGLE_RUNS) return "recovered";
  switch (stage) {
    case 1:
      return "first-run";
    case 2:
      return "helped-run";
    case 3:
      return "independent-runs";
    case 4:
      return "free-creation";
    case 5:
      return "explained";
    default:
      return "reused-block";
  }
}

const bump = (value: number, by = 1): number => Math.min(COUNTER_CAP, value + by);

function applyTo(before: ConceptMastery, evidence: MasteryEvidence, day: string): ConceptMastery {
  let counts = before.counts;
  let failuresInARow = before.failuresInARow;
  if (evidence.kind === "run") {
    if (evidence.completed) {
      counts = {
        ...counts,
        runs: bump(counts.runs),
        helpedRuns: evidence.helped ? bump(counts.helpedRuns) : counts.helpedRuns,
        independentRuns: evidence.helped ? counts.independentRuns : bump(counts.independentRuns),
        creations: evidence.free && !evidence.helped ? bump(counts.creations) : counts.creations,
      };
      failuresInARow = 0;
    } else {
      counts = { ...counts, failedRuns: bump(counts.failedRuns) };
      failuresInARow = Math.min(COUNTER_CAP, failuresInARow + 1);
    }
  } else if (evidence.kind === "explained") {
    counts = { ...counts, explained: bump(counts.explained) };
  } else {
    counts = { ...counts, reused: bump(counts.reused) };
  }
  const stage = stageOf(counts, failuresInARow);
  const after: ConceptMastery = { counts, failuresInARow, stage, log: before.log };
  if (stage === before.stage) return after;
  const change: MasteryChange = {
    day,
    from: before.stage,
    to: stage,
    because: reasonFor(before, after, stage),
  };
  return { ...after, log: [...before.log, change].slice(-LOG_LIMIT) };
}

/** Add one piece of evidence. Pure: the old state is never changed. */
export function applyEvidence(
  state: MasteryState,
  evidence: MasteryEvidence,
  day: string,
): MasteryState {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError("day must be YYYY-MM-DD");
  const touched = new Set(evidence.concepts);
  return {
    version: MASTERY_VERSION,
    concepts: Object.fromEntries(
      MASTERY_CONCEPTS.map((concept) => [
        concept,
        touched.has(concept)
          ? applyTo(state.concepts[concept], evidence, day)
          : state.concepts[concept],
      ]),
    ) as Record<MasteryConcept, ConceptMastery>,
  };
}

// --- reading what was stored -------------------------------------------------------------------

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= COUNTER_CAP
    ? value
    : null;
}

/**
 * A stored state, checked field by field. Anything else, including an older version, is read as empty
 * so a rule change never rewrites history by guesswork, and nothing but known fields can come back.
 */
export function readMastery(raw: unknown): MasteryState {
  try {
    if (typeof raw !== "object" || raw === null) return emptyMastery();
    const input = raw as { version?: unknown; concepts?: unknown };
    if (input.version !== MASTERY_VERSION || typeof input.concepts !== "object" || !input.concepts)
      return emptyMastery();
    const stored = input.concepts as Record<string, unknown>;
    const concepts = {} as Record<MasteryConcept, ConceptMastery>;
    for (const concept of MASTERY_CONCEPTS) {
      const item = stored[concept] as
        { counts?: Record<string, unknown>; failuresInARow?: unknown; log?: unknown } | undefined;
      if (!item?.counts) {
        concepts[concept] = emptyConcept();
        continue;
      }
      const counts = {} as Record<keyof MasteryCounts, number>;
      for (const key of Object.keys(ZERO) as (keyof MasteryCounts)[]) {
        const value = whole(item.counts[key]);
        if (value === null) throw new RangeError("invalid counter");
        counts[key] = value;
      }
      const failures = whole(item.failuresInARow);
      if (failures === null || !Array.isArray(item.log) || item.log.length > LOG_LIMIT)
        throw new RangeError("invalid concept");
      const log = item.log.map((entry): MasteryChange => {
        const change = entry as Partial<MasteryChange>;
        if (
          typeof change.day !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(change.day) ||
          !Number.isInteger(change.from) ||
          !Number.isInteger(change.to) ||
          change.from! < 0 ||
          change.from! > 6 ||
          change.to! < 0 ||
          change.to! > 6 ||
          !(MASTERY_REASONS as readonly unknown[]).includes(change.because)
        )
          throw new RangeError("invalid change");
        return {
          day: change.day,
          from: change.from as MasteryStage,
          to: change.to as MasteryStage,
          because: change.because as MasteryReason,
        };
      });
      // The stage is derived, never trusted: it is recomputed from the counters.
      concepts[concept] = {
        counts,
        failuresInARow: failures,
        stage: stageOf(counts, failures),
        log,
      };
    }
    return { version: MASTERY_VERSION, concepts };
  } catch {
    return emptyMastery();
  }
}

// --- explaining it -----------------------------------------------------------------------------

const STAGE_LABEL = {
  es: ["Sin empezar", "Descubre", "Imita", "Prueba", "Crea", "Explica", "Enseña"],
  en: ["Not started", "Discover", "Imitate", "Try", "Create", "Explain", "Teach"],
} as const;

export function masteryStageLabel(stage: MasteryStage, locale: "es" | "en"): string {
  return STAGE_LABEL[locale][stage];
}

const REASON_TEXT = {
  es: {
    "first-run": "completó una corrida con este concepto",
    "helped-run": "completó una corrida con ayuda",
    "independent-runs": "completó dos corridas sin ayuda",
    "free-creation": "lo usó sin ayuda en una creación libre",
    explained: "acertó una predicción o reflexión sobre él",
    "reused-block": "lo reutilizó en un bloque propio",
    struggling: `volvió un paso tras ${STRUGGLE_RUNS} corridas seguidas sin completar`,
    recovered: "recuperó la etapa al completar una corrida",
  },
  en: {
    "first-run": "completed a run with this concept",
    "helped-run": "completed a run with help",
    "independent-runs": "completed two runs without help",
    "free-creation": "used it without help in a free creation",
    explained: "got a prediction or reflection about it right",
    "reused-block": "reused it in a block of their own",
    struggling: `went back one step after ${STRUGGLE_RUNS} runs in a row that did not finish`,
    recovered: "got the stage back by completing a run",
  },
} as const;

/** Plain sentences about one concept, read from the counters and the last changes. */
export function explainMastery(concept: ConceptMastery, locale: "es" | "en"): readonly string[] {
  const es = locale === "es";
  const { counts } = concept;
  const lines = [
    es
      ? `Etapa: ${masteryStageLabel(concept.stage, "es")}. Corridas completas: ${counts.runs} (${counts.independentRuns} sin ayuda, ${counts.helpedRuns} con ayuda).`
      : `Stage: ${masteryStageLabel(concept.stage, "en")}. Completed runs: ${counts.runs} (${counts.independentRuns} without help, ${counts.helpedRuns} with help).`,
  ];
  for (const change of concept.log.slice(-3))
    lines.push(
      `${change.day}: ${masteryStageLabel(change.from, locale)} → ${masteryStageLabel(change.to, locale)}, ${REASON_TEXT[locale][change.because]}.`,
    );
  return lines;
}
