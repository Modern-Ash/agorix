import type { OriSharedPedagogicalContext } from "./oriSharedPedagogicalContext.js";
import { validateOriSharedPedagogicalContext } from "./oriSharedPedagogicalContext.js";

/**
 * Separate neutral scenario metadata from tutor-specific outcome evidence.
 * Never send deterministicKind to Ori: it is a potential answer leak.
 * No network transport or child-facing integration is introduced.
 */
export interface OriNeutralEvaluationContext {
  readonly schema: "agorix/ori-neutral-evaluation-context/v1";
  readonly missionId: string;
  readonly missionIndex: number;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly scriptCount: number;
  readonly programFingerprint: string;
}
export interface OriTutorSpecificEvidence {
  readonly schema: "agorix/ori-deterministic-evidence/v1";
  readonly missionId: string;
  readonly deterministicKind: OriSharedPedagogicalContext["deterministicKind"];
}
export interface OriSeparatedEvaluationContext {
  readonly neutral: OriNeutralEvaluationContext;
  readonly evidence: OriTutorSpecificEvidence;
}
export function separateOriEvaluationContext(
  value: unknown,
): OriSeparatedEvaluationContext | null {
  const context = validateOriSharedPedagogicalContext(value);
  if (!context) return null;
  const neutral: OriNeutralEvaluationContext = Object.freeze({
    schema: "agorix/ori-neutral-evaluation-context/v1",
    missionId: context.missionId,
    missionIndex: context.missionIndex,
    hintLevel: context.hintLevel,
    scriptCount: context.scriptCount,
    programFingerprint: context.programFingerprint,
  });
  const evidence: OriTutorSpecificEvidence = Object.freeze({
    schema: "agorix/ori-deterministic-evidence/v1",
    missionId: context.missionId,
    deterministicKind: context.deterministicKind,
  });
  return Object.freeze({ neutral, evidence });
}
