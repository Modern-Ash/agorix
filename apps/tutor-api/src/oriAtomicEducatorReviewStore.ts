import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import { assessOriEvidenceQuality } from "./oriEvidenceQualityGate.js";
import { digestOriReviewMatrix } from "./oriDurableEducatorReviewService.js";
import { createOriEducatorReviewPackage } from "./oriEducatorReviewPackage.js";
import { assessOriEducatorSignoff } from "./oriEducatorSignoff.js";
import type { OriReviewDecisionInput, OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";

/** Atomic single-host review store: evidence, decisions and audit share one DB transaction. */
export function openOriAtomicEducatorReviewStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS ori_atomic_reviews(
      id TEXT PRIMARY KEY, digest TEXT NOT NULL, revision INTEGER NOT NULL, matrix_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ori_atomic_decisions(
      review_id TEXT NOT NULL, digest TEXT NOT NULL, mission_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL, decision TEXT NOT NULL, rationale TEXT NOT NULL,
      PRIMARY KEY(review_id,digest,mission_id));
    CREATE TABLE IF NOT EXISTS ori_atomic_audit(
      seq INTEGER PRIMARY KEY AUTOINCREMENT, review_id TEXT NOT NULL,
      revision INTEGER NOT NULL, digest TEXT NOT NULL, event TEXT NOT NULL,
      mission_id TEXT NOT NULL, reviewer_id TEXT NOT NULL);`);
  const read = db.prepare("SELECT digest,revision,matrix_json FROM ori_atomic_reviews WHERE id=?");
  const rows = db.prepare("SELECT mission_id,reviewer_id,decision,rationale FROM ori_atomic_decisions WHERE review_id=? AND digest=? ORDER BY mission_id");
  const log = db.prepare("INSERT INTO ori_atomic_audit(review_id,revision,digest,event,mission_id,reviewer_id) VALUES(?,?,?,?,?,?)");
  function transaction<T>(fn: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function current(id: string) {
    const row = read.get(id);
    if (!row) return null;
    const matrix = JSON.parse(String(row["matrix_json"])) as OriMissionDivergenceMatrix;
    const digest = String(row["digest"]);
    if (digestOriReviewMatrix(matrix) !== digest) throw Error("Evidence integrity failure");
    return { digest, revision: Number(row["revision"]), matrix };
  }
  return Object.freeze({
    get: current,
    audit(id: string) {
      return db.prepare("SELECT revision,digest,event,mission_id,reviewer_id FROM ori_atomic_audit WHERE review_id=? ORDER BY seq").all(id);
    },
    publish(id: string, matrix: OriMissionDivergenceMatrix, expectedRevision?: number):
      "published" | "conflict" | "invalid" {
      if (!id || assessOriEvidenceQuality(matrix).status !== "complete-technical-evidence")
        return "invalid";
      const digest = digestOriReviewMatrix(matrix);
      return transaction(() => {
        const before = current(id);
        if ((before && before.revision !== expectedRevision) ||
            (!before && expectedRevision !== undefined)) return "conflict";
        if (before?.digest === digest) return "published";
        const revision = (before?.revision ?? 0) + 1;
        db.prepare(`INSERT INTO ori_atomic_reviews(id,digest,revision,matrix_json) VALUES(?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET digest=excluded.digest,
          revision=excluded.revision,matrix_json=excluded.matrix_json`)
          .run(id, digest, revision, JSON.stringify(matrix));
        log.run(id, revision, digest, before ? "evidence-replaced" : "evidence-created", "", "system");
        return "published";
      });
    },
    submit(id: string, expectedDigest: string, expectedRevision: number,
      principal: OriVerifiedEducator | null, input: OriReviewDecisionInput):
      "recorded" | "unauthorized" | "conflict" | "invalid" {
      if (!principal?.canReviewOri || !principal.id || principal.id.length > 128) return "unauthorized";
      if (!["approve", "reject"].includes(input.decision) ||
          typeof input.rationale !== "string" || input.rationale.trim().length < 12 ||
          input.rationale.length > 2000) return "invalid";
      return transaction(() => {
        const state = current(id);
        if (!state || state.digest !== expectedDigest || state.revision !== expectedRevision)
          return "conflict";
        if (!state.matrix.rows.some((row) => row.missionId === input.missionId))
          return "invalid";
        if (rows.all(id, state.digest).some((row) => row["mission_id"] === input.missionId))
          return "invalid";
        const revision = state.revision + 1;
        db.prepare("INSERT INTO ori_atomic_decisions VALUES(?,?,?,?,?,?)")
          .run(id, state.digest, input.missionId, principal.id, input.decision, input.rationale);
        db.prepare("UPDATE ori_atomic_reviews SET revision=? WHERE id=?")
          .run(revision, id);
        log.run(id, revision, state.digest, input.decision, input.missionId, principal.id);
        return "recorded";
      });
    },
    decisions(id: string) {
      const state = current(id);
      if (!state) return null;
      return rows.all(id, state.digest).map((row) => Object.freeze({
        missionId: String(row["mission_id"]), reviewerId: String(row["reviewer_id"]),
        decision: String(row["decision"]) as "approve" | "reject",
        rationale: String(row["rationale"]),
      }));
    },
    signoff(id: string) {
      const state = current(id);
      if (!state) return null;
      const review = createOriEducatorReviewPackage(state.matrix);
      const decisions = rows.all(id, state.digest).map((row) => ({
        missionId: String(row["mission_id"]), reviewerId: String(row["reviewer_id"]),
        decision: String(row["decision"]) as "approve" | "reject",
        rationale: String(row["rationale"]),
      }));
      return Object.freeze({
        ...assessOriEducatorSignoff(review, decisions),
        evidenceDigest: state.digest, revision: state.revision,
      });
    },
    close: () => db.close(),
  });
}
