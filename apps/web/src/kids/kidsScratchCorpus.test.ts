import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import type { ProjectProgram } from "@agorix/program-model";
import { convertScratchProject } from "./kidsScratchImport.js";
import { creativeForStudio } from "./kidsStudioModel.js";
import { SCRATCH_CORPUS } from "./__fixtures__/scratch/corpus.js";

/** Every statement in the program, nested ones included (the report only counts the top level). */
function statementsOf(program: ProjectProgram): number {
  const walk = (value: unknown): number => {
    if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + walk(item), 0);
    if (typeof value !== "object" || value === null) return 0;
    const record = value as Record<string, unknown>;
    const self = typeof record["type"] === "string" && !("trigger" in record) ? 1 : 0;
    return (
      self + ["statements", "then", "else", "body"].reduce((sum, key) => sum + walk(record[key]), 0)
    );
  };
  return program.scripts.reduce((sum, script) => sum + walk(script.statements), 0);
}

interface Row {
  readonly name: string;
  readonly statements: number;
  readonly imported: number;
  readonly scripts: number;
  readonly scriptsKept: number;
  readonly reasons: Readonly<Record<string, number>>;
}

function measure(): readonly Row[] {
  return SCRATCH_CORPUS.map(({ name, project }) => {
    const { program, report } = convertScratchProject(project);
    const reasons: Record<string, number> = {};
    for (const item of report.dropped) reasons[item.what] = item.count;
    return {
      name,
      statements: project.stats.statements,
      imported: statementsOf(program),
      scripts: project.stats.scripts,
      scriptsKept: project.stats.scripts - (reasons["another script of the sprite"] ?? 0),
      reasons,
    };
  });
}

describe("Scratch import measured on the team's corpus", () => {
  it("converts every project and each result runs in the deterministic runtime", () => {
    for (const { name, project } of SCRATCH_CORPUS) {
      const { program, backdropId, positions } = convertScratchProject(project);
      const creative = creativeForStudio(program, backdropId, "es", positions);
      expect(() => runMultiActorProgram(program, creative), name).not.toThrow();
    }
  });

  it("keeps the numbers visible and never lets them get worse", () => {
    const rows = measure();
    const total = (pick: (row: Row) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
    const statements = total((row) => row.statements);
    const imported = total((row) => row.imported);
    const scripts = total((row) => row.scripts);
    const kept = total((row) => row.scriptsKept);
    const reasons = new Map<string, number>();
    for (const row of rows)
      for (const [what, count] of Object.entries(row.reasons))
        reasons.set(what, (reasons.get(what) ?? 0) + count);
    const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    // Printed so a person can read the table when the numbers change.
    console.info(JSON.stringify({ statements, imported, scripts, kept, rows, top }, null, 1));
    expect(imported).toBeLessThanOrEqual(statements);
    // Floors: an import change may raise these (then raise them here), never lower them.
    expect(statements).toBe(91);
    expect(imported).toBeGreaterThanOrEqual(73);
    expect(scripts).toBe(23);
    expect(kept).toBeGreaterThanOrEqual(21);
  });
});
