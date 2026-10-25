import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";

/**
 * Evidence-only alignment check. A comparable study requires both candidates
 * to share a canonical Kids mission and the same synthetic program context.
 * It does not claim that the two providers produce equivalent output types.
 */
export interface OriComparableCase {
  readonly fixtureId: string;
  readonly missionId: string;
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly scriptCount: number;
  readonly programFingerprint: string;
}
export function validateOriComparableContext(
  cases: readonly OriComparableCase[],
): readonly OriComparableCase[] | null {
  if (!Array.isArray(cases) || cases.length === 0 || cases.length > 5) return null;
  const fixtures = new Map(oriPedagogicalFixtures.map((fixture) => [fixture.id, fixture]));
  const seen = new Set<string>();
  const validated: OriComparableCase[] = [];
  for (const entry of cases) {
    if (!entry || typeof entry !== "object" || seen.has(entry.fixtureId)) return null;
    const fixture = fixtures.get(entry.fixtureId);
    if (!fixture || entry.missionIndex !== fixture.missionIndex || entry.hintLevel !== fixture.hintLevel)
      return null;
    if (
      !Number.isSafeInteger(entry.missionIndex) ||
      entry.missionIndex < 0 ||
      entry.missionIndex >= KIDS_MISSION_IDS.length ||
      KIDS_MISSION_IDS[entry.missionIndex] !== entry.missionId
    ) return null;
    if (!Number.isSafeInteger(entry.scriptCount) || entry.scriptCount < 0 || entry.scriptCount > 1000)
      return null;
    if (typeof entry.programFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(entry.programFingerprint))
      return null;
    seen.add(entry.fixtureId);
    validated.push(Object.freeze({ ...entry }));
  }
  return Object.freeze(validated);
}
