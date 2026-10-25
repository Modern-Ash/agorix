import type { OriSingleMessageComparison } from "./oriSingleMessageComparison.js";

/**
 * Explicit separation of educator-facing text from restricted coordinator key.
 * This does not authenticate source provenance or establish equal inputs.
 */
export interface OriEducatorBlindMessages {
  readonly schema: "agorix/ori-blind-messages/v1";
  readonly missionId: string;
  readonly A: string;
  readonly B: string;
  readonly equalInputContextProven: false;
  readonly eligibleForEfficacyClaim: false;
}
export interface OriRestrictedMessageKey {
  readonly missionId: string;
  readonly oriCandidate: "A" | "B";
  readonly deterministicCandidate: "A" | "B";
}
export function separateOriSingleMessageComparison(
  value: OriSingleMessageComparison,
): { readonly educator: OriEducatorBlindMessages; readonly coordinator: OriRestrictedMessageKey } | null {
  if (
    !value ||
    value.schema !== "agorix/ori-single-message-comparison/v1" ||
    value.equalInputContextProven !== false ||
    value.eligibleForEfficacyClaim !== false ||
    !value.provenance ||
    value.provenance.oriCandidate === value.provenance.deterministicCandidate ||
    !["A", "B"].includes(value.provenance.oriCandidate) ||
    !["A", "B"].includes(value.provenance.deterministicCandidate) ||
    typeof value.missionId !== "string" ||
    value.missionId.length < 1 ||
    value.missionId.length > 80 ||
    typeof value.A !== "string" ||
    value.A.trim().length < 8 ||
    value.A.length > 500 ||
    typeof value.B !== "string" ||
    value.B.trim().length < 8 ||
    value.B.length > 500
  )
    return null;
  return Object.freeze({
    educator: Object.freeze({
      schema: "agorix/ori-blind-messages/v1",
      missionId: value.missionId,
      A: value.A,
      B: value.B,
      equalInputContextProven: false,
      eligibleForEfficacyClaim: false,
    }),
    coordinator: Object.freeze({
      missionId: value.missionId,
      oriCandidate: value.provenance.oriCandidate,
      deterministicCandidate: value.provenance.deterministicCandidate,
    }),
  });
}
