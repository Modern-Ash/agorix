import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";

/**
 * MIG-03 semantic compatibility preflight.
 * The legacy Kids rule engine returns action offers (move/turn/repeat/etc.),
 * while Ori /v1/plan returns a pedagogical plan. Comparing their "kind"
 * strings as though they represented the same behavior would be misleading.
 */
export interface OriBaselineCompatibility {
  readonly baselineSource: "agorix-deterministic-rule";
  readonly candidateSource: "ori-shadow-plan-v1";
  readonly comparable: false;
  readonly reason: "different-output-semantics";
  readonly capturedMissions: number;
  readonly allStarterProgramsUnchanged: boolean;
}

export function inspectOriBaselineCompatibility(): OriBaselineCompatibility {
  const records = captureOriDeterministicBaseline();
  return Object.freeze({
    baselineSource: "agorix-deterministic-rule",
    candidateSource: "ori-shadow-plan-v1",
    comparable: false,
    reason: "different-output-semantics",
    capturedMissions: records.length,
    allStarterProgramsUnchanged: records.every((record) => record.starterProgramUnchanged),
  });
}
