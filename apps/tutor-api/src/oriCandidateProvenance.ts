import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";
import type { OriDeterministicCandidate } from "./oriEducatorCandidateCapture.js";

/**
 * Explicit evidence manifest for offline deterministic-tutor baseline capture.
 * This verifies metadata consistency, not the truth of an external provenance claim.
 */
export interface OriBaselineEvidence {
  readonly fixtureId: string;
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly source: "agorix-deterministic-tutor";
  readonly captureRef: string;
  readonly hint: string;
  readonly nextStep: string;
}
export function validateOriBaselineEvidence(
  records: readonly OriBaselineEvidence[],
): readonly OriDeterministicCandidate[] | null {
  if (!Array.isArray(records) || records.length !== oriPedagogicalFixtures.length) return null;
  const fixtures = new Map(oriPedagogicalFixtures.map((fixture) => [fixture.id, fixture]));
  const seen = new Set<string>();
  const output: OriDeterministicCandidate[] = [];
  for (const record of records) {
    if (!record || typeof record !== "object" || seen.has(record.fixtureId)) return null;
    const fixture = fixtures.get(record.fixtureId);
    if (!fixture || record.source !== "agorix-deterministic-tutor") return null;
    if (record.missionIndex !== fixture.missionIndex || record.hintLevel !== fixture.hintLevel)
      return null;
    if (
      typeof record.captureRef !== "string" ||
      !/^[a-zA-Z0-9._/-]{8,128}$/.test(record.captureRef)
    )
      return null;
    if (
      typeof record.hint !== "string" ||
      record.hint.trim().length < 8 ||
      record.hint.length > 180 ||
      typeof record.nextStep !== "string" ||
      record.nextStep.trim().length < 8 ||
      record.nextStep.length > 140
    )
      return null;
    seen.add(record.fixtureId);
    output.push(
      Object.freeze({
        fixtureId: record.fixtureId,
        hint: record.hint,
        nextStep: record.nextStep,
      }),
    );
  }
  return Object.freeze(output);
}
