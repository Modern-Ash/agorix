import { describe, expect, it } from "vitest";
import { describeOriLearningContext } from "./OriReviewPanel.js";

describe("Ori local learning context", () => {
  it("shows program and hint counts with execution evidence", () => {
    expect(describeOriLearningContext({scriptCount:2,hintCount:1,hasRunEvidence:true}))
      .toContain("Hay una ejecución para revisar.");
  });
  it("does not invent execution evidence", () => {
    expect(describeOriLearningContext({scriptCount:1,hintCount:0,hasRunEvidence:false}))
      .toContain("Todavía no hay una ejecución");
  });
  it("bounds malformed numeric context", () => {
    const text = describeOriLearningContext({scriptCount:-1,hintCount:999999,hasRunEvidence:false});
    expect(text).toContain("0 secuencias");
    expect(text).toContain("999 pistas");
  });
});
