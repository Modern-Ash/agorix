import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const matrix = {
  total: 2, available: 2, missing: 0, divergent: 1,
  rows: [
    { missionId: "move", missionIndex: 0, status: "divergent" as const, matches: 1, divergences: 1, notComparable: 2 },
    { missionId: "turn", missionIndex: 1, status: "partial-match" as const, matches: 2, divergences: 0, notComparable: 2 },
  ],
};
const educator = { id: "verified-educator", canReviewOri: true };
const decision = (missionId: string) => ({
  missionId, decision: "approve" as const, rationale: "Revisión pedagógica documentada",
});
describe("MIG-03 atomic evidence and educator review", () => {
  it("persists signoff and audit across restart and invalidates approvals on evidence change", () => {
    const dir = mkdtempSync(join(tmpdir(), "ori-atomic-"));
    dirs.push(dir);
    const path = join(dir, "review.sqlite");
    let store = openOriAtomicEducatorReviewStore(path);
    expect(store.publish("pilot", matrix)).toBe("published");
    const first = store.get("pilot")!;
    expect(store.submit("pilot", first.digest, first.revision, null, decision("move")))
      .toBe("unauthorized");
    expect(store.submit("pilot", first.digest, first.revision, educator, decision("move")))
      .toBe("recorded");
    expect(store.submit("pilot", first.digest, first.revision, educator, decision("turn")))
      .toBe("conflict");
    expect(store.submit("pilot", first.digest, 2, educator, decision("turn")))
      .toBe("recorded");
    expect(store.signoff("pilot")).toMatchObject({ status: "approved", rolloutAuthorized: false });
    store.close();
    store = openOriAtomicEducatorReviewStore(path);
    expect(store.signoff("pilot")?.status).toBe("approved");
    const changed = { ...matrix, divergent: 0, rows: [
      { ...matrix.rows[0]!, status: "partial-match" as const, divergences: 0 },
      matrix.rows[1]!,
    ] };
    expect(store.publish("pilot", changed, 1)).toBe("conflict");
    expect(store.publish("pilot", changed, 3)).toBe("published");
    expect(store.signoff("pilot")).toMatchObject({ status: "blocked", reviewed: 0 });
    expect(store.submit("pilot", first.digest, 3, educator, decision("move"))).toBe("conflict");
    expect(store.audit("pilot")).toHaveLength(4);
    expect(store.audit("pilot").map((event) => event["event"])).toEqual([
      "evidence-created", "approve", "approve", "evidence-replaced",
    ]);
    store.close();
  });
  it("rejects incomplete evidence and missions absent from trusted snapshot", () => {
    const store = openOriAtomicEducatorReviewStore(":memory:");
    expect(store.publish("pilot", { ...matrix, available: 1, missing: 1 })).toBe("invalid");
    expect(store.publish("pilot", matrix)).toBe("published");
    const state = store.get("pilot")!;
    expect(store.submit("pilot", state.digest, state.revision, educator, decision("forged")))
      .toBe("invalid");
    store.close();
  });
});
