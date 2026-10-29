import { describe, expect, it } from "vitest";
import { openOriSqliteEducatorReviewStore } from "./oriSqliteEducatorReviewStore.js";
import {
  createOriDurableEducatorReviewService,
  digestOriReviewMatrix,
} from "./oriDurableEducatorReviewService.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 2,
  available: 2,
  missing: 0,
  divergent: 1,
  rows: [
    {
      missionId: "move",
      missionIndex: 0,
      status: "divergent",
      matches: 1,
      divergences: 1,
      notComparable: 2,
    },
    {
      missionId: "turn",
      missionIndex: 1,
      status: "partial-match",
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
const reviewer = { id: "educator", canReviewOri: true };
const decision = (missionId: string) => ({
  missionId,
  decision: "approve" as const,
  rationale: "Revisión educativa documentada",
});
describe("MIG-03 durable educator review service", () => {
  it("uses authoritative mission list, CAS and explicit signoff without rollout", async () => {
    const store = openOriSqliteEducatorReviewStore(":memory:");
    const evidence = { read: async () => ({ matrix, digest: digestOriReviewMatrix(matrix) }) };
    const service = createOriDurableEducatorReviewService(store, evidence);
    expect(await service.initialize("pilot")).toBe(true);
    const digest = digestOriReviewMatrix(matrix);
    expect(await service.submit("pilot", digest, 1, null, decision("move"))).toBe("unauthorized");
    expect(await service.submit("pilot", digest, 1, reviewer, decision("forged"))).toBe("invalid");
    expect(await service.submit("pilot", digest, 1, reviewer, decision("move"))).toBe("recorded");
    expect(await service.submit("pilot", digest, 1, reviewer, decision("turn"))).toBe("conflict");
    expect(await service.submit("pilot", digest, 2, reviewer, decision("turn"))).toBe("recorded");
    expect(await service.signoff("pilot")).toMatchObject({
      status: "approved",
      reviewed: 2,
      required: 2,
      rolloutAuthorized: false,
    });
    store.close();
  });
  it("invalidates signoff when evidence changes and requires reconciliation", async () => {
    const store = openOriSqliteEducatorReviewStore(":memory:");
    let current = matrix;
    const evidence = {
      read: async () => ({ matrix: current, digest: digestOriReviewMatrix(current) }),
    };
    const service = createOriDurableEducatorReviewService(store, evidence);
    await service.initialize("pilot");
    current = {
      ...matrix,
      divergent: 0,
      rows: [{ ...matrix.rows[0]!, status: "partial-match", divergences: 0 }, matrix.rows[1]!],
    };
    expect(await service.signoff("pilot")).toBeNull();
    expect(
      await service.submit("pilot", digestOriReviewMatrix(matrix), 1, reviewer, decision("move")),
    ).toBe("conflict");
    expect(await service.reconcile("pilot")).toBe(true);
    expect(store.get("pilot")?.decisions).toHaveLength(0);
    expect(store.audit("pilot")[0]?.event).toBe("evidence-replaced");
    store.close();
  });
  it("rejects forged evidence digests", async () => {
    const store = openOriSqliteEducatorReviewStore(":memory:");
    const service = createOriDurableEducatorReviewService(store, {
      read: async () => ({ matrix, digest: "a".repeat(64) }),
    });
    expect(await service.initialize("pilot")).toBe(false);
    store.close();
  });
});
