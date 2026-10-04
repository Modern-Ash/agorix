import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const gate = readFileSync(resolve(repoRoot, "docs/product/STUDIO_RELEASE_GATE.md"), "utf8");
const extensionRoot = resolve(repoRoot, "extensions/vscode");
const manifest = JSON.parse(readFileSync(resolve(extensionRoot, "package.json"), "utf8")) as {
  contributes: {
    commands: Array<{ command: string }>;
    viewsContainers: { activitybar: Array<{ icon?: string }> };
  };
};
const vscodeIgnore = readFileSync(resolve(extensionRoot, ".vscodeignore"), "utf8");

const requiredCapabilities = [
  "Projects",
  "Canonical program",
  "Languages",
  "World",
  "Run/Stop/Reset/Step",
  "Evidence",
  "AI suggestions",
  "Proposal review",
  "Learning Companion",
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

  it("keeps the gate aligned with Studio's contributed command surface", () => {
    const contributed = new Set(manifest.contributes.commands.map((entry) => entry.command));
    for (const command of requiredCommands) {
      expect(contributed.has(command), command).toBe(true);
      expect(gate).toContain(command);
    }
  });

  it("packages every manifest asset used by the Activity Bar", () => {
    for (const container of manifest.contributes.viewsContainers.activitybar) {
      if (container.icon === undefined) continue;
      expect(readFileSync(resolve(extensionRoot, container.icon), "utf8")).toContain("<svg");
      expect(vscodeIgnore).toContain(`!${container.icon}`);
    }
  });
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
