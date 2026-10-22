import {
  EVIDENCE_EVENT_SCHEMA_VERSION,
  validateEvidenceEvent,
  type LearningEvidenceEvent,
  type ReflectionKind,
} from "@agorix/learning-evidence";

const KEY = "agorix.kids.reflections.v1";

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

function defaultStorage(): SessionStorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Only a validated event is kept for this browser session; cause copy and feeling stay in UI state. */
export function recordKidsReflection(
  kind: ReflectionKind,
  storage: SessionStorageLike | undefined = defaultStorage(),
): LearningEvidenceEvent {
  const prior = readKidsEvidenceEvents(storage);
  const sequence = (prior.at(-1)?.sequence ?? 0) + 1;
  const event = validateEvidenceEvent({
    schema: EVIDENCE_EVENT_SCHEMA_VERSION,
    id: `kids-reflection-${sequence}`,
    sequence,
    assistanceLevel: "independent",
    kind: "reflectionRecorded",
    reflectionKind: kind,
    storage: "localEphemeral",
    contentRetained: false,
  });
  try {
    storage?.setItem(KEY, JSON.stringify([...prior.slice(-99), event]));
  } catch {
    /* Reflection still counts in the active session when storage is unavailable. */
  }
  return event;
}
