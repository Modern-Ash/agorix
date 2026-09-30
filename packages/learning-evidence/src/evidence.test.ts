import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_LEVELS,
  EVIDENCE_EVENT_SCHEMA_VERSION,
  LearningEvidenceValidationError,
  PROHIBITED_EVIDENCE_FIELDS,
  RETENTION_CLASSES,
  assertCompetencyTraceCoverage,
  assertRetentionCoverage,
  describeRetention,
  peakAssistance,
  validateEvidenceEvent,
  validateEvidenceEvents,
  type LearningEvidenceEvent,
} from "./index.js";

const base = {
  schema: EVIDENCE_EVENT_SCHEMA_VERSION,
  id: "ev-1",
  sequence: 1,
  assistanceLevel: "independent",
} as const;

const prediction = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...base,
  kind: "predictionMade",
  prediction: "reachGoal",
  matchedRuntimeOutcome: true,
  ...overrides,
});

describe("validateEvidenceEvent", () => {
  it("accepts a well-formed event", () => {
    const validated = validateEvidenceEvent(prediction());
    expect(validated.kind).toBe("predictionMade");
  });

  it("rejects a wrong schema version", () => {
    expect(() => validateEvidenceEvent({ ...prediction(), schema: "agorix/other/v1" })).toThrow(
      LearningEvidenceValidationError,
    );
  });

  it("rejects a non-object", () => {
    expect(() => validateEvidenceEvent("nope")).toThrow(/expected evidence event object/);
  });

  it("rejects unknown fields", () => {
    expect(() => validateEvidenceEvent({ ...prediction(), surprise: true })).toThrow(
      /UNKNOWN_FIELD/,
    );
  });

  it("rejects an out-of-range sequence", () => {
    expect(() => validateEvidenceEvent(prediction({ sequence: -1 }))).toThrow(
      /non-negative integer/,
    );
  });

  it("rejects an unknown assistance level", () => {
    expect(() => validateEvidenceEvent(prediction({ assistanceLevel: "psychic" }))).toThrow(
      /expected one of/,
    );
  });

  it("rejects an unknown event kind", () => {
    expect(() => validateEvidenceEvent({ ...base, kind: "vibeChecked" })).toThrow(
      /expected one of/,
    );
  });

  it("rejects reflection content retention", () => {
    expect(() =>
      validateEvidenceEvent({
        ...base,
        kind: "reflectionRecorded",
        reflectionKind: "decision",
        storage: "localEphemeral",
        contentRetained: true,
      }),
    ).toThrow(/must not be retained/);
  });

  it("rejects non-local reflection storage", () => {
    expect(() =>
      validateEvidenceEvent({
        ...base,
        kind: "reflectionRecorded",
        reflectionKind: "decision",
        storage: "remote",
        contentRetained: false,
      }),
    ).toThrow(/localEphemeral/);
  });
});

describe("privacy constraints", () => {
  it.each(PROHIBITED_EVIDENCE_FIELDS)("rejects the %s field", (field) => {
    expect(() => validateEvidenceEvent({ ...prediction(), [field]: "x" })).toThrow(
      /PROHIBITED_FIELD/,
    );
  });

  it("rejects timing fields that would encode speed", () => {
    expect(() => validateEvidenceEvent({ ...prediction(), elapsedMs: 1200 })).toThrow(
      /PROHIBITED_FIELD/,
    );
  });

  it("rejects AI-usage counters", () => {
    expect(() => validateEvidenceEvent({ ...prediction(), promptCount: 40 })).toThrow(
      /PROHIBITED_FIELD/,
    );
  });

  it("rejects raw model confidence", () => {
    expect(() => validateEvidenceEvent({ ...prediction(), modelConfidence: 0.98 })).toThrow(
      /PROHIBITED_FIELD/,
    );
  });
});

describe("retention documentation", () => {
  it("covers every evidence field", () => {
    expect(() => assertRetentionCoverage()).not.toThrow();
  });

  it("describes each field with a known retention class", () => {
    for (const entry of describeRetention()) {
      expect(RETENTION_CLASSES).toContain(entry.retention);
      expect(entry.purpose).not.toBe("Undocumented field.");
    }
  });

  it("keeps reflection content out of stored retention classes", () => {
    const contentFields = describeRetention().filter((entry) =>
      ["text", "freeText", "transcript"].includes(entry.field),
    );
    expect(contentFields).toHaveLength(0);
  });
});

describe("competency trace", () => {
  it("maps every event kind to known #70 competencies and covers the catalog", () => {
    expect(() => assertCompetencyTraceCoverage()).not.toThrow();
  });
});

describe("validateEvidenceEvents", () => {
  it("rejects a non-array", () => {
    expect(() => validateEvidenceEvents({})).toThrow(/expected array/);
  });

  it("reports the failing index in the path", () => {
    expect(() => validateEvidenceEvents([prediction(), { ...prediction(), id: "" }])).toThrow(
      /\$\[1\]\$\.id/,
    );
  });

  it("validates each element", () => {
    const events: unknown[] = [prediction(), prediction({ id: "ev-2", sequence: 2 })];
    const validated = validateEvidenceEvents(events) as readonly LearningEvidenceEvent[];
    expect(validated).toHaveLength(2);
  });
});

describe("peakAssistance", () => {
  it("reports the most AI-led level present", () => {
    const events = validateEvidenceEvents([
      prediction({ assistanceLevel: "independent" }),
      prediction({ id: "ev-2", sequence: 2, assistanceLevel: "delegated" }),
      prediction({ id: "ev-3", sequence: 3, assistanceLevel: "hinted" }),
    ]);
    expect(peakAssistance(events)).toBe("delegated");
  });

  it("defaults to independent for an empty history", () => {
    expect(peakAssistance([])).toBe("independent");
  });

  it("orders assistance from learner-led to AI-led", () => {
    expect(ASSISTANCE_LEVELS).toEqual(["independent", "hinted", "proposed", "delegated"]);
  });
});
