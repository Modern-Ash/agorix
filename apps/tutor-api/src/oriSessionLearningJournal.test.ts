import { describe, expect, it } from "vitest";
import { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";

const hash = "fnv1a32:1234abcd";
const fingerprint = "a".repeat(64);

describe("ephemeral Ori session learning journal", () => {
  it("binds verified runs and issued hints to one session and revision", () => {
    const journal = createOriSessionLearningJournal();
    expect(journal.learningContext("owner", "project", "session-a", hash)).toBeNull();
    expect(journal.recordHintIssued("owner", "project", "session-a", hash, 1)).toBe(false);
    expect(
      journal.recordVerifiedRun("owner", "project", "session-a", hash, "explore", fingerprint),
    ).toBe(true);
    expect(journal.recordHintIssued("owner", "project", "session-a", hash, 1)).toBe(true);
    expect(journal.recordHintIssued("owner", "project", "session-a", hash, 1)).toBe(false);
    expect(
      journal.recordVerifiedRun("owner", "project", "session-a", hash, "explore", fingerprint),
    ).toBe(true);
    expect(journal.learningContext("owner", "project", "session-a", hash)).toEqual({
      attempts: 2,
      hintsUsed: 1,
      learningStage: "explore",
    });
    expect(journal.learningContext("owner", "project", "session-b", hash)).toBeNull();
    expect(journal.learningContext("other", "project", "session-a", hash)).toBeNull();
    expect(journal.learningContext("owner", "project", "session-a", "fnv1a32:00000000")).toBeNull();
    journal.clearSession("session-a");
    expect(journal.learningContext("owner", "project", "session-a", hash)).toBeNull();
  });

  it("expires without persistence and fails closed when capacity is exhausted", () => {
    let clock = 0;
    const journal = createOriSessionLearningJournal({
      now: () => clock,
      ttlMs: 1000,
      maxEntries: 1,
    });
    expect(
      journal.recordVerifiedRun("owner", "project", "first", hash, "connect", fingerprint),
    ).toBe(true);
    expect(
      journal.recordVerifiedRun("owner", "project", "second", hash, "connect", fingerprint),
    ).toBe(false);
    clock = 1000;
    expect(journal.learningContext("owner", "project", "first", hash)).toBeNull();
    expect(
      journal.recordVerifiedRun("owner", "project", "second", hash, "translate", fingerprint),
    ).toBe(true);
    expect(
      createOriSessionLearningJournal().learningContext("owner", "project", "second", hash),
    ).toBeNull();
  });

  it("carries server-issued hints across a metadata-only revision and drops them for a changed program", () => {
    const journal = createOriSessionLearningJournal();
    expect(
      journal.recordVerifiedRun("owner", "project", "session", hash, "explore", fingerprint),
    ).toBe(true);
    expect(journal.recordHintIssued("owner", "project", "session", hash, 1)).toBe(true);
    const next = "fnv1a32:87654321";
    expect(
      journal.recordVerifiedRun("owner", "project", "session", next, "explore", fingerprint),
    ).toBe(true);
    expect(journal.learningContext("owner", "project", "session", next)).toMatchObject({
      attempts: 2,
      hintsUsed: 1,
    });
    const changed = "fnv1a32:11111111";
    expect(
      journal.recordVerifiedRun("owner", "project", "session", changed, "explore", "b".repeat(64)),
    ).toBe(true);
    expect(journal.learningContext("owner", "project", "session", changed)).toMatchObject({
      attempts: 1,
      hintsUsed: 0,
    });
  });
});
