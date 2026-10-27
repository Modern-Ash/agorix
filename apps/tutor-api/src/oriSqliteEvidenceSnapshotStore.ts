import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { digestOriReviewMatrix } from "./oriDurableEducatorReviewService.js";
import { assessOriEvidenceQuality } from "./oriEvidenceQualityGate.js";

/**
 * Stores a complete synthetic evidence snapshot and review state in one SQLite
 * transaction. Intended for a single host; no HTTP or learner-facing use.
 */
export function openOriSqliteEvidenceSnapshotStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_evidence_snapshots (
    review_id TEXT PRIMARY KEY,
    digest TEXT NOT NULL,
    revision INTEGER NOT NULL,
    matrix_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ori_evidence_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    digest TEXT NOT NULL,
    matrix_json TEXT NOT NULL
  );`);
  const read = db.prepare("SELECT digest,revision,matrix_json FROM ori_evidence_snapshots WHERE review_id=?");
  const insertHistory = db.prepare("INSERT INTO ori_evidence_history(review_id,revision,digest,matrix_json) VALUES(?,?,?,?)");
  const get = (id: string) => {
    const row = read.get(id);
    if (!row) return null;
    const matrix = JSON.parse(String(row["matrix_json"])) as OriMissionDivergenceMatrix;
    const digest = String(row["digest"]);
    if (digestOriReviewMatrix(matrix) !== digest) return null;
    return { digest, revision: Number(row["revision"]), matrix };
  };
  const transaction = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  return Object.freeze({
    get,
    history: (id: string) => db.prepare(
      "SELECT revision,digest FROM ori_evidence_history WHERE review_id=? ORDER BY id",
    ).all(id),
    publish(id: string, matrix: OriMissionDivergenceMatrix, expectedRevision?: number):
      "published" | "conflict" | "invalid" {
      if (!id || assessOriEvidenceQuality(matrix).status !== "complete-technical-evidence")
        return "invalid";
      const digest = digestOriReviewMatrix(matrix);
      const json = JSON.stringify(matrix);
      return transaction(() => {
        const previous = get(id);
        if (previous && expectedRevision !== previous.revision) return "conflict";
        if (!previous && expectedRevision !== undefined) return "conflict";
        if (previous?.digest === digest) return "published";
        const nextRevision = (previous?.revision ?? 0) + 1;
        db.prepare(`INSERT INTO ori_evidence_snapshots(review_id,digest,revision,matrix_json)
          VALUES(?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET
          digest=excluded.digest,revision=excluded.revision,matrix_json=excluded.matrix_json`)
          .run(id, digest, nextRevision, json);
        insertHistory.run(id, nextRevision, digest, json);
        return "published";
      });
    },
    close: () => db.close(),
  });
}
