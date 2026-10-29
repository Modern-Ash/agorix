import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openOriSqliteEvidenceSnapshotStore } from "./oriSqliteEvidenceSnapshotStore.js";

const folders: string[] = [];
afterEach(() =>
  folders.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);
const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "movement",
      missionIndex: 0,
      status: "partial-match" as const,
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
describe("Ori SQLite evidence snapshots", () => {
  it("persists complete evidence and history across process restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "ori-evidence-"));
    folders.push(dir);
    const path = join(dir, "evidence.sqlite");
    let store = openOriSqliteEvidenceSnapshotStore(path);
    expect(store.publish("pilot", matrix)).toBe("published");
    const first = store.get("pilot");
    expect(first?.revision).toBe(1);
    store.close();
    store = openOriSqliteEvidenceSnapshotStore(path);
    expect(store.get("pilot")?.digest).toBe(first?.digest);
    const changed = {
      ...matrix,
      divergent: 1,
      rows: [{ ...matrix.rows[0]!, status: "divergent" as const, divergences: 1 }],
    };
    expect(store.publish("pilot", changed, 0)).toBe("conflict");
    expect(store.publish("pilot", changed, 1)).toBe("published");
    expect(store.history("pilot")).toHaveLength(2);
    store.close();
  });
  it("rejects missing mission evidence and stale initial revision", () => {
    const store = openOriSqliteEvidenceSnapshotStore(":memory:");
    expect(store.publish("pilot", { ...matrix, available: 0, missing: 1 })).toBe("invalid");
    expect(store.publish("pilot", matrix, 1)).toBe("conflict");
    store.close();
  });
});
