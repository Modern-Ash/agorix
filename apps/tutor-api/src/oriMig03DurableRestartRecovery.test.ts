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
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";

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
describe("MIG-03 durable SQLite restart recovery", () => {
  it("reopens review, ticket lineage, presentation and artifact without losing scope", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agorix-ori-restart-"));
    const paths = {
      review: join(directory, "reviews.sqlite"),
      lineage: join(directory, "lineage.sqlite"),
      presentation: join(directory, "presentations.sqlite"),
      artifacts: join(directory, "artifacts.sqlite"),
    };
    try {
      let reviews = openOriAtomicEducatorReviewStore(paths.review);
      let lineage = openOriTicketReviewLineageStore(paths.lineage);
      let presentations = openOriTicketPresentationSqliteStore(paths.presentation);
      let artifacts = openOriSqliteEvidenceArtifactRepository(paths.artifacts);
      expect(reviews.publish("pilot", matrix)).toBe("published");
      const state = reviews.get("pilot")!;
      expect(
        lineage.bind({
          ticketId,
          owner: "student",
          projectId: "project",
          reviewId: "pilot",
          digest: state.digest,
          revision: state.revision,
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
      expect(
        artifacts.put(
          "pilot",
          state.digest,
          "move",
          "ori-proposal",
          Buffer.from("synthetic test proposal"),
        ),
      ).not.toBeNull();
      artifacts.close();
      presentations.close();
      lineage.close();
      reviews.close();

      reviews = openOriAtomicEducatorReviewStore(paths.review);
      lineage = openOriTicketReviewLineageStore(paths.lineage);
      presentations = openOriTicketPresentationSqliteStore(paths.presentation);
      artifacts = openOriSqliteEvidenceArtifactRepository(paths.artifacts);
      expect(
        createOriBoundPresentationReadiness(lineage, reviews, presentations).assess(
          "student",
          "project",
          ticketId,
          "pilot",
        ).ready,
      ).toBe(true);
      expect(
        createOriBoundPresentationReadiness(lineage, reviews, presentations).assess(
          "intruder",
          "project",
          ticketId,
          "pilot",
        ).ready,
      ).toBe(false);
      expect(await artifacts.find("pilot", state.digest, "move", "ori-proposal")).not.toBeNull();
      artifacts.close();
      presentations.close();
      lineage.close();
      reviews.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
