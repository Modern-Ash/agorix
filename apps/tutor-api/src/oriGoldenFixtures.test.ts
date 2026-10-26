import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyOriGoldenParity, type OriGoldenCase, type OriParityOutcome } from "./oriGoldenParity.js";

interface GoldenFixture {
  readonly schemaVersion: string;
  readonly provenance: string;
  readonly cases: readonly (OriGoldenCase & { readonly expected: OriParityOutcome })[];
}
const fixture = JSON.parse(readFileSync(fileURLToPath(
  new URL("../fixtures/ori-golden-synthetic-v1.json", import.meta.url),
), "utf8")) as GoldenFixture;

describe("Ori MIG-03 reproducible synthetic golden fixture", () => {
  it("uses an explicitly synthetic and versioned corpus", () => {
    expect(fixture.schemaVersion).toBe("agorix/ori-golden-cases/v1");
    expect(fixture.provenance).toBe("synthetic-only");
    expect(fixture.cases.length).toBeGreaterThanOrEqual(4);
    expect(new Set(fixture.cases.map((entry) => entry.caseId)).size).toBe(fixture.cases.length);
  });
  it("classifies all golden cases deterministically", () => {
    const findings = classifyOriGoldenParity(fixture.cases);
    expect(findings).toEqual(fixture.cases.map((entry) => ({
      caseId: entry.caseId,
      outcome: entry.expected,
    })));
  });
});
