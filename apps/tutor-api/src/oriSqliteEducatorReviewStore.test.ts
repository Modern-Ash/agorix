import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openOriSqliteEducatorReviewStore } from "./oriSqliteEducatorReviewStore.js";

const folders: string[] = [];
afterEach(() => folders.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));
const a = "a".repeat(64);
const b = "b".repeat(64);
const educator = { id: "educator-1", canReviewOri: true };
const decision = { missionId: "movement", decision: "approve" as const,
  rationale: "El alumno conserva la decisión final." };
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "ori-review-"));
  folders.push(dir);
  return join(dir, "review.sqlite");
}
describe("Ori durable educator review store", () => {
  it("persists decisions and audit across reopen, invalidates old evidence", () => {
    const path = fixture();
    let store = openOriSqliteEducatorReviewStore(path);
    expect(store.initialize("pilot", a)).toBe(true);
    expect(store.submit("pilot", a, 1, educator, decision, ["movement"])).toBe("recorded");
    store.close();
    store = openOriSqliteEducatorReviewStore(path);
    expect(store.get("pilot")?.decisions).toHaveLength(1);
    expect(store.submit("pilot", a, 1, educator, decision, ["movement"])).toBe("conflict");
    expect(store.replaceEvidence("pilot", 2, b)).toBe(true);
    expect(store.get("pilot")?.decisions).toHaveLength(0);
    expect(store.audit("pilot").map((event) => event.event)).toEqual(["approve", "evidence-replaced"]);
    expect(store.submit("pilot", a, 2, educator, decision, ["movement"])).toBe("conflict");
    store.close();
  });
  it("rejects unauthorized, unlisted missions and duplicate submissions", () => {
    const store = openOriSqliteEducatorReviewStore(":memory:");
    store.initialize("pilot", a);
    expect(store.submit("pilot", a, 1, null, decision, ["movement"])).toBe("unauthorized");
    expect(store.submit("pilot", a, 1, educator, decision, ["other"])).toBe("invalid");
    expect(store.submit("pilot", a, 1, educator, decision, ["movement"])).toBe("recorded");
    expect(store.submit("pilot", a, 2, educator, decision, ["movement"])).toBe("invalid");
    expect(store.audit("pilot")).toHaveLength(1);
    store.close();
  });
});
