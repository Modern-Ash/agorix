import { describe, expect, it } from "vitest";
import { validateOriContextInput } from "./oriContextPreview.js";

const request = {
  intent: "debug",
  context: { scriptCount: 2, hintCount: 1, outcome: "failed" },
};
describe("Ori context input validation", () => {
  it("accepts bounded educational metadata", () => {
    expect(validateOriContextInput(request)).toEqual(request);
  });
  it("rejects raw learner data", () => {
    expect(validateOriContextInput({ ...request, message: "child text" })).toBeNull();
  });
  it("rejects raw program or trace", () => {
    expect(
      validateOriContextInput({
        ...request,
        context: { ...request.context, program: "raw" },
      }),
    ).toBeNull();
  });
  it("rejects unknown outcomes", () => {
    expect(
      validateOriContextInput({
        ...request,
        context: { ...request.context, outcome: "unknown" },
      }),
    ).toBeNull();
  });
  it("rejects invalid counts", () => {
    expect(
      validateOriContextInput({
        ...request,
        context: { ...request.context, hintCount: 1001 },
      }),
    ).toBeNull();
  });
});
