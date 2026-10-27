import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriReviewDecisionInput, OriVerifiedEducator } from "./oriEducatorReviewWorkflow.js";

export interface OriDurableReviewState {
  readonly evidenceDigest: string;
  readonly revision: number;
  readonly decisions: readonly {
    readonly missionId: string;
    readonly reviewerId: string;
    readonly decision: "approve" | "reject";
    readonly rationale: string;
  }[];
}

/**
 * Single-host SQLite persistence boundary. All mutations use BEGIN IMMEDIATE
 * and a revision predicate; audit rows are append-only at the application
 * layer. Authentication and educator authorization are host responsibilities.
 */
export function openOriSqliteEducatorReviewStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS ori_educator_review (
      review_id TEXT PRIMARY KEY, digest TEXT NOT NULL, revision INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ori_educator_decisions (
      review_id TEXT NOT NULL, digest TEXT NOT NULL, mission_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL, decision TEXT NOT NULL, rationale TEXT NOT NULL,
      PRIMARY KEY(review_id,digest,mission_id)
    );
    CREATE TABLE IF NOT EXISTS ori_educator_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, review_id TEXT NOT NULL,
      revision INTEGER NOT NULL, digest TEXT NOT NULL, event TEXT NOT NULL,
      mission_id TEXT NOT NULL, reviewer_id TEXT NOT NULL
    );`);
  const read = db.prepare("SELECT digest,revision FROM ori_educator_review WHERE review_id=?");
  const decisions = db.prepare("SELECT mission_id,reviewer_id,decision,rationale FROM ori_educator_decisions WHERE review_id=? AND digest=? ORDER BY mission_id");
  const audit = db.prepare("SELECT revision,digest,event,mission_id,reviewer_id FROM ori_educator_audit WHERE review_id=? ORDER BY id");
  const insertAudit = db.prepare("INSERT INTO ori_educator_audit(review_id,revision,digest,event,mission_id,reviewer_id) VALUES(?,?,?,?,?,?)");
  const get = (id: string): OriDurableReviewState | null => {
    const row = read.get(id);
    if (!row) return null;
    return {
      evidenceDigest: String(row["digest"]),
      revision: Number(row["revision"]),
      decisions: decisions.all(id, String(row["digest"])).map((d) => ({
        missionId: String(d["mission_id"]),
        reviewerId: String(d["reviewer_id"]),
        decision: String(d["decision"]) as "approve" | "reject",
        rationale: String(d["rationale"]),
      })),
    };
  };
  const transaction = <T>(action: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  return Object.freeze({
    get,
    audit: (id: string) => audit.all(id).map((row) => ({
      revision: Number(row["revision"]), evidenceDigest: String(row["digest"]),
      event: String(row["event"]), missionId: String(row["mission_id"]),
      reviewerId: String(row["reviewer_id"]),
    })),
    initialize(id: string, digest: string): boolean {
      if (!id || !/^[a-f0-9]{64}$/.test(digest)) return false;
      return transaction(() => {
        const result = db.prepare("INSERT OR IGNORE INTO ori_educator_review VALUES(?,?,1)").run(id, digest);
        return result.changes === 1;
      });
    },
    submit(id: string, expectedDigest: string, expectedRevision: number,
      principal: OriVerifiedEducator | null, input: OriReviewDecisionInput,
      allowedMissions: readonly string[]): "recorded" | "unauthorized" | "conflict" | "invalid" {
      if (!principal?.canReviewOri || !principal.id || principal.id.length > 128) return "unauthorized";
      if (!allowedMissions.includes(input.missionId) ||
        !["approve", "reject"].includes(input.decision) ||
        typeof input.rationale !== "string" ||
        input.rationale.trim().length < 12 || input.rationale.length > 2000) return "invalid";
      return transaction(() => {
        const current = get(id);
        if (!current || current.evidenceDigest !== expectedDigest ||
          current.revision !== expectedRevision) return "conflict";
        if (current.decisions.some((d) => d.missionId === input.missionId)) return "invalid";
        const next = current.revision + 1;
        db.prepare("INSERT INTO ori_educator_decisions VALUES(?,?,?,?,?,?)")
          .run(id, expectedDigest, input.missionId, principal.id, input.decision, input.rationale);
        db.prepare("UPDATE ori_educator_review SET revision=? WHERE review_id=? AND revision=?")
          .run(next, id, current.revision);
        insertAudit.run(id, next, expectedDigest, input.decision, input.missionId, principal.id);
        return "recorded";
      });
    },
    replaceEvidence(id: string, expectedRevision: number, nextDigest: string): boolean {
      if (!/^[a-f0-9]{64}$/.test(nextDigest)) return false;
      return transaction(() => {
        const current = get(id);
        if (!current || current.revision !== expectedRevision ||
          current.evidenceDigest === nextDigest) return false;
        const next = current.revision + 1;
        db.prepare("UPDATE ori_educator_review SET digest=?,revision=? WHERE review_id=? AND revision=?")
          .run(nextDigest, next, id, current.revision);
        insertAudit.run(id, next, nextDigest, "evidence-replaced", "", "system");
        return true;
      });
    },
    close: () => db.close(),
  });
}
