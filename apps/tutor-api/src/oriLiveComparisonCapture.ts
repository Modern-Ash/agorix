import type { TutorRequest } from "@agorix/tutor-contract";
import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { captureOriRealTextBaseline } from "./oriRealTextBaseline.js";
import { createOriLearnerHintPreview } from "./oriLearnerHintPreview.js";
import { prepareOriSingleMessageComparison } from "./oriSingleMessageComparison.js";
import { separateOriSingleMessageComparison } from "./oriSingleMessageBlindExport.js";

/**
 * Runs the authentic deterministic text path and an injected Ori plan consumer
 * in one offline evaluation operation. No Kids endpoint or provider secret is
 * exposed. Different input contracts remain an explicit limitation.
 */
export async function captureOriLiveComparison(
  tutorRequest: TutorRequest,
  oriInput: OriExternalShadowInput,
  consumer: OriPlanConsumer,
  oriFirst: boolean,
) {
  if (typeof oriFirst !== "boolean") return null;
  try {
    const baseline = captureOriRealTextBaseline(tutorRequest);
    if (
      KIDS_MISSION_IDS[oriInput.missionIndex] !== baseline.missionId ||
      oriInput.scriptCount !== tutorRequest.program.scripts.length ||
      oriInput.hintLevel !== baseline.hintLevel
    ) return null;
    const preview = await createOriLearnerHintPreview(consumer, true)(oriInput);
    const comparison = prepareOriSingleMessageComparison(baseline, preview, oriFirst);
    if (!comparison) return null;
    return separateOriSingleMessageComparison(comparison);
  } catch {
    return null;
  }
}
