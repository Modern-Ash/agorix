import {
  EVIDENCE_EVENT_SCHEMA_VERSION,
  validateEvidenceEvent,
  type LearningEvidenceEvent,
  type AssistanceLevel,
  type ProposalDecision,
  type ReflectionKind,
  type RevisionKind,
  type ScaffoldKind,
} from "@agorix/learning-evidence";

// Retain the existing session key so reflections recorded before Kids 07 remain visible.
const KEY = "agorix.kids.reflections.v1";

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): SessionStorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readKidsEvidenceEvents(
  storage: SessionStorageLike | undefined = defaultStorage(),
): readonly LearningEvidenceEvent[] {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => validateEvidenceEvent(item)) : [];
  } catch {
    return [];
  }
}

type EventInput = LearningEvidenceEvent extends infer Event
  ? Event extends LearningEvidenceEvent
    ? Omit<Event, "schema" | "id" | "sequence">
    : never
  : never;

function record(input: EventInput, storage: SessionStorageLike | undefined): LearningEvidenceEvent {
  const prior = readKidsEvidenceEvents(storage);
  const sequence = (prior.at(-1)?.sequence ?? 0) + 1;
  const event = validateEvidenceEvent({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: `kids-evidence-${sequence}`,
    sequence,
    ...input,
  });
  try {
    storage?.setItem(KEY, JSON.stringify([...prior.slice(-99), event]));
  } catch {
    // The interaction remains usable without session storage.
  }
  return event;
}

export function recordKidsPrediction(
  answer: "yes" | "no" | "dunno",
  outcome: "success" | "wall" | "passed" | "short",
  storage: SessionStorageLike | undefined = defaultStorage(),
  assistanceLevel: AssistanceLevel = "independent",
) {
  if (answer === "dunno") return null;
  const prediction =
    answer === "yes" ? "reachGoal" : answer === "no" ? "notReachGoal" : "runtimeError";
  return record(
    {
      kind: "predictionMade",
      assistanceLevel,
      prediction,
      matchedRuntimeOutcome: (answer === "yes") === (outcome === "success"),
    },
    storage,
  );
}

export function recordKidsRevision(
  revisionKind: RevisionKind,
  changedNodeCount: number,
  afterUnsuccessfulRun: boolean,
  storage: SessionStorageLike | undefined = defaultStorage(),
  assistanceLevel: AssistanceLevel = "independent",
) {
  return record(
    {
      kind: "programRevisedAfterExecution",
      assistanceLevel,
      revisionKind,
      changedNodeCount,
      afterUnsuccessfulRun,
    },
    storage,
  );
}

/** Called only by a learner decision on a visible proposal (Kids 08). */
export function recordKidsProposalDecision(
  decision: ProposalDecision,
  inspectedDiff: boolean,
  testedWithRuntime: boolean,
  storage: SessionStorageLike | undefined = defaultStorage(),
) {
  return record(
    {
      kind: "proposalDecided",
      assistanceLevel: "proposed",
      decision,
      inspectedDiff,
      testedWithRuntime,
      challengedCompanion: decision !== "accept",
    },
    storage,
  );
}

/** Called when the child opens a ladder hint (Kids 08). */
export function recordKidsScaffold(
  scaffoldKind: ScaffoldKind,
  level: 1 | 2 | 3 | 4 | 5,
  storage: SessionStorageLike | undefined = defaultStorage(),
) {
  return record(
    {
      kind: "scaffoldDelivered",
      assistanceLevel: scaffoldKind === "solution" ? "delegated" : "hinted",
      scaffoldKind,
      level,
      answeredByLearner: false,
    },
    storage,
  );
}

/** Records only the choice category; child language and feeling remain in UI state. */
export function recordKidsReflection(
  kind: ReflectionKind,
  storage: SessionStorageLike | undefined = defaultStorage(),
) {
  return record(
    {
      kind: "reflectionRecorded",
      assistanceLevel: "independent",
      reflectionKind: kind,
      storage: "localEphemeral",
      contentRetained: false,
    },
    storage,
  );
}
