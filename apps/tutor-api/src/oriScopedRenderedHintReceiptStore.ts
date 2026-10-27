import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriHostHintReceipt } from "./oriRenderedHintReceiptSource.js";
import type { OriTrustedHostReviewContext } from "./oriTrustedHostReviewContextPort.js";

const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const DIGEST = /^[a-f0-9]{64}$/;

/**
 * Review-scoped durable receipts. Never use the unscoped mission-only receipt
 * cache to attest a specific review: the same mission may occur in many runs.
 */
export function openOriScopedRenderedHintReceiptStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_scoped_hint_receipts(
    review_id TEXT NOT NULL, digest TEXT NOT NULL,
    mission_id TEXT NOT NULL, mission_index INTEGER NOT NULL,
    hint_text TEXT NOT NULL, attempts INTEGER NOT NULL,
    hints_used INTEGER NOT NULL, learning_stage TEXT NOT NULL,
    PRIMARY KEY(review_id,digest,mission_id,mission_index));`);
  const insert = db.prepare(`INSERT INTO ori_scoped_hint_receipts
    (review_id,digest,mission_id,mission_index,hint_text,attempts,hints_used,learning_stage)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`);
  const select = db.prepare(`SELECT hint_text,attempts,hints_used,learning_stage
    FROM ori_scoped_hint_receipts
    WHERE review_id=? AND digest=? AND mission_id=? AND mission_index=?`);
  return Object.freeze({
    recordFromHost(reviewId: string, digest: string, receipt: OriHostHintReceipt): boolean {
      const ctx = receipt.learningContext;
      if (
        !ID.test(reviewId) ||
        !DIGEST.test(digest) ||
        !ID.test(receipt.missionId) ||
        !Number.isSafeInteger(receipt.missionIndex) ||
        receipt.missionIndex < 0 ||
        !receipt.actuallyRendered ||
        receipt.hint.schema !== "agorix/pedagogical-text-hint/v1" ||
        receipt.hint.appliedChanges !== false ||
        typeof receipt.hint.hint !== "string" ||
        receipt.hint.hint.trim().length < 8 ||
        receipt.hint.hint.length > 180 ||
        !Number.isSafeInteger(ctx.attempts) ||
        ctx.attempts < 0 ||
        ctx.attempts > 1000 ||
        !Number.isSafeInteger(ctx.hintsUsed) ||
        ctx.hintsUsed < 0 ||
        ctx.hintsUsed > 1000 ||
        !["explore", "connect", "translate"].includes(ctx.learningStage)
      )
        return false;
      return (
        insert.run(
          reviewId,
          digest,
          receipt.missionId,
          receipt.missionIndex,
          receipt.hint.hint,
          ctx.attempts,
          ctx.hintsUsed,
          ctx.learningStage,
        ).changes === 1
      );
    },
    async resolve(
      reviewId: string,
      digest: string,
      missionId: string,
      missionIndex: number,
    ): Promise<OriTrustedHostReviewContext | null> {
      if (
        !ID.test(reviewId) ||
        !DIGEST.test(digest) ||
        !ID.test(missionId) ||
        !Number.isSafeInteger(missionIndex)
      )
        return null;
      const row = select.get(reviewId, digest, missionId, missionIndex);
      if (!row) return null;
      return {
        missionId,
        missionIndex,
        learningContext: {
          attempts: Number(row["attempts"]),
          hintsUsed: Number(row["hints_used"]),
          learningStage: String(
            row["learning_stage"],
          ) as OriTrustedHostReviewContext["learningContext"]["learningStage"],
        },
        learnerFacingExplanation: {
          text: String(row["hint_text"]),
          source: "host-rendered" as const,
        },
      };
    },
    close: () => db.close(),
  });
}
