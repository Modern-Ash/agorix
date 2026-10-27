import { describe, expect, it } from "vitest";
import { openOriScopedRenderedHintReceiptStore } from "./oriScopedRenderedHintReceiptStore.js";

const digest = "a".repeat(64);
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
describe("MIG-03 scoped rendered hint receipts", () => {
  it("isolates receipts across reviews and evidence digests", async () => {
    const store = openOriScopedRenderedHintReceiptStore(":memory:");
    expect(store.recordFromHost("pilot", digest, receipt)).toBe(true);
    expect(await store.resolve("pilot", digest, "move", 0)).toMatchObject({
      learnerFacingExplanation: { text: receipt.hint.hint },
    });
    expect(await store.resolve("other", digest, "move", 0)).toBeNull();
    expect(await store.resolve("pilot", "b".repeat(64), "move", 0)).toBeNull();
    expect(store.recordFromHost("pilot", digest, receipt)).toBe(false);
    store.close();
  });
  it("rejects preview-only receipts and invalid scope", async () => {
    const store = openOriScopedRenderedHintReceiptStore(":memory:");
    expect(store.recordFromHost("pilot", digest, {
      ...receipt, actuallyRendered: false,
    })).toBe(false);
    expect(store.recordFromHost("pilot", "invalid", receipt)).toBe(false);
    expect(await store.resolve("pilot", digest, "move", 0)).toBeNull();
    store.close();
  });
});
