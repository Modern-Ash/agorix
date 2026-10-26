import { describe, expect, it } from "vitest";
import { runOriPairedShadow } from "./oriPairedShadowRunner.js";

describe("Ori MIG-03 paired synthetic shadow execution", () => {
  it("passes the same immutable context to both runners and reports divergence", async () => {
    const seen: string[] = [];
    const report = await runOriPairedShadow({
      scenarios: [{ caseId: "movement", context: { mission: 1, stage: "connect" } }],
      legacy: async (context) => {
        seen.push(JSON.stringify(context));
        return { kind: "hint", hintLevel: 2 };
      },
      ori: async (context) => {
        seen.push(JSON.stringify(context));
        return { kind: "hint", hintLevel: 3 };
      },
    });
    expect(seen[0]).toBe(seen[1]);
    expect(report.counts["hint-level-divergence"]).toBe(1);
    expect(report.findings).toHaveLength(1);
  });
  it("counts an Ori failure as missing, never as parity", async () => {
    const report = await runOriPairedShadow({
      scenarios: [{ caseId: "offline", context: { mission: 1 } }],
      legacy: async () => ({ kind: "hint", hintLevel: 1 }),
      ori: async () => { throw Error("unavailable"); },
    });
    expect(report.counts["missing-ori"]).toBe(1);
    expect(report.exactMatchRate).toBeNull();
  });
  it("refuses comparison without a legacy baseline", async () => {
    await expect(runOriPairedShadow({
      scenarios: [{ caseId: "missing", context: {} }],
      legacy: async () => null,
      ori: async () => ({ kind: "hint", hintLevel: 1 }),
    })).rejects.toThrow("Missing legacy baseline");
  });
});
