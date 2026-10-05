/**
 * Educator evidence export (issue #251): a summary of ONE session, built from counts only.
 *
 * Rules encoded here: no free text, no paths, no names or accounts, no timestamps, no scores,
 * no model or provider identity. Completion is a runtime fact, never a judgement about
 * understanding. Aggregating across sessions is out of scope and needs separate approval
 * (docs/product/LEARNING_EVIDENCE.md).
 */

export const EDUCATOR_EXPORT_SCHEMA_VERSION = "agorix/educator-evidence/v1";

export type EducatorProposalOrigin = "provider" | "built-in";

/** Structural input: callers map their own event types onto these kinds. */
export interface EducatorEventInput {
  readonly type:
    | "proposalRequested"
    | "proposalAccepted"
    | "proposalRejected"
    | "proposalModified"
    | "alternativeChosen"
    | "predictionMatched"
    | "predictionMismatched"
    | "predictionSkipped"
    | "explainCompleted"
    | "explainSkipped";
  readonly origin?: EducatorProposalOrigin;
}

export interface EducatorExportInput {
  /** Opaque mission identifier, for example "first-mission". */
  readonly missionId: string;
  readonly programHash: string;
  readonly events: readonly EducatorEventInput[];
  /** True when the event buffer reached its cap, so counts may undercount. */
  readonly truncated: boolean;
  readonly agreements: {
    readonly aiEnabled: boolean;
    readonly mode: "supervised" | "bounded";
    readonly assistanceCeiling: number;
    readonly requirePredictionBeforeAccept: boolean;
  };
  readonly ambientOffers: {
    readonly shown: number;
    readonly accepted: number;
    readonly dismissed: number;
    readonly ignored: number;
  };
  /** Set only from deterministic runtime evidence. */
  readonly completedByRuntime: boolean;
}

export interface EducatorEvidenceExport {
  readonly schema: typeof EDUCATOR_EXPORT_SCHEMA_VERSION;
  readonly scope: "single-session";
  readonly truncated: boolean;
  readonly mission: { readonly id: string };
  readonly programHash: string;
  readonly agreements: EducatorExportInput["agreements"];
  readonly proposals: {
    readonly requested: number;
    readonly accepted: number;
    readonly modified: number;
    readonly rejected: number;
    readonly alternativesChosen: number;
    readonly byOrigin: { readonly provider: number; readonly "built-in": number };
  };
  readonly predictions: {
    readonly matched: number;
    readonly mismatched: number;
    readonly skipped: number;
  };
  readonly explanations: { readonly completed: number; readonly skipped: number };
  readonly ambientOffers: EducatorExportInput["ambientOffers"];
  readonly completion: { readonly completedByRuntime: boolean };
}

export class EducatorExportValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "EducatorExportValidationError";
    this.path = path;
  }
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const HASH_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
const MAX_COUNT = 1_000_000;

function count(events: readonly EducatorEventInput[], type: EducatorEventInput["type"]): number {
  return events.filter((event) => event.type === type).length;
}

function clampCount(value: number): number {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, MAX_COUNT) : 0;
}

export function createEducatorEvidenceExport(input: EducatorExportInput): EducatorEvidenceExport {
  const proposalEvents = input.events.filter((event) => event.type === "proposalRequested");
  return validateEducatorEvidenceExport({
    schema: EDUCATOR_EXPORT_SCHEMA_VERSION,
    scope: "single-session",
    truncated: input.truncated,
    mission: { id: input.missionId },
    programHash: input.programHash,
    agreements: { ...input.agreements },
    proposals: {
      requested: count(input.events, "proposalRequested"),
      accepted: count(input.events, "proposalAccepted"),
      modified: count(input.events, "proposalModified"),
      rejected: count(input.events, "proposalRejected"),
      alternativesChosen: count(input.events, "alternativeChosen"),
      byOrigin: {
        provider: proposalEvents.filter((event) => event.origin === "provider").length,
        "built-in": proposalEvents.filter((event) => event.origin !== "provider").length,
      },
    },
    predictions: {
      matched: count(input.events, "predictionMatched"),
      mismatched: count(input.events, "predictionMismatched"),
      skipped: count(input.events, "predictionSkipped"),
    },
    explanations: {
      completed: count(input.events, "explainCompleted"),
      skipped: count(input.events, "explainSkipped"),
    },
    ambientOffers: {
      shown: clampCount(input.ambientOffers.shown),
      accepted: clampCount(input.ambientOffers.accepted),
      dismissed: clampCount(input.ambientOffers.dismissed),
      ignored: clampCount(input.ambientOffers.ignored),
    },
    completion: { completedByRuntime: input.completedByRuntime },
  });
}

type Json = Record<string, unknown>;

function obj(value: unknown, path: string, keys: readonly string[]): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EducatorExportValidationError(path, "expected an object");
  }
  const record = value as Json;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) {
      throw new EducatorExportValidationError(`${path}.${key}`, "unknown field");
    }
  }
  for (const key of keys) {
    if (!(key in record))
      throw new EducatorExportValidationError(`${path}.${key}`, "missing field");
  }
  return record;
}

function counter(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_COUNT) {
    throw new EducatorExportValidationError(path, "expected a bounded non-negative integer");
  }
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new EducatorExportValidationError(path, "expected boolean");
  return value;
}

/** Fails closed: any unknown key or value outside the closed shapes is rejected. */
export function validateEducatorEvidenceExport(value: unknown): EducatorEvidenceExport {
  const root = obj(value, "$", [
    "schema",
    "scope",
    "truncated",
    "mission",
    "programHash",
    "agreements",
    "proposals",
    "predictions",
    "explanations",
    "ambientOffers",
    "completion",
  ]);
  if (root["schema"] !== EDUCATOR_EXPORT_SCHEMA_VERSION) {
    throw new EducatorExportValidationError("$.schema", "unsupported schema");
  }
  if (root["scope"] !== "single-session") {
    throw new EducatorExportValidationError("$.scope", "only a single session may be exported");
  }
  const mission = obj(root["mission"], "$.mission", ["id"]);
  if (typeof mission["id"] !== "string" || !ID_PATTERN.test(mission["id"])) {
    throw new EducatorExportValidationError("$.mission.id", "expected an opaque identifier");
  }
  if (typeof root["programHash"] !== "string" || !HASH_PATTERN.test(root["programHash"])) {
    throw new EducatorExportValidationError("$.programHash", "expected an opaque hash");
  }
  const agreements = obj(root["agreements"], "$.agreements", [
    "aiEnabled",
    "mode",
    "assistanceCeiling",
    "requirePredictionBeforeAccept",
  ]);
  if (agreements["mode"] !== "supervised" && agreements["mode"] !== "bounded") {
    throw new EducatorExportValidationError("$.agreements.mode", "unknown mode");
  }
  const ceiling = counter(agreements["assistanceCeiling"], "$.agreements.assistanceCeiling");
  if (ceiling > 5) throw new EducatorExportValidationError("$.agreements.assistanceCeiling", "0-5");
  bool(agreements["aiEnabled"], "$.agreements.aiEnabled");
  bool(agreements["requirePredictionBeforeAccept"], "$.agreements.requirePredictionBeforeAccept");
  const proposals = obj(root["proposals"], "$.proposals", [
    "requested",
    "accepted",
    "modified",
    "rejected",
    "alternativesChosen",
    "byOrigin",
  ]);
  for (const key of ["requested", "accepted", "modified", "rejected", "alternativesChosen"]) {
    counter(proposals[key], `$.proposals.${key}`);
  }
  const byOrigin = obj(proposals["byOrigin"], "$.proposals.byOrigin", ["provider", "built-in"]);
  counter(byOrigin["provider"], "$.proposals.byOrigin.provider");
  counter(byOrigin["built-in"], "$.proposals.byOrigin.built-in");
  const predictions = obj(root["predictions"], "$.predictions", [
    "matched",
    "mismatched",
    "skipped",
  ]);
  for (const key of ["matched", "mismatched", "skipped"]) {
    counter(predictions[key], `$.predictions.${key}`);
  }
  const explanations = obj(root["explanations"], "$.explanations", ["completed", "skipped"]);
  counter(explanations["completed"], "$.explanations.completed");
  counter(explanations["skipped"], "$.explanations.skipped");
  const offers = obj(root["ambientOffers"], "$.ambientOffers", [
    "shown",
    "accepted",
    "dismissed",
    "ignored",
  ]);
  for (const key of ["shown", "accepted", "dismissed", "ignored"]) {
    counter(offers[key], `$.ambientOffers.${key}`);
  }
  bool(root["truncated"], "$.truncated");
  bool(
    obj(root["completion"], "$.completion", ["completedByRuntime"])["completedByRuntime"],
    "$.completion.completedByRuntime",
  );
  return value as EducatorEvidenceExport;
}

/** Plain-language summary for an educator. States what the numbers do and do not show. */
export function formatEducatorSummary(data: EducatorEvidenceExport): string {
  const p = data.proposals;
  const pr = data.predictions;
  return [
    "# Agorix Studio: session evidence",
    "",
    `Scope: one session. Mission: ${data.mission.id}.${data.truncated ? " Some events were not kept, so counts may be low." : ""}`,
    "",
    "## Working with AI suggestions",
    `- Suggestions requested: ${p.requested} (AI provider: ${p.byOrigin.provider}, built-in: ${p.byOrigin["built-in"]})`,
    `- Accepted as offered: ${p.accepted}. Accepted after choosing parts or editing a value: ${p.modified}. Rejected: ${p.rejected}.`,
    `- Alternatives chosen: ${p.alternativesChosen}`,
    "",
    "## Predicting and explaining",
    `- Predictions that matched the run: ${pr.matched}; did not match: ${pr.mismatched}; skipped: ${pr.skipped}`,
    `- Explanations given: ${data.explanations.completed}; skipped: ${data.explanations.skipped}`,
    "",
    "## Help offered while working",
    `- Offers shown: ${data.ambientOffers.shown}; accepted: ${data.ambientOffers.accepted}; dismissed: ${data.ambientOffers.dismissed}; not answered: ${data.ambientOffers.ignored}`,
    "",
    "## Settings in effect",
    `- AI help: ${data.agreements.aiEnabled ? "on" : "off"}; mode: ${data.agreements.mode}; help level up to ${data.agreements.assistanceCeiling}; prediction required before accepting: ${data.agreements.requirePredictionBeforeAccept ? "yes" : "no"}`,
    "",
    "## Result",
    `- Program reached the goal when run: ${data.completion.completedByRuntime ? "yes" : "no"}`,
    "",
    "Completing the mission is a runtime fact. It does not show that the learner understands, and the counts above are not a grade.",
    "",
  ].join("\n");
}
