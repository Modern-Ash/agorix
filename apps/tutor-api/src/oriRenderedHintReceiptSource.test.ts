import { describe, expect, it } from "vitest";
import { createOriRenderedHintReceiptSource } from "./oriRenderedHintReceiptSource.js";
import { createOriTrustedHostReviewContextPort } from "./oriTrustedHostReviewContextPort.js";

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
describe("MIG-03 host rendered hint receipts", () => {
  it("resolves an actual host receipt into trusted review context", async () => {
    const source = createOriRenderedHintReceiptSource();
    expect(source.recordFromHost(receipt)).toBe(true);
    const port = createOriTrustedHostReviewContextPort(source.resolve);
    expect(await port.resolveFor({
      missionId: "move", missionIndex: 0, oriProposal: { action: "hint" },
      kidsBaseline: { action: "hint" }, provenance: "ori-loopback-synthetic-mission",
    })).toMatchObject({
      learnerFacingExplanation: { text: receipt.hint.hint, source: "host-rendered" },
    });
  });
  it("rejects preview-only receipts and mismatched mission lookups", async () => {
    const source = createOriRenderedHintReceiptSource();
    expect(source.recordFromHost({ ...receipt, actuallyRendered: false })).toBe(false);
    expect(await source.resolve("move", 0)).toBeNull();
    expect(source.recordFromHost(receipt)).toBe(true);
    expect(await source.resolve("other", 0)).toBeNull();
  });
});
