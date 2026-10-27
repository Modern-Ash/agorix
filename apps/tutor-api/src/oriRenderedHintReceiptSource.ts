import type { OriTrustedHostReviewContext } from "./oriTrustedHostReviewContextPort.js";
import type { OriTextHintCandidate } from "./oriTextHintModality.js";

export interface OriHostHintReceipt {
  readonly missionId: string;
  readonly missionIndex: number;
  readonly hint: OriTextHintCandidate;
  readonly actuallyRendered: boolean;
  readonly learningContext: OriTrustedHostReviewContext["learningContext"];
}

/**
 * In-memory trusted host receipt source. Only the host rendering pipeline may
 * record receipts; a preview alone is never proof that a learner saw a hint.
 */
export function createOriRenderedHintReceiptSource() {
  const receipts = new Map<string, OriHostHintReceipt>();
  const key = (id: string, index: number) => JSON.stringify([id, index]);
  return Object.freeze({
    recordFromHost(receipt: OriHostHintReceipt): boolean {
      if (
        !receipt.actuallyRendered ||
        !receipt.missionId ||
        !Number.isSafeInteger(receipt.missionIndex) ||
        receipt.hint.schema !== "agorix/pedagogical-text-hint/v1" ||
        receipt.hint.appliedChanges !== false ||
        typeof receipt.hint.hint !== "string" ||
        receipt.hint.hint.trim().length < 8 ||
        receipt.hint.hint.length > 180
      )
        return false;
      receipts.set(key(receipt.missionId, receipt.missionIndex), Object.freeze(receipt));
      return true;
    },
    async resolve(
      missionId: string,
      missionIndex: number,
    ): Promise<OriTrustedHostReviewContext | null> {
      const receipt = receipts.get(key(missionId, missionIndex));
      if (!receipt || !receipt.actuallyRendered) return null;
      return Object.freeze({
        missionId,
        missionIndex,
        learningContext: receipt.learningContext,
        learnerFacingExplanation: {
          text: receipt.hint.hint,
          source: "host-rendered" as const,
        },
      });
    },
  });
}
