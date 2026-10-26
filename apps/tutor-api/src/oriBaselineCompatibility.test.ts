import { describe, expect, it } from "vitest";
import { inspectOriBaselineCompatibility } from "./oriBaselineCompatibility.js";

describe("MIG-03 real deterministic baseline semantic gate", () => {
  it("captures real Kids rules but refuses to call action offers pedagogical parity", () => {
    const result = inspectOriBaselineCompatibility();
    expect(result.capturedMissions).toBeGreaterThan(0);
    expect(result.allStarterProgramsUnchanged).toBe(true);
    expect(result.comparable).toBe(false);
    expect(result.reason).toBe("different-output-semantics");
    expect(result.baselineSource).toBe("agorix-deterministic-rule");
    expect(result.candidateSource).toBe("ori-shadow-plan-v1");
  });
});
