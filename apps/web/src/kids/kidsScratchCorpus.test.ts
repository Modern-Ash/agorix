import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import { convertScratchProject } from "./kidsScratchImport.js";
import { creativeForStudio } from "./kidsStudioModel.js";
import { fidelityMarkdown, fidelityTotals, measureFidelity } from "./kidsScratchFidelity.js";
import { SCRATCH_CORPUS } from "./__fixtures__/scratch/corpus.js";

const REPORT = fileURLToPath(
  new URL("../../../../docs/product/SCRATCH_IMPORT_FIDELITY.md", import.meta.url),
);
const FLOORS = { statements: 91, imported: 75, scripts: 23, scriptsKept: 21 };
const START = "<!-- fidelity:start -->";
const END = "<!-- fidelity:end -->";

describe("Scratch import measured on the team's corpus", () => {
  it("converts every project and each result runs in the deterministic runtime", () => {
    for (const { name, project } of SCRATCH_CORPUS) {
      const { program, backdropId, positions } = convertScratchProject(project);
      const creative = creativeForStudio(program, backdropId, "es", positions);
      expect(() => runMultiActorProgram(program, creative), name).not.toThrow();
    }
  });

  it("never lets the fidelity get worse", () => {
    const total = fidelityTotals(measureFidelity(SCRATCH_CORPUS));
    expect(total.imported).toBeLessThanOrEqual(total.statements);
    // Floors: an import change may raise these (then raise them here and regenerate the report).
    expect(total.statements).toBe(FLOORS.statements);
    expect(total.imported).toBeGreaterThanOrEqual(FLOORS.imported);
    expect(total.scripts).toBe(FLOORS.scripts);
    expect(total.scriptsKept).toBeGreaterThanOrEqual(FLOORS.scriptsKept);
  });

  it("publishes the same numbers in docs/product/SCRATCH_IMPORT_FIDELITY.md", () => {
    const table = fidelityMarkdown(measureFidelity(SCRATCH_CORPUS));
    const doc = readFileSync(REPORT, "utf8");
    const block = `${START}\n\n${table}\n\n${END}`;
    if (process.env["UPDATE_FIDELITY"] === "1") {
      const from = doc.indexOf(START);
      const to = doc.indexOf(END) + END.length;
      writeFileSync(REPORT, `${doc.slice(0, from)}${block}${doc.slice(to)}`);
      return;
    }
    // Regenerate with: UPDATE_FIDELITY=1 pnpm vitest run kidsScratchCorpus
    // Prettier pads the table and adds blank lines around it; compare without them.
    const plain = (text: string) =>
      text
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .replace(/-{3,}/g, "---");
    expect(plain(doc)).toContain(plain(block));
  });
});
