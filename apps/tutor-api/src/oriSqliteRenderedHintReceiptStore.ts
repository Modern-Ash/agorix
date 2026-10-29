import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriHostHintReceipt } from "./oriRenderedHintReceiptSource.js";
import type { OriTrustedHostReviewContext } from "./oriTrustedHostReviewContextPort.js";

const ID = /^[a-zA-Z0-9_-]{1,80}$/;

/**
 * Single-host durable receipt store. Only trusted host rendering code may call
 * recordFromHost; this module deliberately exposes no learner-facing endpoint.
 */
export function openOriSqliteRenderedHintReceiptStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_rendered_hint_receipts(
    mission_id TEXT NOT NULL, mission_index INTEGER NOT NULL,
    hint_text TEXT NOT NULL, attempts INTEGER NOT NULL,
    hints_used INTEGER NOT NULL, learning_stage TEXT NOT NULL,
    PRIMARY KEY(mission_id,mission_index));`);
  const insert = db.prepare(`INSERT INTO ori_rendered_hint_receipts(
    mission_id,mission_index,hint_text,attempts,hints_used,learning_stage)
    VALUES(?,?,?,?,?,?) ON CONFLICT(mission_id,mission_index) DO NOTHING`);
  const lookup = db.prepare(`SELECT hint_text,attempts,hints_used,learning_stage
    FROM ori_rendered_hint_receipts WHERE mission_id=? AND mission_index=?`);
  return Object.freeze({
    recordFromHost(receipt: OriHostHintReceipt): boolean {
      const context = receipt.learningContext;
      if (
        !ID.test(receipt.missionId) ||
        !Number.isSafeInteger(receipt.missionIndex) ||
        receipt.missionIndex < 0 ||
        !receipt.actuallyRendered ||
        receipt.hint.schema !== "agorix/pedagogical-text-hint/v1" ||
        receipt.hint.appliedChanges !== false ||
        typeof receipt.hint.hint !== "string" ||
        receipt.hint.hint.trim().length < 8 ||
        receipt.hint.hint.length > 180 ||
        !Number.isSafeInteger(context.attempts) ||
        context.attempts < 0 ||
        !Number.isSafeInteger(context.hintsUsed) ||
        context.hintsUsed < 0 ||
        !["explore", "connect", "translate"].includes(context.learningStage)
      )
        return false;
      const result = insert.run(
        receipt.missionId,
        receipt.missionIndex,
        receipt.hint.hint,
        context.attempts,
        context.hintsUsed,
        context.learningStage,
      );
      return result.changes === 1;
    },
    async resolve(
      missionId: string,
      missionIndex: number,
    ): Promise<OriTrustedHostReviewContext | null> {
      if (!ID.test(missionId) || !Number.isSafeInteger(missionIndex)) return null;
      const row = lookup.get(missionId, missionIndex);
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
