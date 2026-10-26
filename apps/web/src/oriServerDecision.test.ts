import { describe, expect, it } from "vitest";
import { parseOriServerDecision } from "./oriServerDecision.js";

describe("Ori server review decision boundary", () => {
  it.each(["accepted", "edited", "rejected", "stale"] as const)(
    "accepts a validated %s response", status => {
      expect(parseOriServerDecision({status,appliedChanges:false})).toBe(status);
    }
  );
  it("rejects an automatic project mutation", () => {
    expect(parseOriServerDecision({status:"accepted",appliedChanges:true})).toBe("unavailable");
  });
  it("rejects arbitrary or malformed responses", () => {
    expect(parseOriServerDecision({status:"success",appliedChanges:false})).toBe("unavailable");
    expect(parseOriServerDecision({status:"accepted"})).toBe("unavailable");
    expect(parseOriServerDecision(null)).toBe("unavailable");
  });
});
