import type { ProjectProgram } from "@agorix/program-model";
import { convertScratchProject } from "./kidsScratchImport.js";
import type { ScratchJson } from "./__fixtures__/scratch/builder.js";

/** Every statement in the program, nested ones included (the report only counts the top level). */
export function statementsOf(program: ProjectProgram): number {
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

export interface FidelityRow {
  readonly name: string;
  readonly statements: number;
  readonly imported: number;
  readonly scripts: number;
  readonly scriptsKept: number;
  readonly reasons: Readonly<Record<string, number>>;
}

export interface FidelityTotals {
  readonly statements: number;
  readonly imported: number;
  readonly scripts: number;
  readonly scriptsKept: number;
}

const percent = (part: number, whole: number): string =>
  whole === 0 ? "n/a" : `${((100 * part) / whole).toFixed(1)}%`;

/** Converts each project and counts what came across; the project's own stats are the whole. */
export function measureFidelity(
  corpus: readonly { readonly name: string; readonly project: ScratchJson }[],
): readonly FidelityRow[] {
  return corpus.map(({ name, project }) => {
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

export function fidelityTotals(rows: readonly FidelityRow[]): FidelityTotals {
  const sum = (pick: (row: FidelityRow) => number) => rows.reduce((n, row) => n + pick(row), 0);
  return {
    statements: sum((row) => row.statements),
    imported: sum((row) => row.imported),
    scripts: sum((row) => row.scripts),
    scriptsKept: sum((row) => row.scriptsKept),
  };
}

/** The most frequent reasons something was left behind, most frequent first. */
export function topReasons(
  rows: readonly FidelityRow[],
  limit = 14,
): readonly (readonly [string, number])[] {
  const reasons = new Map<string, number>();
  for (const row of rows)
    for (const [what, count] of Object.entries(row.reasons))
      reasons.set(what, (reasons.get(what) ?? 0) + count);
  return [...reasons.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

/** The fidelity report as Markdown: one row per project, the totals, and what is left behind. */
export function fidelityMarkdown(rows: readonly FidelityRow[]): string {
  const total = fidelityTotals(rows);
  const lines = [
    "| Project | Blocks | Brought across | Scripts | Scripts kept |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.name} | ${row.statements} | ${row.imported} (${percent(row.imported, row.statements)}) | ${row.scripts} | ${row.scriptsKept} (${percent(row.scriptsKept, row.scripts)}) |`,
    ),
    `| **Total** | **${total.statements}** | **${total.imported} (${percent(total.imported, total.statements)})** | **${total.scripts}** | **${total.scriptsKept} (${percent(total.scriptsKept, total.scripts)})** |`,
    "",
    "Left behind, most frequent first:",
    "",
    ...topReasons(rows).map(([what, count]) => `- ${what}: ${count}`),
  ];
  return lines.join("\n");
}
