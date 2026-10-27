import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server-owned immutable binding between a project ticket and technical review. */
export function openOriTicketReviewLineageStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_ticket_review_lineage(
    ticket_id TEXT PRIMARY KEY, owner TEXT NOT NULL, project_id TEXT NOT NULL,
    review_id TEXT NOT NULL, digest TEXT NOT NULL, revision INTEGER NOT NULL);`);
  const insert = db.prepare(`INSERT INTO ori_ticket_review_lineage
    (ticket_id,owner,project_id,review_id,digest,revision)
    VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING`);
  const lookup = db.prepare(`SELECT owner,project_id,review_id,digest,revision
    FROM ori_ticket_review_lineage WHERE ticket_id=?`);
  return Object.freeze({
    bind(input: {
      readonly ticketId: string; readonly owner: string; readonly projectId: string;
      readonly reviewId: string; readonly digest: string; readonly revision: number;
    }): boolean {
      if (!UUID.test(input.ticketId) || !ID.test(input.owner) ||
          !ID.test(input.projectId) || !ID.test(input.reviewId) ||
          !DIGEST.test(input.digest) || !Number.isSafeInteger(input.revision) ||
          input.revision < 1) return false;
      return insert.run(input.ticketId, input.owner, input.projectId, input.reviewId,
        input.digest, input.revision).changes === 1;
    },
    matches(input: {
      readonly ticketId: string; readonly owner: string; readonly projectId: string;
      readonly reviewId: string; readonly digest: string; readonly revision: number;
    }): boolean {
      if (!UUID.test(input.ticketId)) return false;
      const row = lookup.get(input.ticketId);
      return !!row && row["owner"] === input.owner &&
        row["project_id"] === input.projectId && row["review_id"] === input.reviewId &&
        row["digest"] === input.digest && row["revision"] === input.revision;
    },
    close: () => db.close(),
  });
}

/** Read-only evidence gate: no record can authorize rollout. */
export function createOriBoundPresentationReadiness(
  lineage: ReturnType<typeof openOriTicketReviewLineageStore>,
  reviews: ReturnType<typeof openOriAtomicEducatorReviewStore>,
  presentations: ReturnType<typeof openOriTicketPresentationSqliteStore>,
) {
  return Object.freeze({
    assess(owner: string, projectId: string, ticketId: string, reviewId: string):
      { readonly ready: boolean; readonly blockers: readonly string[];
        readonly rolloutAuthorized: false } {
      const blockers: string[] = [];
      const review = reviews.get(reviewId);
      if (!review) blockers.push("review-unavailable");
      if (!review || !lineage.matches({
        owner, projectId, ticketId, reviewId,
        digest: review.digest, revision: review.revision,
      })) blockers.push("ticket-review-lineage-mismatch");
      if (!presentations.read(owner, projectId, ticketId))
        blockers.push("presentation-ack-missing");
      return Object.freeze({
        ready: blockers.length === 0,
        blockers: Object.freeze(blockers),
        rolloutAuthorized: false,
      });
    },
  });
}
