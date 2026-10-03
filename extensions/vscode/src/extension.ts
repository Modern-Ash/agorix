import * as vscode from "vscode";
import {
  applyProposal,
  createNavigationSections,
  createExecutionEvidence,
  createStoredProjectWithProgram,
  formatInspectorReport,
  isStudioProjectionId,
  listStudioProjections,
  openProjectionDocument,
  parseStoredProject,
  projectionRangeForNode,
  serializeStoredProject,
  suggestRepeat,
  type StudioProject,
  type StudioProjectionDocument,
  type StudioProjectionId,
} from "./studioCore.js";

interface OpenProject {
  readonly uri: vscode.Uri;
  readonly project: StudioProject;
}

let current: OpenProject | undefined;
let currentProjectionId: StudioProjectionId = "typescript";

const PROJECTION_SCHEME = "agorix-studio";

class StudioTreeItem extends vscode.TreeItem {
  constructor(
    readonly sectionId: string,
    readonly itemId: string,
    label: string,
    description: string | undefined,
    command: string | undefined,
    contextValue: string | undefined,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    if (description !== undefined) {
      this.description = description;
    }
    if (contextValue !== undefined) {
      this.contextValue = contextValue;
    }
    if (command !== undefined) {
      this.command = { command, title: label };
    }
  }
}

class StudioTreeProvider implements vscode.TreeDataProvider<StudioTreeItem> {
  readonly #changed = new vscode.EventEmitter<StudioTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;

  constructor(readonly sectionId: ReturnType<typeof createNavigationSections>[number]["id"]) {}

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: StudioTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): StudioTreeItem[] {
    const section = createNavigationSections(current?.project).find(
      (candidate) => candidate.id === this.sectionId,
    );
    return (section?.items ?? []).map(
      (item) =>
        new StudioTreeItem(
          this.sectionId,
          item.id,
          item.label,
          item.description,
          item.command,
          item.contextValue,
        ),
    );
  }
}

class ProjectionDocumentProvider implements vscode.TextDocumentContentProvider {
  readonly #changed = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.#changed.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    const id = projectionIdFromUri(uri);
    const project = requireProject();
    return project === undefined ? "" : openProjectionDocument(project.project, id).text;
  }

  refresh(uri: vscode.Uri): void {
    this.#changed.fire(uri);
  }
}

/**
 * Opens a stored project. An explicit `uri` argument (command palette callers,
 * Explorer context, integration tests) skips the file picker.
 */
async function openProject(target?: unknown): Promise<void> {
  const uri =
    target instanceof vscode.Uri
      ? target
      : ((await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { "Agorix project": ["json"] },
          openLabel: "Open Agorix project",
        })) ?? [])[0];
  if (uri === undefined) {
    return;
  }
  try {
    const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    current = { uri, project: parseStoredProject(raw) };
  } catch (error) {
    // Do not await: a toast resolves only when dismissed and would hang the command.
    void vscode.window.showErrorMessage(
      `Agorix Studio could not open this project: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return;
  }
  refreshStudioViews();
  await openProjection(currentProjectionId);
}

function requireProject(): OpenProject | undefined {
  if (current === undefined) {
    void vscode.window.showWarningMessage("Open an Agorix project first.");
  }
  return current;
}

function showEvidence(output: vscode.OutputChannel): string | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const evidence = createExecutionEvidence(open.project.stored);
  const report = formatInspectorReport(evidence);
  output.clear();
  output.appendLine(report);
  output.show(true);
  const firstNode = evidence.stepSequence.find((step) => step.nodeId !== undefined)?.nodeId;
  if (firstNode !== undefined) {
    void revealCanonicalNode(firstNode);
  }
  return report;
}

function currentProjection(): StudioProjectionDocument | undefined {
  const open = requireProject();
  return open === undefined ? undefined : openProjectionDocument(open.project, currentProjectionId);
}

function projectionUri(id: StudioProjectionId): vscode.Uri {
  const projectName =
    current?.uri.fsPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^A-Za-z0-9_.-]/g, "-") ?? "project";
  return vscode.Uri.parse(`${PROJECTION_SCHEME}:/${projectName}.${id}`);
}

function projectionIdFromUri(uri: vscode.Uri): StudioProjectionId {
  const match = uri.path.match(/\.([A-Za-z0-9-]+)$/);
  const id = match?.[1] ?? currentProjectionId;
  return isStudioProjectionId(id) ? id : currentProjectionId;
}

async function openProjection(target?: unknown): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  const id =
    typeof target === "string" && isStudioProjectionId(target)
      ? target
      : target instanceof StudioTreeItem && isStudioProjectionId(target.itemId)
        ? target.itemId
        : typeof target === "object" &&
            target !== null &&
            "id" in target &&
            typeof target.id === "string" &&
            isStudioProjectionId(target.id)
          ? target.id
          : currentProjectionId;
  currentProjectionId = id;
  const projection = openProjectionDocument(open.project, id);
  const document = await vscode.workspace.openTextDocument(projectionUri(id));
  await vscode.window.showTextDocument(document, { preview: false });
  await vscode.languages.setTextDocumentLanguage(document, projection.languageId);
  void vscode.window.showInformationMessage(projection.readOnlyReason);
}

async function switchProjection(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    listStudioProjections().map((projection) => ({
      label: projection.label,
      description: projection.id,
      id: projection.id,
    })),
    { title: "Agorix projection" },
  );
  if (picked !== undefined && isStudioProjectionId(picked.id)) {
    await openProjection(picked.id);
  }
}

async function revealCanonicalNode(nodeId?: unknown): Promise<void> {
  const projection = currentProjection();
  if (projection === undefined) {
    return;
  }
  const id = typeof nodeId === "string" ? nodeId : "scripts[0]/statements[0]";
  const range = projectionRangeForNode(projection, id);
  const document = await vscode.workspace.openTextDocument(projectionUri(projection.id));
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  const vscodeRange = textRangeToVsCodeRange(projection.text, range);
  editor.selection = new vscode.Selection(vscodeRange.start, vscodeRange.end);
  editor.revealRange(vscodeRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

function textRangeToVsCodeRange(
  text: string,
  range: { readonly start: number; readonly end: number },
): vscode.Range {
  return new vscode.Range(offsetToPosition(text, range.start), offsetToPosition(text, range.end));
}

function offsetToPosition(text: string, offset: number): vscode.Position {
  const before = text.slice(0, offset);
  const lines = before.split("\n");
  return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0);
}

async function suggestRepeatCommand(): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  const suggestion = suggestRepeat(open.project);
  if (suggestion === undefined) {
    await vscode.window.showInformationMessage("Nothing repeated here. No suggestion.");
    return;
  }
  const [before, after] = await Promise.all([
    vscode.workspace.openTextDocument({
      content: suggestion.diff.acceptedCode,
      language: "javascript",
    }),
    vscode.workspace.openTextDocument({
      content: suggestion.diff.proposedCode,
      language: "javascript",
    }),
  ]);
  await vscode.commands.executeCommand(
    "vscode.diff",
    before.uri,
    after.uri,
    "Agorix suggestion: use repeat",
  );
  const choice = await vscode.window.showInformationMessage(
    "Suggestion: write the repeated steps once with repeat. Your project is unchanged until you apply it.",
    "Apply",
    "Reject",
  );
  if (choice !== "Apply") {
    return;
  }
  const program = applyProposal(open.project.stored.program, suggestion.review);
  const stored = createStoredProjectWithProgram(open.project.stored, program);
  await vscode.workspace.fs.writeFile(
    open.uri,
    new TextEncoder().encode(serializeStoredProject(stored)),
  );
  current = { uri: open.uri, project: parseStoredProject(serializeStoredProject(stored)) };
  await vscode.window.showInformationMessage("Applied. Run Show Execution Evidence to check it.");
}

/** Runs a command body and surfaces any failure to the learner instead of failing silently. */
function guarded<Args extends unknown[], Result>(
  output: vscode.OutputChannel,
  name: string,
  body: (...args: Args) => Result | Promise<Result>,
): (...args: Args) => Promise<Result | undefined> {
  return async (...args) => {
    try {
      return await body(...args);
    } catch (error) {
      reportFailure(output, `${name} failed`, error);
      return undefined;
    }
  };
}

function reportFailure(output: vscode.OutputChannel, summary: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  output.appendLine(`[error] ${summary}: ${detail}`);
  if (error instanceof Error && error.stack !== undefined) {
    output.appendLine(error.stack);
  }
  void vscode.window.showErrorMessage(`Agorix Studio: ${summary}. ${detail}`);
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Agorix Studio");
  context.subscriptions.push(output);
  const projectionProvider = new ProjectionDocumentProvider();
  const treeProviders = [
    new StudioTreeProvider("projects"),
    new StudioTreeProvider("missions"),
    new StudioTreeProvider("progress"),
    new StudioTreeProvider("worlds"),
    new StudioTreeProvider("companion"),
  ];
  function refreshViews(): void {
    for (const provider of treeProviders) {
      provider.refresh();
    }
    projectionProvider.refresh(projectionUri(currentProjectionId));
  }
  refreshStudioViews = refreshViews;
  try {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(PROJECTION_SCHEME, projectionProvider),
      ...treeProviders.map((provider) =>
        vscode.window.createTreeView(`agorixStudio.${provider.sectionId}`, {
          treeDataProvider: provider,
        }),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.openProject",
        guarded(output, "Open Project", openProject),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.openProjection",
        guarded(output, "Open Projection", openProjection),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.switchProjection",
        guarded(output, "Switch Projection", switchProjection),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.revealCanonicalNode",
        guarded(output, "Reveal Canonical Node", revealCanonicalNode),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.showEvidence",
        guarded(output, "Show Execution Evidence", () => showEvidence(output)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.suggestRepeat",
        guarded(output, "Suggest repeat", suggestRepeatCommand),
      ),
    );
  } catch (error) {
    reportFailure(output, "activation failed", error);
    output.show(true);
    throw error;
  }
}

export function deactivate(): void {
  current = undefined;
}

let refreshStudioViews: () => void = () => undefined;
