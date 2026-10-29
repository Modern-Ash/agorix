import type { OriCapturedMissionSource } from "./oriSourceEvidencePersistence.js";

export interface OriTrustedHostReviewContext {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly learningContext: {
    readonly attempts: number;
    readonly hintsUsed: number;
    readonly learningStage: "explore" | "connect" | "translate";
  };
  readonly learnerFacingExplanation: {
    readonly text: string;
    readonly source: "host-rendered";
  };
}

/**
 * Server-side host context boundary. The resolver must obtain values from
 * trusted application state and a recorded learner-facing rendering, never
 * from request JSON or a generated substitute.
 */
export function createOriTrustedHostReviewContextPort(
  resolve: (missionId: string, missionIndex: number) => Promise<OriTrustedHostReviewContext | null>,
) {
  return Object.freeze({
    async resolveFor(
      captured: OriCapturedMissionSource,
    ): Promise<OriTrustedHostReviewContext | null> {
      try {
        const value = await resolve(captured.missionId, captured.missionIndex);
        if (
          !value ||
          value.missionId !== captured.missionId ||
          value.missionIndex !== captured.missionIndex ||
          !Number.isSafeInteger(value.learningContext.attempts) ||
          value.learningContext.attempts < 0 ||
          value.learningContext.attempts > 1000 ||
          !Number.isSafeInteger(value.learningContext.hintsUsed) ||
          value.learningContext.hintsUsed < 0 ||
          value.learningContext.hintsUsed > 1000 ||
          !["explore", "connect", "translate"].includes(value.learningContext.learningStage) ||
          value.learnerFacingExplanation.source !== "host-rendered" ||
          typeof value.learnerFacingExplanation.text !== "string" ||
          value.learnerFacingExplanation.text.trim().length === 0 ||
          value.learnerFacingExplanation.text.length > 2000
        )
          return null;
        return Object.freeze(value);
      } catch {
        return null;
      }
    },
  });
}
