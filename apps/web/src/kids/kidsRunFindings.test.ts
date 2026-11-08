import { describe, expect, it } from "vitest";
import type { Finding } from "@agorix/run-evidence";
import { AGE_BANDS } from "./kidsAgeBand.js";
import { findingBlockIndex, findingScriptIndex, findingSentence } from "./kidsRunFindings.js";

const base = { id: "x", actorId: "a", nodeIds: ["scripts[1]/statements[2]"], confidence: 0.9 };
const findings: Finding[] = [
  {
    ...base,
    kind: "neverStarted",
    counts: { senders: 0 },
    event: { type: "message", name: "hola", senders: 0 },
  },
  {
    ...base,
    kind: "neverStarted",
    counts: { senders: 1 },
    event: { type: "message", name: "hola", senders: 1 },
  },
  { ...base, kind: "neverStarted", counts: {}, event: { type: "key", name: "ArrowUp" } },
  { ...base, kind: "neverStarted", counts: {}, event: { type: "click" } },
  {
    ...base,
    kind: "messageUnheard",
    counts: { sent: 1 },
    event: { type: "message", name: "listo", senders: 1 },
  },
  {
    ...base,
    kind: "messageUnheard",
    counts: { sent: 3 },
    event: { type: "message", name: "listo", senders: 1 },
  },
  { ...base, kind: "conditionNeverTrue", counts: { yes: 0, no: 1 } },
  { ...base, kind: "conditionNeverTrue", counts: { yes: 0, no: 4 } },
  { ...base, kind: "conditionNeverFalse", counts: { yes: 5, no: 0 } },
  { ...base, kind: "predictionMismatch", counts: {}, nodeIds: [] },
];

describe("sentences for what Ori noticed", () => {
  it("writes a sentence for every finding, language and age band", () => {
    for (const finding of findings)
      for (const locale of ["es", "en"] as const)
        for (const band of AGE_BANDS) {
          const sentence = findingSentence(finding, locale, band);
          expect(sentence.length).toBeGreaterThan(10);
          expect(sentence).not.toMatch(/undefined|NaN|\[object/);
        }
  });

  it("is shorter for the youngest band and carries the counts for older ones", () => {
    const finding = findings[7]!;
    const young = findingSentence(finding, "es", "6-8");
    const older = findingSentence(finding, "es", "13+");
    expect(young).toContain("4 veces");
    expect(older).toContain("4 veces");
    expect(young).not.toBe(older);
    expect(older).toContain("nunca fue verdadera");
  });

  it("names a key and a message the way the learner sees them", () => {
    expect(findingSentence(findings[2]!, "es", "9-12")).toContain("flecha ↑");
    expect(findingSentence(findings[0]!, "en", "9-12")).toContain("“hola”");
  });

  it("uses voseo in Spanish, never the informal tú forms", () => {
    for (const finding of findings)
      for (const band of AGE_BANDS)
        expect(findingSentence(finding, "es", band)).not.toMatch(
          /\b(tienes|puedes|quieres|haz|mira|pulsa|usa)\b/i,
        );
  });

  it("says where in the program a finding is", () => {
    expect(findingScriptIndex(findings[0]!)).toBe(1);
    expect(findingBlockIndex(findings[0]!)).toBe(2);
    expect(findingBlockIndex({ ...findings[0]!, nodeIds: ["scripts[0]"] })).toBeNull();
    expect(findingScriptIndex(findings[9]!)).toBeNull();
  });
});
