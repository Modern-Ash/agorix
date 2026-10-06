import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const gate = readFileSync(resolve(repoRoot, "docs/product/STUDIO_RELEASE_GATE.md"), "utf8");
const rootPackage = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
  engines: { node: string; pnpm: string };
};
const nvmrc = readFileSync(resolve(repoRoot, ".nvmrc"), "utf8").trim();
const nodeVersion = readFileSync(resolve(repoRoot, ".node-version"), "utf8").trim();
const ciWorkflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
const openVsxWorkflow = readFileSync(
  resolve(repoRoot, ".github/workflows/open-vsx-publish.yml"),
  "utf8",
);
const extensionRoot = resolve(repoRoot, "extensions/vscode");
const manifest = JSON.parse(readFileSync(resolve(extensionRoot, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  contributes: {
    commands: Array<{ command: string }>;
    configuration: { properties: Record<string, { enum?: string[]; default?: unknown }> };
    viewsContainers: { activitybar: Array<{ icon?: string }> };
  };
};
const vscodeIgnore = readFileSync(resolve(extensionRoot, ".vscodeignore"), "utf8");

const requiredCapabilities = [
  "Projects",
  "Canonical program",
  "Block editing (Workbench)",
  "Agent loop (Workbench)",
  "Intent planning",
  "Cross-surface edits",
  "Languages",
  "World",
  "Run/Stop/Reset/Step",
  "Evidence",
  "AI suggestions",
  "Proposal review",
  "Learning Companion",
  "Localization",
  "Ambient presence",
  "Educator evidence export",
  "Progress",
  "Undo/Redo",
  "`.agorix`",
  "Authenticated projects",
] as const;

const requiredJourneys = [
  "Clean install -> Create New Project -> Run/Step -> Export .agorix",
  "Open/import project -> choose projection -> Run/Step -> World + Inspector",
  "Contextual AI help from evidence",
  "Proposal -> diff -> Reject unchanged",
  "Proposal -> Apply -> Undo -> Redo",
  "Web export -> Studio import -> semantic hash",
  "Studio export -> Web import -> semantic hash",
  "Authenticated project Web edit -> Studio reopen and vice versa with revision checks",
  "AI unavailable -> core Studio works",
  "Real VS Code packaged extension smoke",
] as const;

const requiredCommands = [
  "agorixStudio.createProject",
  "agorixStudio.openProject",
  "agorixStudio.openProjection",
  "agorixStudio.switchProjection",
  "agorixStudio.openWorldPreview",
  "agorixStudio.openActorInspector",
  "agorixStudio.run",
  "agorixStudio.step",
  "agorixStudio.reset",
  "agorixStudio.stop",
  "agorixStudio.showEvidence",
  "agorixStudio.companionDebug",
  "agorixStudio.suggestRepeat",
  "agorixStudio.applyProposal",
  "agorixStudio.rejectProposal",
  "agorixStudio.undoProposal",
  "agorixStudio.redoProposal",
  "agorixStudio.exportAgorix",
  "agorixStudio.exportEducatorEvidence",
  "agorixStudio.openRemoteProject",
  "agorixStudio.saveRemoteProject",
  "agorixStudio.validateProject",
  "agorixStudio.runChecks",
  "agorixStudio.openScm",
] as const;

describe("Studio release gate documentation", () => {
  it("records the required parity capabilities with evidence and status", () => {
    for (const capability of requiredCapabilities) {
      expect(gate).toMatch(new RegExp(`\\|\\s*${escapeRegex(capability)}\\s*\\|`));
    }
    expect(gate).toContain("Capability parity matrix");
    expect(gate).toContain("Automated evidence");
    expect(gate).toContain("Intentional difference");
    expect(gate).toMatch(/Extension Host|vscode-extension-smoke|VSIX/);
  });

  it("records every required release journey", () => {
    for (const journey of requiredJourneys) {
      expect(gate).toContain(journey);
    }
  });

  it("records the agent and canvas gate evidence for issue 259", () => {
    expect(gate).toContain("packages/tutor-contract/src/intent-plan.test.ts");
    expect(gate).toContain("extensions/vscode/src/studioProvider.test.ts");
    expect(gate).toContain("packages/learning-decision-plane/src/proactive-pipeline.test.ts");
    expect(gate).toContain("extensions/vscode/src/ambient/ambientController.test.ts");
    expect(gate).toContain("packages/learning-evidence/src/index.test.ts");
    expect(gate).toContain("counts-only JSON and Markdown");
    expect(gate).toContain("never echoes learner free text");
  });

  it("contributes the Workbench density setting used by the IDE surface", () => {
    expect(manifest.contributes.configuration.properties["agorixStudio.workbench.density"]).toEqual(
      expect.objectContaining({
        enum: ["auto", "comfortable", "compact"],
        default: "auto",
      }),
    );
    expect(gate).toContain("density");
  });

  it("wires Open VSX publishing as a manual packaged-VSIX release path", () => {
    expect(manifest.scripts["publish:open-vsx"]).toContain("ovsx publish dist/agorix-studio.vsix");
    expect(openVsxWorkflow).toContain("workflow_dispatch");
    expect(openVsxWorkflow).toContain("pnpm --filter agorix-studio package");
    expect(openVsxWorkflow).toContain("ovsx publish extensions/vscode/dist/agorix-studio.vsix");
    expect(openVsxWorkflow).toContain("OVSX_PAT: ${{ secrets.OVSX_PAT }}");
    expect(openVsxWorkflow).not.toMatch(/\n\s+push:/);
    expect(gate).toContain("Manual Open VSX publish");
  });

  it("pins CI and local tooling to the supported Node 22 runtime", () => {
    expect(nvmrc).toBe("22.23.2");
    expect(nodeVersion).toBe(nvmrc);
    expect(rootPackage.engines.node).toBe(`>=${nvmrc} <23`);
    expect(ciWorkflow.match(/node-version-file: \.nvmrc/g)?.length).toBeGreaterThanOrEqual(12);
    expect(openVsxWorkflow).toContain("node-version-file: .nvmrc");
  });

  it("keeps the gate aligned with Studio's contributed command surface", () => {
    const contributed = new Set(manifest.contributes.commands.map((entry) => entry.command));
    for (const command of requiredCommands) {
      expect(contributed.has(command), command).toBe(true);
      expect(gate).toContain(command);
    }
  });

  it("packages every manifest asset used by the Activity Bar", () => {
    const packagedAssets = ["media/agorix-agent-active.svg"];
    for (const container of manifest.contributes.viewsContainers.activitybar) {
      if (container.icon === undefined) continue;
      packagedAssets.push(container.icon);
    }
    for (const asset of packagedAssets) {
      expect(readFileSync(resolve(extensionRoot, asset), "utf8")).toContain("<svg");
      expect(vscodeIgnore).toContain(`!${asset}`);
    }
  });
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
