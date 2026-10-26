import type { OriSeparatedBlindMessages } from "./oriSingleMessageBlindExport.js";

/**
 * Pure, bounded offline JSON export. Keep coordinator JSON private and do not
 * send it to educator-facing clients. No filesystem, network or Kids routes.
 */
export interface OriBlindReviewJson {
  readonly educatorJson: string;
  readonly coordinatorJson: string;
}
export function exportOriBlindReviewJson(
  capture: OriSeparatedBlindMessages,
): OriBlindReviewJson | null {
  if (!capture || !capture.educator || !capture.coordinator) return null;
  const { educator, coordinator } = capture;
  if (
    Object.keys(educator).sort().join(",") !==
      "A,B,eligibleForEfficacyClaim,equalInputContextProven,missionId,schema" ||
    Object.keys(coordinator).sort().join(",") !== "deterministicCandidate,missionId,oriCandidate" ||
    educator.schema !== "agorix/ori-blind-messages/v1" ||
    educator.equalInputContextProven !== false ||
    educator.eligibleForEfficacyClaim !== false ||
    typeof educator.missionId !== "string" ||
    educator.missionId.length < 1 ||
    educator.missionId.length > 80 ||
    coordinator.missionId !== educator.missionId ||
    typeof educator.A !== "string" ||
    educator.A.trim().length < 8 ||
    educator.A.length > 500 ||
    typeof educator.B !== "string" ||
    educator.B.trim().length < 8 ||
    educator.B.length > 500 ||
    !["A", "B"].includes(coordinator.oriCandidate) ||
    !["A", "B"].includes(coordinator.deterministicCandidate) ||
    coordinator.oriCandidate === coordinator.deterministicCandidate
  )
    return null;
  const educatorJson = JSON.stringify(educator, null, 2) + "\n";
  const coordinatorJson = JSON.stringify(coordinator, null, 2) + "\n";
  if (
    educatorJson.includes("oriCandidate") ||
    educatorJson.includes("deterministicCandidate") ||
    educatorJson.includes("coordinator")
  )
    return null;
  return Object.freeze({ educatorJson, coordinatorJson });
}
