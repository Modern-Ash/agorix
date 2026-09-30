import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSISTANCE_CREDIT,
  ASSISTANCE_LEVELS,
  COMPETENCIES,
  EVIDENCE_FIELD_RETENTION,
  EVENT_KINDS,
  PROHIBITED_EVIDENCE_FIELDS,
  RETENTION_CLASSES,
  assertAssistanceCreditMonotonic,
  assertCompetencyTraceCoverage,
  assertRetentionCoverage,
  describeRetention,
  type AssistanceLevel,
  type RetentionClass,
} from "./index.js";

const docPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/product/LEARNING_EVIDENCE.md",
);
const doc = readFileSync(docPath, "utf8");

/** Markdown table rows as trimmed cell values, separator rows removed. */
const tableRows = (text: string): string[][] =>
  text
    .split("\n")
    .filter((line) => line.trimStart().startsWith("|"))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((value) => value.trim()),
    )
    .filter((cells) => !cells.every((value) => /^:?-{2,}:?$/.test(value)));

const cell = (cells: string[], index: number): string => cells[index] ?? "";

describe("LEARNING_EVIDENCE.md documents the enforced model", () => {
  it("traces the issue and its dependencies", () => {
    expect(doc).toMatch(/#102/);
    expect(doc).toContain("LEARNING_PROGRESSION.md");
    expect(doc).toContain("PEDAGOGY.md");
    expect(doc).toContain("CHILD_SAFETY_PRIVACY.md");
  });

  it("lists every event kind", () => {
    for (const kind of EVENT_KINDS) {
      expect(doc).toContain(kind);
    }
  });

  it("documents the retention class and purpose of every evidence field", () => {
    const rows = tableRows(doc);
    expect(
      rows.filter((cells) => RETENTION_CLASSES.includes(cell(cells, 1) as RetentionClass)),
    ).toHaveLength(Object.keys(EVIDENCE_FIELD_RETENTION).length);
    for (const entry of describeRetention()) {
      const row = rows.find((cells) => cell(cells, 0) === `\`${entry.field}\``);
      expect(row, `missing documentation row for ${entry.field}`).toBeDefined();
      expect(cell(row as string[], 1)).toBe(entry.retention);
      expect(cell(row as string[], 2)).toBe(entry.purpose);
    }
  });

  it("documents the assistance credit table", () => {
    for (const level of ASSISTANCE_LEVELS) {
      const row = tableRows(doc).find((cells) => cell(cells, 0) === `\`${level}\``);
      expect(row, `missing assistance row for ${level}`).toBeDefined();
      expect(cell(row as string[], 1)).toBe(String(ASSISTANCE_CREDIT[level as AssistanceLevel]));
    }
  });

  it("names the metrics the model refuses to use", () => {
    for (const prohibited of [
      "promptCount",
      "tokensUsed",
      "elapsedMs",
      "modelConfidence",
      "timestamp",
    ]) {
      expect(PROHIBITED_EVIDENCE_FIELDS).toContain(prohibited);
    }
    expect(doc).toMatch(/number of prompts/);
    expect(doc).toMatch(/amount of AI usage/);
    expect(doc).toMatch(/raw model confidence/);
  });

  it("states the over-assistance flags the model reports", () => {
    for (const flag of [
      "aiSolvedBeforeLearnerActed",
      "proposalAcceptedWithoutInspection",
      "learnerActionMissingUnderHighScaffolding",
    ]) {
      expect(doc).toContain(flag);
    }
  });

  it("includes the synthetic example report with no real identifiers", () => {
    expect(doc).toContain("synthetic");
    expect(doc).toMatch(/understandingScore/);
    expect(doc).not.toMatch(/learnerName|@agorix\.com|real learner name/i);
  });
});

describe("documented invariants hold", () => {
  it("every competency has an evidence source", () => {
    expect(() => assertCompetencyTraceCoverage()).not.toThrow();
    expect(COMPETENCIES.length).toBeGreaterThan(0);
  });

  it("every field has a documented retention class and purpose", () => {
    expect(() => assertRetentionCoverage()).not.toThrow();
    for (const entry of describeRetention()) {
      expect(RETENTION_CLASSES).toContain(entry.retention);
    }
  });

  it("assistance credit never increases with more AI help", () => {
    expect(() => assertAssistanceCreditMonotonic()).not.toThrow();
  });
});
