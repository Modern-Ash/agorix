import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { captureOriCanonicalProgramEvidence } from "./oriCanonicalProgramEvidence.js";

/**
 * Experimental synthetic-only shared context. No child program, source code,
 * learner identifier or private prompt is exported to Ori.
 * Not a replacement for Ori /v1/plan or proof of equivalent model context.
 */
export interface OriSharedPedagogicalContext {
  readonly schema: "agorix/ori-shared-pedagogical-context/v1";
  readonly missionId: string;
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly scriptCount: number;
  readonly programFingerprint: string;
  readonly deterministicKind: "move" | "turn" | "repeat" | "done" | "wall" | "passed";
}
export function createOriSharedPedagogicalContexts(
  hintLevel: 1 | 2 | 3 | 4 | 5 = 2,
): readonly OriSharedPedagogicalContext[] {
  if (![1, 2, 3, 4, 5].includes(hintLevel)) throw new RangeError("Invalid pedagogical hint level");
  return Object.freeze(
    captureOriCanonicalProgramEvidence().map((record) =>
      Object.freeze({
        schema: "agorix/ori-shared-pedagogical-context/v1" as const,
        missionId: record.missionId,
        missionIndex: record.missionIndex,
        hintLevel,
        scriptCount: record.scriptCount,
        programFingerprint: record.programFingerprint,
        deterministicKind: record.deterministicKind,
      }),
    ),
  );
}
export function validateOriSharedPedagogicalContext(
  value: unknown,
): OriSharedPedagogicalContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !==
    "deterministicKind,hintLevel,missionId,missionIndex,programFingerprint,schema,scriptCount"
  )
    return null;
  if (record.schema !== "agorix/ori-shared-pedagogical-context/v1") return null;
  if (!Number.isSafeInteger(record.missionIndex)) return null;
  const index = record.missionIndex as number;
  if (index < 0 || index >= KIDS_MISSION_IDS.length || record.missionId !== KIDS_MISSION_IDS[index])
    return null;
  if (![1, 2, 3, 4, 5].includes(record.hintLevel as number)) return null;
  if (
    !Number.isSafeInteger(record.scriptCount) ||
    (record.scriptCount as number) < 0 ||
    (record.scriptCount as number) > 1000
  )
    return null;
  if (
    typeof record.programFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.programFingerprint)
  )
    return null;
  if (
    !["move", "turn", "repeat", "done", "wall", "passed"].includes(String(record.deterministicKind))
  )
    return null;
  return Object.freeze(value as OriSharedPedagogicalContext);
}
