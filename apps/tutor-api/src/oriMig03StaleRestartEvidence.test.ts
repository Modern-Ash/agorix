import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import {
  openOriTicketReviewLineageStore,
  createOriBoundPresentationReadiness,
} from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "move",
      missionIndex: 0,
      status: "matched-observables" as const,
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
describe("MIG-03 stale persisted lineage across restart", () => {
  it("invalidates a previously ready ticket after review replacement and restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agorix-ori-stale-"));
    const paths = [join(dir, "review.db"), join(dir, "lineage.db"), join(dir, "presentation.db")];
    try {
      let reviews = openOriAtomicEducatorReviewStore(paths[0]!);
      let lineage = openOriTicketReviewLineageStore(paths[1]!);
      let presentations = openOriTicketPresentationSqliteStore(paths[2]!);
      expect(reviews.publish("pilot", matrix)).toBe("published");
      const before = reviews.get("pilot")!;
      expect(
        lineage.bind({
          ticketId,
          owner: "student",
          projectId: "project",
          reviewId: "pilot",
          digest: before.digest,
          revision: before.revision,
        }),
      ).toBe(true);
      expect(
        await presentations.record({
          owner: "student",
          projectId: "project",
          ticketId,
          descriptionHash: "a".repeat(64),
        }),
      ).toBe(true);
      const gate = createOriBoundPresentationReadiness(lineage, reviews, presentations);
      expect(gate.assess("student", "project", ticketId, "pilot").ready).toBe(true);
      expect(
        reviews.publish(
          "pilot",
          {
            ...matrix,
            rows: [{ ...matrix.rows[0]!, matches: 5 }],
          },
          before.revision,
        ),
      ).toBe("published");
      expect(gate.assess("student", "project", ticketId, "pilot").ready).toBe(false);
      presentations.close();
      lineage.close();
      reviews.close();

      reviews = openOriAtomicEducatorReviewStore(paths[0]!);
      lineage = openOriTicketReviewLineageStore(paths[1]!);
      presentations = openOriTicketPresentationSqliteStore(paths[2]!);
      const reopened = createOriBoundPresentationReadiness(lineage, reviews, presentations).assess(
        "student",
        "project",
        ticketId,
        "pilot",
      );
      expect(reopened.ready).toBe(false);
      expect(reopened.blockers).toContain("ticket-review-lineage-mismatch");
      presentations.close();
      lineage.close();
      reviews.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
