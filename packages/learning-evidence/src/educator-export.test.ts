import { describe, expect, it } from "vitest";
import {
  createEducatorEvidenceExport,
  formatEducatorSummary,
  validateEducatorEvidenceExport,
  type EducatorExportInput,
} from "./index.js";

const base: EducatorExportInput = {
  missionId: "first-mission",
  programHash: "sha256:abc123",
  truncated: false,
  events: [
    { type: "proposalRequested", origin: "provider" },
    { type: "alternativeChosen", origin: "provider" },
    { type: "proposalModified", origin: "provider" },
    { type: "proposalRequested", origin: "built-in" },
    { type: "proposalRejected", origin: "built-in" },
    { type: "predictionMatched" },
    { type: "predictionSkipped" },
    { type: "explainCompleted" },
  ],
  agreements: {
    aiEnabled: true,
    mode: "supervised",
    assistanceCeiling: 4,
    requirePredictionBeforeAccept: true,
  },
  ambientOffers: { shown: 3, accepted: 1, dismissed: 1, ignored: 1 },
  completedByRuntime: true,
};

describe("educator evidence export", () => {
  it("counts a single session without scores", () => {
    const data = createEducatorEvidenceExport(base);
    expect(data).toMatchObject({
      schema: "agorix/educator-evidence/v1",
      scope: "single-session",
      proposals: {
        requested: 2,
        modified: 1,
        rejected: 1,
        alternativesChosen: 1,
        byOrigin: { provider: 1, "built-in": 1 },
      },
      predictions: { matched: 1, mismatched: 0, skipped: 1 },
      explanations: { completed: 1, skipped: 0 },
      ambientOffers: { shown: 3, accepted: 1, dismissed: 1, ignored: 1 },
      completion: { completedByRuntime: true },
    });
    expect(JSON.stringify(data)).not.toMatch(/score|rank|grade/i);
  });

  it("never carries free text, paths, emails or identity, even if smuggled in", () => {
    const text = JSON.stringify({ ...createEducatorEvidenceExport(base), schema: "" });
    expect(text).not.toMatch(/@|\/|\\|\.agorix|Users|home/);
    const smuggled = { ...createEducatorEvidenceExport(base), learnerName: "Ana" };
    expect(() => validateEducatorEvidenceExport(smuggled)).toThrow(/unknown field/);
    const deep = createEducatorEvidenceExport(base);
    expect(() =>
      validateEducatorEvidenceExport({ ...deep, mission: { id: "/home/ana/project.agorix" } }),
    ).toThrow(/opaque identifier/);
    expect(() =>
      validateEducatorEvidenceExport({ ...deep, programHash: "ana@school.org" }),
    ).toThrow(/opaque hash/);
    expect(() => validateEducatorEvidenceExport({ ...deep, scope: "all-sessions" })).toThrow(
      /single session/,
    );
    expect(() =>
      validateEducatorEvidenceExport({ ...deep, proposals: { ...deep.proposals, requested: -1 } }),
    ).toThrow(/non-negative/);
  });

  it("flags truncation and explains in plain language what the numbers do not mean", () => {
    const data = createEducatorEvidenceExport({ ...base, truncated: true });
    const summary = formatEducatorSummary(data);
    expect(data.truncated).toBe(true);
    expect(summary).toContain("counts may be low");
    expect(summary).toContain("does not show that the learner understands");
    expect(summary).toContain("Suggestions requested: 2 (AI provider: 1, built-in: 1)");
    expect(summary).not.toMatch(/first-mission.*@/);
  });
});
