import { describe, expect, it } from "vitest";
import { openOriSqliteRenderedHintReceiptStore } from "./oriSqliteRenderedHintReceiptStore.js";

const receipt = {
  missionId: "move", missionIndex: 0, actuallyRendered: true,
  hint: {
    schema: "agorix/pedagogical-text-hint/v1" as const,
    hint: "Probá mover un bloque hacia adelante",
    nextStep: "Revisá qué ocurre al ejecutar",
    appliedChanges: false as const,
  },
  learningContext: { attempts: 2, hintsUsed: 1, learningStage: "explore" as const },
};
describe("MIG-03 durable rendered hint receipts", () => {
  it("persists host receipt and resolves review context", async () => {
    const store = openOriSqliteRenderedHintReceiptStore(":memory:");
    expect(store.recordFromHost(receipt)).toBe(true);
    expect(await store.resolve("move", 0)).toMatchObject({
      learnerFacingExplanation: { text: receipt.hint.hint, source: "host-rendered" },
    });
    expect(store.recordFromHost(receipt)).toBe(false);
    store.close();
  });
  it("rejects preview-only and invalid context receipts", async () => {
    const store = openOriSqliteRenderedHintReceiptStore(":memory:");
    expect(store.recordFromHost({ ...receipt, actuallyRendered: false })).toBe(false);
    expect(store.recordFromHost({
      ...receipt, learningContext: { ...receipt.learningContext, attempts: -1 },
    })).toBe(false);
    expect(await store.resolve("move", 0)).toBeNull();
    store.close();
  });
});
