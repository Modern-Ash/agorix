import { describe, expect, it } from "vitest";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
describe("MIG-03 ticket lineage", () => {
  it("rejects duplicate, invalid and cross-project bindings", () => {
    const store = openOriTicketReviewLineageStore(":memory:");
    const entry = {
      ticketId: id, owner: "student", projectId: "project",
      reviewId: "pilot", digest: "a".repeat(64), revision: 1,
    };
    expect(store.bind(entry)).toBe(true);
    expect(store.bind(entry)).toBe(false);
    expect(store.matches(entry)).toBe(true);
    expect(store.matches({ ...entry, projectId: "other" })).toBe(false);
    expect(store.matches({ ...entry, digest: "b".repeat(64) })).toBe(false);
    expect(store.bind({ ...entry, ticketId: "invalid" })).toBe(false);
    store.close();
  });
});
