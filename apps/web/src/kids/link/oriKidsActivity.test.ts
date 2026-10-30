import { describe, expect, it } from "vitest";
import { oriProposalOfferContext, type OriKidsActivity } from "./oriKidsActivity.js";

const activity: OriKidsActivity = {
  sequence: 1,
  kind: "run",
  evidenceKey: "program:goal:0",
  outcome: "short",
};

describe("private Ori proposal pace", () => {
  it("offers after a run that missed the goal and separates later hint levels", () => {
    expect(oriProposalOfferContext(activity)).toBe("program:goal:0");
    expect(oriProposalOfferContext({ ...activity, evidenceKey: "program:goal:1" })).toBe(
      "program:goal:1",
    );
  });

  it("stays silent after a successful run", () => {
    expect(oriProposalOfferContext({ ...activity, outcome: "success" })).toBeNull();
  });
});
