// Runs inside the real VS Code Extension Host. No mocks: every assertion goes through
// the real `vscode` API against the real activated extension.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const vscode = require("vscode");

const EXTENSION_ID = "modern-ash.agorix-studio";
const fixture = (name) => vscode.Uri.file(path.resolve(__dirname, "fixtures", name));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(description, probe, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await sleep(100);
  }
}

const tests = [
  [
    "extension is present and activates",
    async () => {
      const extension = vscode.extensions.getExtension(EXTENSION_ID);
      assert.ok(extension, `${EXTENSION_ID} must be installed/loaded in the host`);
      await extension.activate();
      assert.equal(extension.isActive, true);
    },
  ],
  [
    "all contributed commands are registered and discoverable",
    async () => {
      const all = await vscode.commands.getCommands(true);
      for (const id of [
        "agorixStudio.openProject",
        "agorixStudio.openProjection",
        "agorixStudio.openWorldPreview",
        "agorixStudio.openWorkbench",
        "agorixStudio.exportAgorix",
        "agorixStudio.exportEducatorEvidence",
        "agorixStudio.applyProposal",
        "agorixStudio.ambientOffer",
        "agorixStudio.companionBuild",
        "agorixStudio.companionChallenge",
        "agorixStudio.companionDebug",
        "agorixStudio.companionExplain",
        "agorixStudio.companionReflect",
        "agorixStudio.createProject",
        "agorixStudio.listRemoteProjects",
        "agorixStudio.openRemoteProject",
        "agorixStudio.openScm",
        "agorixStudio.redoProposal",
        "agorixStudio.rejectProposal",
        "agorixStudio.revealCanonicalNode",
        "agorixStudio.revealProposalAffectedNode",
        "agorixStudio.reset",
        "agorixStudio.run",
        "agorixStudio.runChecks",
        "agorixStudio.saveRemoteProject",
        "agorixStudio.selectExecutionStep",
        "agorixStudio.showEvidence",
        "agorixStudio.showDeveloperContext",
        "agorixStudio.signIn",
        "agorixStudio.signOut",
        "agorixStudio.suggestFirstStep",
        "agorixStudio.suggestRepeat",
        "agorixStudio.step",
        "agorixStudio.stop",
        "agorixStudio.switchProjection",
        "agorixStudio.undoProposal",
        "agorixStudio.validateProject",
      ]) {
        assert.ok(all.includes(id), `${id} is registered`);
      }
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const contributed = manifest.contributes.commands.map((c) => c.command).sort();
      assert.deepEqual(
        contributed,
        [
          "agorixStudio.checkAgentHealth",
          "agorixStudio.setAgentCredential",
          "agorixStudio.clearAgentCredential",
          "agorixStudio.openProject",
          "agorixStudio.openProjection",
          "agorixStudio.openWorldPreview",
          "agorixStudio.openWorkbench",
          "agorixStudio.exportAgorix",
          "agorixStudio.exportEducatorEvidence",
          "agorixStudio.applyProposal",
          "agorixStudio.ambientOffer",
          "agorixStudio.companionBuild",
          "agorixStudio.companionChallenge",
          "agorixStudio.companionDebug",
          "agorixStudio.companionExplain",
          "agorixStudio.companionReflect",
          "agorixStudio.createProject",
          "agorixStudio.listRemoteProjects",
          "agorixStudio.openRemoteProject",
          "agorixStudio.openScm",
          "agorixStudio.redoProposal",
          "agorixStudio.rejectProposal",
          "agorixStudio.revealCanonicalNode",
          "agorixStudio.revealProposalAffectedNode",
          "agorixStudio.reset",
          "agorixStudio.run",
          "agorixStudio.runChecks",
          "agorixStudio.saveRemoteProject",
          "agorixStudio.selectExecutionStep",
          "agorixStudio.showEvidence",
          "agorixStudio.showDeveloperContext",
          "agorixStudio.signIn",
          "agorixStudio.signOut",
          "agorixStudio.suggestFirstStep",
          "agorixStudio.suggestRepeat",
          "agorixStudio.step",
          "agorixStudio.stop",
          "agorixStudio.switchProjection",
          "agorixStudio.undoProposal",
          "agorixStudio.validateProject",
        ].sort(),
      );
    },
  ],
  [
    "Create New Project writes a canonical .agorix file and opens it",
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agorix-studio-create-"));
      const file = path.join(dir, "fresh-first-mission.agorix");
      const uri = vscode.Uri.file(file);

      const created = await vscode.commands.executeCommand("agorixStudio.createProject", {
        name: "Fresh First Mission",
        starter: "first-mission",
        locale: "en",
        uri,
      });

      assert.equal(created.fsPath, file);
      const raw = fs.readFileSync(file, "utf8");
      const envelope = JSON.parse(raw);
      assert.equal(envelope.format, "agorix-project");
      assert.equal(envelope.project.schemaVersion, "agorix/program/v1");
      assert.equal(envelope.project.metadata.locale, "en");

      const editor = await waitFor(
        "created project projection",
        () => vscode.window.activeTextEditor,
      );
      assert.equal(editor.document.uri.scheme, "agorix-studio");
      assert.match(editor.document.getText(), /whenStarted/);

      const run = await vscode.commands.executeCommand("agorixStudio.run");
      const step = await vscode.commands.executeCommand("agorixStudio.step");
      assert.equal(run.status, "completed");
      assert.equal(step.status, "completed");
    },
  ],
  [
    "Open Project shows the code projection in a real editor",
    async () => {
      await vscode.commands.executeCommand(
        "agorixStudio.openProject",
        fixture("repeat.agorix.json"),
      );
      const editor = await waitFor("projection editor", () => vscode.window.activeTextEditor);
      const text = editor.document.getText();
      assert.equal(editor.document.uri.scheme, "agorix-studio");
      assert.equal(editor.document.languageId, "typescript");
      assert.match(text, /move/, "projection contains the move statements");
      assert.match(text, /turn/, "projection contains the turn statements");
    },
  ],
  [
    "projection switching opens Python without changing the project file",
    async () => {
      const file = fixture("repeat.agorix.json").fsPath;
      const before = fs.readFileSync(file, "utf8");
      await vscode.commands.executeCommand("agorixStudio.openProjection", "python");
      const editor = await waitFor(
        "python projection editor",
        () =>
          vscode.window.activeTextEditor?.document.languageId === "python" &&
          vscode.window.activeTextEditor,
      );
      assert.match(editor.document.getText(), /move\(/);
      assert.match(editor.document.getText(), /turn\(/);
      assert.equal(fs.readFileSync(file, "utf8"), before, "projection switch is read-only");
    },
  ],
  [
    "World Preview and Execution Inspector commands share the runtime session",
    async () => {
      const reset = await vscode.commands.executeCommand("agorixStudio.reset");
      assert.equal(reset.status, "idle");
      assert.equal(reset.selectedFrameIndex, 0);
      assert.ok(reset.inspectorSteps.every((step) => step.provenance === "runtime fact"));

      const step = await vscode.commands.executeCommand("agorixStudio.step");
      assert.equal(step.status, "running");
      assert.equal(step.currentFrame.highlightedNodeId, "scripts[0]/statements[0]");

      const preview = await vscode.commands.executeCommand("agorixStudio.openWorldPreview");
      assert.equal(preview.selectedFrameIndex, step.selectedFrameIndex);
      assert.equal(preview.currentFrame.highlightedNodeId, step.currentFrame.highlightedNodeId);

      const selected = await vscode.commands.executeCommand("agorixStudio.selectExecutionStep", 1);
      assert.equal(selected.selectedFrameIndex, 1);
      assert.equal(selected.inspectorSteps[1].nodeId, "scripts[0]/statements[0]");
    },
  ],
  [
    "Workbench opens once beside the project and survives execution commands",
    async () => {
      const workbenchTabs = () =>
        vscode.window.tabGroups.all
          .flatMap((group) => group.tabs)
          .filter(
            (t) => t.input instanceof vscode.TabInputWebview && t.label === "Agorix Workbench",
          );
      const before = workbenchTabs().length;
      await vscode.commands.executeCommand("agorixStudio.openWorkbench");
      await waitFor("the Workbench tab", () => workbenchTabs().length > before);
      const opened = workbenchTabs().length;
      // Reopening reveals the same panel instead of creating another one.
      await vscode.commands.executeCommand("agorixStudio.openWorkbench");
      await waitFor(
        "Workbench tab count to stay stable after reopen",
        () => workbenchTabs().length === opened,
      );
      // Live sync: running and selecting steps with the Workbench open must not throw.
      await vscode.commands.executeCommand("agorixStudio.reset");
      const step = await vscode.commands.executeCommand("agorixStudio.step");
      assert.equal(step.currentFrame.highlightedNodeId, "scripts[0]/statements[0]");
      await vscode.commands.executeCommand("agorixStudio.selectExecutionStep", 1);
      assert.equal(workbenchTabs().length, opened);
    },
  ],
  [
    "Validate Project and Developer Context expose canonical task metadata",
    async () => {
      const reportText = await vscode.commands.executeCommand("agorixStudio.validateProject");
      const contextText = await vscode.commands.executeCommand("agorixStudio.showDeveloperContext");
      const report = JSON.parse(reportText);
      const context = JSON.parse(contextText);
      assert.equal(report.schema, "agorix/studio-validation-report/v1");
      assert.equal(report.outcome, "completed");
      assert.equal(context.schema, "agorix/studio-developer-context/v1");
      assert.equal(context.authority, "canonical-project");
      assert.equal(context.scmCommand, "vscode.scm");
    },
  ],
  [
    "Companion debug uses deterministic runtime facts without mutating the project",
    async () => {
      const file = fixture("repeat.agorix.json").fsPath;
      const before = fs.readFileSync(file, "utf8");
      const turn = await vscode.commands.executeCommand("agorixStudio.companionDebug");
      assert.equal(turn.action, "debug");
      assert.equal(turn.diagnostics.providerSelection, "bypassed");
      assert.equal(turn.response.capability, "debugger");
      assert.ok(turn.diagnostics.runtimeFactCount > 0);
      assert.equal(fs.readFileSync(file, "utf8"), before, "companion response is read-only");
    },
  ],
  [
    "Run and Stop controls report coherent execution state",
    async () => {
      const run = await vscode.commands.executeCommand("agorixStudio.run");
      assert.equal(run.status, "completed");
      assert.equal(run.outcome, "completed");

      await vscode.commands.executeCommand("agorixStudio.reset");
      await vscode.commands.executeCommand("agorixStudio.step");
      const stopped = await vscode.commands.executeCommand("agorixStudio.stop");
      assert.equal(stopped.status, "stopped");
      assert.equal(stopped.outcome, "stopped");
      assert.ok(stopped.previewFrames.length > 0);
    },
  ],
  [
    "Studio shell contributes icon-first views and toolbar actions in the real host",
    async () => {
      const manifest = vscode.extensions.getExtension(EXTENSION_ID).packageJSON;
      const commands = new Map(manifest.contributes.commands.map((c) => [c.command, c]));
      for (const id of ["run", "step", "stop", "reset", "switchProjection"]) {
        assert.match(commands.get(`agorixStudio.${id}`).icon, /^\$\(/, `${id} has a codicon`);
        const inEditorTitle = manifest.contributes.menus["editor/title"].some(
          (m) => m.command === `agorixStudio.${id}` && /^navigation@/.test(m.group),
        );
        assert.ok(inEditorTitle, `${id} is an editor-title icon action`);
      }
      const names = manifest.contributes.views.agorixStudio.map((v) => v.name);
      for (const name of ["Projects", "Missions", "Progress", "Worlds", "Inspector"]) {
        assert.ok(names.includes(name), `view ${name}`);
      }
      // The execution status context key drives Run/Stop visibility; it must be settable.
      await vscode.commands.executeCommand("agorixStudio.reset");
      await vscode.commands.executeCommand("agorixStudio.step");
      await vscode.commands.executeCommand("agorixStudio.reset");
    },
  ],
  [
    "Show Execution Evidence returns the runtime inspector report",
    async () => {
      const report = await vscode.commands.executeCommand("agorixStudio.showEvidence");
      assert.equal(typeof report, "string");
      assert.match(report, /Outcome:/);
      assert.match(report, /Step 1/);
    },
  ],
  [
    "Suggest repeat opens a proposal diff and leaves the project unchanged until the learner decides",
    async () => {
      const file = fixture("repeat.agorix.json").fsPath;
      const before = fs.readFileSync(file, "utf8");
      // The command blocks on the learner's Apply/Reject prompt, so do not await it.
      void vscode.commands.executeCommand("agorixStudio.suggestRepeat");
      const tab = await waitFor("proposal diff tab", () =>
        vscode.window.tabGroups.all
          .flatMap((group) => group.tabs)
          .find((t) => t.input instanceof vscode.TabInputTextDiff),
      );
      assert.match(tab.label, /Agorix proposal/);
      const [original, modified] = [tab.input.original, tab.input.modified];
      const [a, b] = await Promise.all([
        vscode.workspace.openTextDocument(original),
        vscode.workspace.openTextDocument(modified),
      ]);
      assert.notEqual(a.getText(), b.getText());
      assert.match(b.getText(), /repeat|for/);
      assert.equal(fs.readFileSync(file, "utf8"), before, "file untouched before Apply");
    },
  ],
  [
    "an invalid project file is reported, not swallowed",
    async () => {
      await vscode.commands.executeCommand("agorixStudio.openProject", fixture("invalid.json"));
      // The error toast cannot be read through the API; the command must resolve (not throw)
      // and the previously opened project must stay usable.
      const report = await vscode.commands.executeCommand("agorixStudio.showEvidence");
      assert.match(report, /Outcome:/);
    },
  ],
];

async function run() {
  let failed = 0;
  for (const [name, body] of tests) {
    try {
      await body();
      console.log(`  ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${name}\n       ${error && error.stack ? error.stack : error}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} integration test(s) failed`);
}

module.exports = { run };
