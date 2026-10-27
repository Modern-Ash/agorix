import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  OriEvidenceReferenceRecord,
  OriEvidenceReferenceRepository,
} from "./oriPersistedEvidenceReferenceVerifier.js";

const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const KEY = /^[a-z][a-z0-9-]{0,63}$/;

/** Single-host SQLite artifact storage; never fetches client-supplied URLs. */
export function openOriSqliteEvidenceArtifactRepository(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_evidence_artifacts(
    review_id TEXT NOT NULL, digest TEXT NOT NULL, mission_id TEXT NOT NULL,
    key TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL,
    content BLOB NOT NULL, PRIMARY KEY(review_id,digest,mission_id,key));`);
  const lookup = db.prepare(
    "SELECT review_id,digest,mission_id,key,reference,sha256 FROM ori_evidence_artifacts WHERE review_id=? AND digest=? AND mission_id=? AND key=?",
  );
  const content = db.prepare("SELECT content FROM ori_evidence_artifacts WHERE reference=?");
  const repository: OriEvidenceReferenceRepository = {
    async find(reviewId, digest, missionId, key): Promise<OriEvidenceReferenceRecord | null> {
      const row = lookup.get(reviewId, digest, missionId, key);
      if (!row) return null;
      return {
        reviewId: String(row["review_id"]), evidenceDigest: String(row["digest"]),
        missionId: String(row["mission_id"]), key: String(row["key"]),
        reference: String(row["reference"]), sha256: String(row["sha256"]),
      };
    },
    async read(reference): Promise<Uint8Array | null> {
      const row = content.get(reference);
      return row ? new Uint8Array(row["content"] as Uint8Array) : null;
    },
  };
  function put(reviewId: string, digest: string, missionId: string, key: string,
      bytes: Uint8Array): OriEvidenceReferenceRecord | null {
      if (!ID.test(reviewId) || !ID.test(missionId) || !HEX.test(digest) ||
          !KEY.test(key) || bytes.byteLength === 0 || bytes.byteLength > 1_048_576)
        return null;
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const reference = `artifact:${reviewId}/${missionId}/${key}/${digest.slice(0, 16)}`;
      const existing = lookup.get(reviewId, digest, missionId, key);
      if (existing) {
        if (existing["sha256"] !== sha256) return null;
        return {
          reviewId, evidenceDigest: digest, missionId, key, reference,
          sha256,
        };
      }
      db.prepare(`INSERT INTO ori_evidence_artifacts(
        review_id,digest,mission_id,key,reference,sha256,content)
        VALUES(?,?,?,?,?,?,?)`).run(reviewId, digest, missionId, key, reference,
        sha256, Buffer.from(bytes));
      return { reviewId, evidenceDigest: digest, missionId, key, reference, sha256 };
  }
  return Object.freeze({
    ...repository,
    put,
    putBatch(reviewId: string, digest: string, missionId: string,
      entries: Readonly<Record<string, Uint8Array>>):
      Readonly<Record<string, string>> | null {
      const keys = Object.keys(entries);
      if (keys.length === 0 || keys.length > 16 || new Set(keys).size !== keys.length)
        return null;
      db.exec("BEGIN IMMEDIATE");
      try {
        const refs: Record<string, string> = {};
        for (const key of keys) {
          const saved = put(reviewId, digest, missionId, key, entries[key]!);
          if (!saved) {
            db.exec("ROLLBACK");
            return null;
          }
          refs[key] = saved.reference;
        }
        db.exec("COMMIT");
        return Object.freeze(refs);
      } catch {
        db.exec("ROLLBACK");
        return null;
      }
    },
    close: () => db.close(),
  });
}
