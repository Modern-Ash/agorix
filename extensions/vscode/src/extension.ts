import * as vscode from "vscode";
import {} from "@agorix/block-editor";
import {
  applyProposalSession,
  createDeveloperContext,
  createExecutionViewState,
  createNavigationSections,
  createExecutionEvidence,
  createCompanionTurn,
  createStudioStarterProject,
  createStoredProjectWithProgram,
  createValidationReport,
  defaultStudioProjectFilename,
  formatInspectorReport,
  isStudioProjectionId,
  listStudioProjections,
  openProjectionDocument,
  parseProjectFile,
  projectionRangeForNode,
  rejectProposalSession,
  serializeProjectFile,
  serializeStoredProject,
  suggestFirstStep,
  suggestRepeat,
  STUDIO_STARTER_OPTIONS,
  type StudioCompanionAction,
  type StudioCompanionTurn,
  type StudioExecutionEvidence,
  type StudioExecutionStatus,
  STUDIO_STATE_THEME_COLORS,
  type StudioExecutionViewState,
  type StudioItemState,
  type StudioNavigationItem,
  type StudioInspectorStep,
  type StudioProposalSession,
  type StudioProject,
  type StudioProjectionDocument,
  type StudioProjectionId,
  type StudioRemoteProjectPayload,
  type StudioRemoteProjectReference,
  type StudioRemoteSaveResult,
  type StudioStarterId,
} from "./studioCore.js";
import { reportFailure } from "./commands/guarded.js";
import { registerStudioCommands } from "./commands/register.js";
import {
  PROJECTION_SCHEME,
  REMOTE_SCHEME,
  SECRET_AGENT_CREDENTIAL_KEY,
  SECRET_TOKEN_KEY,
  clearProjectSession,
  clearStudioSession,
  createStudioSessionState,
  type OpenProject,
  type StudioRemoteClient,
  type StoredSnapshot,
} from "./store/session.js";
import { homedir } from "node:os";
import { openWorkbenchPanel, refreshWorkbench, disposeWorkbench } from "./host/workbenchPanel.js";
import {
  openWorldPreviewPanel,
  refreshWorldPreview,
  disposeWorldPreview,
} from "./host/worldPreviewPanel.js";
import type { HostPort } from "./host/workbenchHost.js";
import { createAgentPort } from "./host/agentPort.js";
import type { AgentPort } from "./host/agentHost.js";
import {
  createStudioProviderClient,
  normalizeStudioProviderSettings,
  type StudioAgentStatus,
  type StudioProviderClient,
} from "./studioProvider.js";

const session = createStudioSessionState();

interface IdQuickPickItem<Id extends string> extends vscode.QuickPickItem {
  readonly id: Id;
}

interface CreateProjectCommandOptions {
  readonly name: string;
  readonly starter: StudioStarterId;
  readonly locale: "en" | "es";
  readonly uri: vscode.Uri;
}

function themeIcon(
  icon: string | undefined,
  state: StudioItemState | undefined,
): vscode.ThemeIcon | undefined {
  if (icon === undefined) {
    return undefined;
  }
  const color = state === undefined ? undefined : STUDIO_STATE_THEME_COLORS[state];
  return color === undefined
    ? new vscode.ThemeIcon(icon)
    : new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

class StudioTreeItem extends vscode.TreeItem {
  readonly children: readonly StudioNavigationItem[];
  readonly itemId: string;
  constructor(
    readonly sectionId: string,
    readonly item: StudioNavigationItem,
  ) {
    super(
      item.label,
      item.children === undefined || item.children.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.id = `${sectionId}/${item.id}`;
    this.children = item.children ?? [];
    this.itemId = item.id;
    if (item.description !== undefined) {
      this.description = item.description;
    }
    if (item.tooltip !== undefined) {
      this.tooltip = item.tooltip;
    }
    const icon = themeIcon(item.icon, item.state);
    if (icon !== undefined) {
      this.iconPath = icon;
    }
    if (item.contextValue !== undefined) {
      this.contextValue = item.contextValue;
    }
    if (item.command !== undefined) {
      this.command = { command: item.command, title: item.label };
    }
  }
}

class StudioTreeProvider implements vscode.TreeDataProvider<StudioTreeItem> {
  readonly #changed = new vscode.EventEmitter<StudioTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;
  view: vscode.TreeView<StudioTreeItem> | undefined;

  constructor(readonly sectionId: ReturnType<typeof createNavigationSections>[number]["id"]) {}

  refresh(): void {
    this.#changed.fire();
    if (this.view !== undefined) {
      const section = this.section();
      // Count/state beside the view title: glanceable without opening the view.
      this.view.description = section?.items.length === 0 ? "" : (section?.summary ?? "");
    }
  }

  private section() {
    return createNavigationSections(session.current?.project).find(
      (candidate) => candidate.id === this.sectionId,
    );
  }

  getTreeItem(element: StudioTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StudioTreeItem): StudioTreeItem[] {
    const items = element === undefined ? (this.section()?.items ?? []) : element.children;
    return items.map((item) => new StudioTreeItem(this.sectionId, item));
  }
}

const INSPECTOR_STEP_ICONS: Readonly<Record<string, string>> = {
  "before-statement": "debug-stackframe-dot",
  "after-statement": "pass",
};

class ExecutionInspectorItem extends vscode.TreeItem {
  constructor(readonly step: StudioInspectorStep) {
    super(`Step ${step.runtimeStep}: ${step.statementType ?? step.timing}`);
    this.description = step.nodeId ?? "run";
    this.contextValue = "agorixRuntimeFact";
    this.iconPath = new vscode.ThemeIcon(
      INSPECTOR_STEP_ICONS[step.timing] ?? "circle-outline",
      new vscode.ThemeColor("charts.blue"),
    );
    this.tooltip = `${step.provenance}\n${step.summary}\nbefore (${step.before.x}, ${step.before.y}) heading ${step.before.heading}\nafter (${step.after.x}, ${step.after.y}) heading ${step.after.heading}`;
    this.command = {
      command: "agorixStudio.selectExecutionStep",
      title: "Select Execution Step",
      arguments: [step.index],
    };
  }
}

class ExecutionInspectorProvider implements vscode.TreeDataProvider<ExecutionInspectorItem> {
  readonly #changed = new vscode.EventEmitter<ExecutionInspectorItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;
  view: vscode.TreeView<ExecutionInspectorItem> | undefined;

  refresh(): void {
    this.#changed.fire();
    if (this.view !== undefined) {
      const state = currentExecutionView();
      this.view.description =
        state === undefined
          ? ""
          : `${state.status} · ${state.selectedFrameIndex + 1}/${state.previewFrames.length}`;
    }
  }

  getTreeItem(element: ExecutionInspectorItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ExecutionInspectorItem[] {
    return (currentExecutionView()?.inspectorSteps ?? []).map(
      (step) => new ExecutionInspectorItem(step),
    );
  }
}

class CompanionHistoryItem extends vscode.TreeItem {
  constructor(
    readonly turn: StudioCompanionTurn,
    agentIcon: vscode.Uri,
  ) {
    super(`${turn.action}: ${turn.message}`);
    this.iconPath = agentIcon;
    this.description = `${turn.diagnostics.providerSelection} · ${turn.diagnostics.reasoningTier}`;
    this.contextValue = turn.proposal === undefined ? "agorixCompanionTurn" : "agorixProposal";
    this.tooltip = [
      turn.message,
      `provider: ${turn.diagnostics.providerSelection}`,
      `decision: ${turn.diagnostics.decisionSource}`,
      `context: ${turn.diagnostics.contextNeed}`,
      `runtime facts: ${turn.diagnostics.runtimeFactCount}`,
      turn.proposal === undefined ? "no proposal" : `proposal: ${turn.proposal.purpose}`,
    ].join("\n");
    if (turn.selectedNodeIds[0] !== undefined) {
      this.command = {
        command: "agorixStudio.revealCanonicalNode",
        title: "Reveal Companion Context",
        arguments: [turn.selectedNodeIds[0]],
      };
    }
  }
}

class CompanionHistoryProvider implements vscode.TreeDataProvider<CompanionHistoryItem> {
  readonly #changed = new vscode.EventEmitter<CompanionHistoryItem | undefined | null | void>();

  constructor(private readonly agentIcon: vscode.Uri) {}
  readonly onDidChangeTreeData = this.#changed.event;

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: CompanionHistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CompanionHistoryItem[] {
    return session.companionTurns.map((turn) => new CompanionHistoryItem(turn, this.agentIcon));
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
          filters: { "Agorix project": ["agorix", "json"] },
          openLabel: "Open Agorix project",
        })) ?? [])[0];
  if (uri === undefined) {
    return;
  }
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    session.current = { uri, project: parseProjectFile(raw, uri.fsPath) };
    resetProjectSessionState();
  } catch (error) {
    // Do not await: a toast resolves only when dismissed and would hang the command.
    void vscode.window.showErrorMessage(
      `Agorix Studio could not open this project: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return;
  }
  refreshStudioViews();
  refreshCompanionViews();
  updateStudioContext();
  await openProjection(session.currentProjectionId);
  await revealStudioPanels();
}

async function createProject(target?: unknown): Promise<vscode.Uri | undefined> {
  const picked = isCreateProjectCommandOptions(target)
    ? target
    : await promptForCreateProjectOptions();
  if (picked === undefined) return undefined;

  const stored = createStudioStarterProject({
    starter: picked.starter,
    locale: picked.locale,
  });
  const raw = serializeProjectFile(stored, picked.uri.fsPath);
  await vscode.workspace.fs.writeFile(picked.uri, new TextEncoder().encode(raw));
  session.current = { uri: picked.uri, project: parseProjectFile(raw, picked.uri.fsPath) };
  resetProjectSessionState();
  refreshStudioViews();
  refreshExecutionViews();
  refreshCompanionViews();
  updateStudioContext();
  await openProjection(session.currentProjectionId);
  await revealStudioPanels();
  void vscode.window.showInformationMessage(`Created Agorix project: ${picked.uri.fsPath}`);
  return picked.uri;
}

/** Shows Mundo Agorix beside the editor and focuses the Learning Companion view. */
async function revealStudioPanels(): Promise<void> {
  openWorldPreview();
  await vscode.commands.executeCommand("agorixStudio.companion.focus");
}

async function promptForCreateProjectOptions(): Promise<CreateProjectCommandOptions | undefined> {
  const name = await vscode.window.showInputBox({
    title: "Agorix project name",
    prompt: "Choose a name for the local .agorix project.",
    value: "Agorix first mission",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? "Enter a project name before creating a file." : undefined,
  });
  if (name === undefined) {
    return undefined;
  }

  const starterItems: IdQuickPickItem<StudioStarterId>[] = STUDIO_STARTER_OPTIONS.map((option) => ({
    label: option.label,
    description: option.description,
    id: option.id,
  }));
  const starter = await vscode.window.showQuickPick(starterItems, { title: "Agorix starter" });
  if (starter === undefined) {
    return undefined;
  }

  const vscodeLocale = vscode.env.language.toLowerCase();
  const localeItems: IdQuickPickItem<"en" | "es">[] = [
    {
      label: "English",
      id: "en",
      ...(vscodeLocale.startsWith("en") ? { description: "VS Code locale" } : {}),
    },
    {
      label: "Español",
      id: "es",
      ...(vscodeLocale.startsWith("es") ? { description: "VS Code locale" } : {}),
    },
  ];
  const locale = await vscode.window.showQuickPick(localeItems, { title: "Agorix language" });
  if (locale === undefined) {
    return undefined;
  }

  const filename = defaultStudioProjectFilename(name);
  const workspace = vscode.workspace.workspaceFolders?.[0];
  const baseDir = workspace === undefined ? homedir() : workspace.uri.fsPath;
  const defaultUri = vscode.Uri.file(`${baseDir.replace(/[\\/]$/, "")}/${filename}`);
  const uri = await vscode.window.showSaveDialog({
    filters: { "Agorix portable project": ["agorix"] },
    saveLabel: "Create Agorix project",
    defaultUri,
  });
  return uri === undefined ? undefined : { name, starter: starter.id, locale: locale.id, uri };
}

function isCreateProjectCommandOptions(value: unknown): value is CreateProjectCommandOptions {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "starter" in value &&
    (value.starter === "blank" || value.starter === "first-mission") &&
    "locale" in value &&
    (value.locale === "en" || value.locale === "es") &&
    "uri" in value &&
    value.uri instanceof vscode.Uri
  );
}

function resetProjectSessionState(): void {
  clearProjectSession(session);
  refreshWorkbench();
}

function updateStudioContext(): void {
  void vscode.commands.executeCommand(
    "setContext",
    "agorixStudio.hasProject",
    session.current !== undefined,
  );
}

function updateExecutionContext(): void {
  void vscode.commands.executeCommand(
    "setContext",
    "agorixStudio.executionStatus",
    session.executionStatus,
  );
}

function requireProject(): OpenProject | undefined {
  if (session.current === undefined) {
    void vscode.window.showWarningMessage("Open an Agorix project first.");
  }
  return session.current;
}

function computeExecution(): StudioExecutionEvidence | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  session.executionEvidence ??= createExecutionEvidence(open.project.stored);
  return session.executionEvidence;
}

function currentExecutionView(): StudioExecutionViewState | undefined {
  return session.executionEvidence === undefined
    ? undefined
    : createExecutionViewState(
        session.executionEvidence,
        session.executionFrameIndex,
        session.executionStatus,
      );
}

function setExecution(
  evidence: StudioExecutionEvidence,
  frameIndex: number,
  status: StudioExecutionStatus,
): StudioExecutionViewState {
  session.executionEvidence = evidence;
  session.executionStatus = status;
  const view = createExecutionViewState(evidence, frameIndex, status);
  session.executionFrameIndex = view.selectedFrameIndex;
  refreshExecutionViews();
  return view;
}

function resetExecution(): StudioExecutionViewState | undefined {
  const evidence = computeExecution();
  return evidence === undefined ? undefined : setExecution(evidence, 0, "idle");
}

function runExecution(): StudioExecutionViewState | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const evidence = createExecutionEvidence(open.project.stored);
  return setExecution(evidence, evidence.previewFrames.length - 1, "completed");
}

function stepExecution(): StudioExecutionViewState | undefined {
  const evidence = computeExecution();
  if (evidence === undefined) {
    return undefined;
  }
  const nextFrame = Math.min(
    session.executionFrameIndex + 1,
    Math.max(0, evidence.previewFrames.length - 1),
  );
  const status = nextFrame >= evidence.previewFrames.length - 1 ? "completed" : "running";
  return setExecution(evidence, nextFrame, status);
}

function stopExecution(): StudioExecutionViewState | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const currentFrame = currentExecutionView()?.currentFrame;
  const stoppedAt = currentFrame?.step ?? 0;
  const evidence = createExecutionEvidence(open.project.stored, { stopAfterSteps: stoppedAt });
  return setExecution(evidence, evidence.previewFrames.length - 1, "stopped");
}

async function selectExecutionStep(
  target?: unknown,
): Promise<StudioExecutionViewState | undefined> {
  const stepIndex =
    typeof target === "number"
      ? target
      : target instanceof ExecutionInspectorItem
        ? target.step.index
        : 0;
  const evidence = computeExecution();
  if (evidence === undefined) {
    return undefined;
  }
  const step = createExecutionViewState(evidence, stepIndex, session.executionStatus)
    .inspectorSteps[stepIndex];
  const view = setExecution(evidence, step?.frameIndex ?? stepIndex, session.executionStatus);
  if (step?.nodeId !== undefined) {
    await revealCanonicalNode(step.nodeId);
  }
  return view;
}

function showEvidence(output: vscode.OutputChannel): string | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const evidence = createExecutionEvidence(open.project.stored);
  setExecution(evidence, evidence.previewFrames.length - 1, "completed");
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
  return open === undefined
    ? undefined
    : openProjectionDocument(open.project, session.currentProjectionId);
}

function projectionUri(id: StudioProjectionId): vscode.Uri {
  const projectName =
    session.current?.uri.fsPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^A-Za-z0-9_.-]/g, "-") ?? "project";
  return vscode.Uri.parse(`${PROJECTION_SCHEME}:/${projectName}.${id}`);
}

function projectionIdFromUri(uri: vscode.Uri): StudioProjectionId {
  const match = uri.path.match(/\.([A-Za-z0-9-]+)$/);
  const id = match?.[1] ?? session.currentProjectionId;
  return isStudioProjectionId(id) ? id : session.currentProjectionId;
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
          : session.currentProjectionId;
  session.currentProjectionId = id;
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

function openWorldPreview(): StudioExecutionViewState | undefined {
  const view = currentExecutionView() ?? resetExecution();
  if (view === undefined) {
    return undefined;
  }
  openWorldPreviewPanel(view, (nodeId) => revealCanonicalNode(nodeId));
  return view;
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

async function companionCommand(
  action: StudioCompanionAction,
): Promise<StudioCompanionTurn | undefined> {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const selected = currentExecutionView()?.currentFrame?.highlightedNodeId;
  const turn = createCompanionTurn(open.project, action, {
    ...(selected === undefined ? {} : { selectedNodeIds: [selected] }),
    ...(session.executionEvidence === undefined ? {} : { evidence: session.executionEvidence }),
  });
  session.companionTurns.unshift(turn);
  refreshCompanionViews();
  if (turn.selectedNodeIds[0] !== undefined) {
    await revealCanonicalNode(turn.selectedNodeIds[0]);
  }
  if (turn.proposal !== undefined) {
    await reviewProposalSession(turn.proposal);
  } else {
    void vscode.window.showInformationMessage(turn.message);
  }
  return turn;
}

async function suggestFirstStepCommand(): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  const suggestion = suggestFirstStep(open.project);
  if (suggestion === undefined) {
    await vscode.window.showInformationMessage(
      "First-step proposal is only available for an empty script.",
    );
    return;
  }
  await reviewProposalSession(suggestion.session);
}

async function reviewProposalSession(proposalSession: StudioProposalSession): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  session.activeProposal = proposalSession;
  refreshCompanionViews();
  const [before, after] = await Promise.all([
    vscode.workspace.openTextDocument({
      content: proposalSession.diff.acceptedCode,
      language: "javascript",
    }),
    vscode.workspace.openTextDocument({
      content: proposalSession.diff.proposedCode,
      language: "javascript",
    }),
  ]);
  await vscode.commands.executeCommand(
    "vscode.diff",
    before.uri,
    after.uri,
    `Agorix proposal: ${proposalSession.purpose}`,
  );
  if (proposalSession.affectedNodeIds[0] !== undefined) {
    await revealIfPresent(proposalSession.affectedNodeIds[0]);
  }
  const choice = await vscode.window.showInformationMessage(
    `${proposalSession.purpose}. ${proposalSession.rationale}`,
    "Apply",
    "Reject",
  );
  if (choice === "Apply") {
    await applyActiveProposal();
  } else if (choice === "Reject") {
    rejectActiveProposal();
  }
}

async function revealProposalAffectedNode(): Promise<void> {
  if (session.activeProposal?.affectedNodeIds[0] !== undefined) {
    await revealIfPresent(session.activeProposal.affectedNodeIds[0]);
  }
}

async function revealIfPresent(nodeId: string): Promise<void> {
  try {
    await revealCanonicalNode(nodeId);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
  }
}

async function applyActiveProposal(): Promise<void> {
  const open = requireProject();
  if (open === undefined || session.activeProposal === undefined) {
    return;
  }
  const previousRaw = serializeStoredProject(open.project.stored);
  const decision = applyProposalSession(open.project.stored.program, session.activeProposal);
  const stored = createStoredProjectWithProgram(open.project.stored, decision.program);
  await writeCurrentProject(stored);
  session.undoStack.push({ uri: open.uri, raw: previousRaw });
  session.redoStack.length = 0;
  session.activeProposal = undefined;
  await vscode.window.showInformationMessage("Applied proposal. Use Undo Proposal to restore it.");
}

function rejectActiveProposal(): void {
  const open = requireProject();
  if (open === undefined || session.activeProposal === undefined) {
    return;
  }
  rejectProposalSession(open.project.stored.program, session.activeProposal);
  session.activeProposal = undefined;
  refreshCompanionViews();
  void vscode.window.showInformationMessage("Rejected proposal. Project unchanged.");
}

async function undoProposal(): Promise<void> {
  const open = requireProject();
  const previous = session.undoStack.pop();
  if (open === undefined || previous === undefined) {
    return;
  }
  session.redoStack.push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
  await restoreSnapshot(previous);
}

async function redoProposal(): Promise<void> {
  const open = requireProject();
  const next = session.redoStack.pop();
  if (open === undefined || next === undefined) {
    return;
  }
  session.undoStack.push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
  await restoreSnapshot(next);
}

async function writeCurrentProject(
  stored: ReturnType<typeof createStoredProjectWithProgram>,
): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  const raw = serializeProjectFile(stored, open.uri.fsPath);
  if (open.uri.scheme !== REMOTE_SCHEME) {
    await vscode.workspace.fs.writeFile(open.uri, new TextEncoder().encode(raw));
  }
  session.current = {
    uri: open.uri,
    project: parseProjectFile(raw, open.uri.fsPath),
    ...(open.remote === undefined ? {} : { remote: open.remote }),
  };
  afterCanonicalProgramChange();
  await openProjection(session.currentProjectionId);
}

async function restoreSnapshot(snapshot: StoredSnapshot): Promise<void> {
  const remote = session.current?.remote;
  if (snapshot.uri.scheme !== REMOTE_SCHEME) {
    await vscode.workspace.fs.writeFile(snapshot.uri, new TextEncoder().encode(snapshot.raw));
  }
  session.current = {
    uri: snapshot.uri,
    project: parseProjectFile(snapshot.raw, snapshot.uri.fsPath),
    ...(remote === undefined ? {} : { remote }),
  };
  afterCanonicalProgramChange();
  await openProjection(session.currentProjectionId);
}

function agentPortFor(): AgentPort {
  return createAgentPort({
    getProject: () => session.current?.project,
    getActiveProposal: () => session.activeProposal,
    setActiveProposal: (next) => {
      session.activeProposal = next;
      refreshCompanionViews();
    },
    applyActiveProposal,
    rejectActiveProposal,
    runAndGetResult: () => {
      runExecution();
      const result = session.executionEvidence?.result;
      return result === undefined
        ? undefined
        : { world: result.world, stepsUsed: result.stepsUsed };
    },
    events: session.agentEvents,
  });
}

function workbenchPort(): HostPort {
  return {
    getProgram: () => session.current?.project.stored.program,
    commit: async (program) => {
      const open = requireProject();
      if (open === undefined) {
        return;
      }
      const previousRaw = serializeStoredProject(open.project.stored);
      await writeCurrentProject(createStoredProjectWithProgram(open.project.stored, program));
      session.undoStack.push({ uri: open.uri, raw: previousRaw });
      session.redoStack.length = 0;
    },
    openProposalReview: async () => {
      if (session.activeProposal !== undefined) {
        await reviewProposalSession(session.activeProposal);
      }
    },
    reveal: (nodeId) => revealCanonicalNode(nodeId),
  };
}

function afterCanonicalProgramChange(): void {
  session.executionEvidence = undefined;
  session.executionFrameIndex = 0;
  session.executionStatus = "idle";
  refreshStudioViews();
  refreshExecutionViews();
  refreshCompanionViews();
  refreshWorkbench();
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
  await reviewProposalSession(suggestion.session);
}

async function exportAgorixProject(): Promise<vscode.Uri | undefined> {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const uri = await vscode.window.showSaveDialog({
    filters: { "Agorix portable project": ["agorix"] },
    saveLabel: "Export Agorix project",
    defaultUri: vscode.Uri.file("agorix-project.agorix"),
  });
  if (uri === undefined) {
    return undefined;
  }
  const raw = serializeProjectFile(open.project.stored, ".agorix");
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(raw));
  void vscode.window.showInformationMessage("Exported portable .agorix project.");
  return uri;
}

function validateProjectCommand(output: vscode.OutputChannel): string | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const report = createValidationReport(open.project.stored);
  const text = JSON.stringify(report, null, 2);
  output.clear();
  output.appendLine(text);
  output.show(true);
  void vscode.window.showInformationMessage(
    `Agorix validation ${report.outcome}; ${report.diagnostics.length} projection diagnostics.`,
  );
  return text;
}

async function runChecksCommand(): Promise<vscode.Task | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder === undefined) {
    await vscode.commands.executeCommand("workbench.action.tasks.runTask");
    return undefined;
  }
  const task = new vscode.Task(
    { type: "shell", task: "agorix-verify" },
    folder,
    "agorix: verify",
    "agorix",
    new vscode.ShellExecution("pnpm verify"),
    [],
  );
  task.problemMatchers = [];
  await vscode.tasks.executeTask(task);
  return task;
}

async function showDeveloperContext(output: vscode.OutputChannel): Promise<string | undefined> {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const context = createDeveloperContext(open.project.stored, {
    ...(open.remote === undefined ? {} : { revision: open.remote.revision }),
  });
  const text = JSON.stringify(context, null, 2);
  output.clear();
  output.appendLine(text);
  output.show(true);
  return text;
}

async function openScm(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.scm");
}

async function signIn(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    title: "Agorix account token",
    password: true,
    ignoreFocusOut: true,
    prompt: "Paste an Agorix API token. It will be stored in VS Code SecretStorage.",
  });
  if (token === undefined) {
    return;
  }
  await context.secrets.store(SECRET_TOKEN_KEY, token);
  void vscode.window.showInformationMessage(
    "Agorix account token stored in VS Code SecretStorage.",
  );
}

/**
 * Builds the Studio provider client from settings. The credential (only when a deployment
 * needs one) is read from SecretStorage at call time and is never logged or put in settings.
 */
export function createAgentClient(context: vscode.ExtensionContext): StudioProviderClient {
  const config = vscode.workspace.getConfiguration("agorixStudio.agent");
  const read = (key: string, fallback: unknown): unknown => config.get(key, fallback);
  const settings = normalizeStudioProviderSettings({
    enabled: read("enabled", true),
    endpoint: read("endpoint", ""),
    remoteEndpoint: read("remoteEndpoint", ""),
    preferLocal: read("preferLocal", true),
    allowRemote: read("allowRemote", false),
    healthTimeoutMs: read("healthTimeoutMs", 1500),
    requestTimeoutMs: read("requestTimeoutMs", 8000),
  });
  return createStudioProviderClient({
    settings,
    fetch: (input, init) => fetch(input, init),
    getCredential: () => context.secrets.get(SECRET_AGENT_CREDENTIAL_KEY),
    locale: vscode.env.language,
  });
}

function agentStatusText(status: StudioAgentStatus): string {
  const label = { available: "ready", unavailable: "unavailable", disabled: "off" }[status.state];
  return `$(sparkle) Agent: ${label}`;
}

/** Probes the boundary and updates the status item. Never throws, never blocks editing. */
async function refreshAgentStatus(
  context: vscode.ExtensionContext,
  item: vscode.StatusBarItem,
): Promise<StudioAgentStatus> {
  let status: StudioAgentStatus;
  try {
    status = await createAgentClient(context).probe();
  } catch {
    status = { state: "unavailable", message: "AI help is unavailable right now." };
  }
  item.text = agentStatusText(status);
  item.tooltip = status.message;
  item.show();
  return status;
}

async function setAgentCredential(context: vscode.ExtensionContext): Promise<void> {
  const value = await vscode.window.showInputBox({
    title: "Agent deployment credential",
    password: true,
    ignoreFocusOut: true,
    prompt: "Only needed if your tutor API deployment requires one. Stored in SecretStorage.",
  });
  if (value === undefined || value.length === 0) {
    return;
  }
  await context.secrets.store(SECRET_AGENT_CREDENTIAL_KEY, value);
  void vscode.window.showInformationMessage("Agent credential stored in VS Code SecretStorage.");
}

async function clearAgentCredential(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_AGENT_CREDENTIAL_KEY);
  void vscode.window.showInformationMessage("Agent credential removed.");
}

async function signOut(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_TOKEN_KEY);
  if (session.current?.remote !== undefined) {
    session.current = undefined;
    resetProjectSessionState();
    refreshStudioViews();
    refreshExecutionViews();
    refreshCompanionViews();
    updateStudioContext();
  }
  void vscode.window.showInformationMessage("Signed out of Agorix Studio.");
}

async function listRemoteProjects(
  context: vscode.ExtensionContext,
): Promise<StudioRemoteProjectReference[]> {
  const client = await createRemoteClient(context);
  if (client === undefined) {
    return [];
  }
  const projects = await client.listProjects();
  return projects;
}

async function openRemoteProject(context: vscode.ExtensionContext): Promise<void> {
  const client = await createRemoteClient(context);
  if (client === undefined) {
    return;
  }
  const projects = await client.listProjects();
  const picked = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.title,
      description: project.revision,
      project,
    })),
    { title: "Agorix projects" },
  );
  if (picked === undefined) {
    return;
  }
  const remote = await client.getProject(picked.project.id);
  session.current = {
    uri: vscode.Uri.parse(`${REMOTE_SCHEME}:/${encodeURIComponent(remote.id)}.agorix`),
    project: openRemotePayload(remote),
    remote: {
      id: remote.id,
      title: remote.title,
      revision: remote.revision,
    },
  };
  resetProjectSessionState();
  refreshStudioViews();
  refreshCompanionViews();
  updateStudioContext();
  await openProjection(session.currentProjectionId);
}

async function saveRemoteProject(
  context: vscode.ExtensionContext,
): Promise<StudioRemoteSaveResult | undefined> {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  if (open.remote === undefined) {
    void vscode.window.showWarningMessage(
      "Open an authenticated Agorix project before saving to server.",
    );
    return undefined;
  }
  const client = await createRemoteClient(context);
  if (client === undefined) {
    return undefined;
  }
  const result = await client.saveProject({
    id: open.remote.id,
    expectedRevision: open.remote.revision,
    project: open.project.stored,
  });
  if (result.status === "saved") {
    session.current = {
      ...open,
      project: openRemotePayload({
        id: open.remote.id,
        title: open.remote.title,
        revision: result.revision,
        project: result.project,
      }),
      remote: { ...open.remote, revision: result.revision },
    };
    refreshStudioViews();
    void vscode.window.showInformationMessage(
      `Saved ${open.remote.title} at revision ${result.revision}.`,
    );
    return result;
  }
  const choice = await vscode.window.showWarningMessage(
    `Server has revision ${result.actualRevision}; local expected ${result.expectedRevision}.`,
    "Reload Latest",
    "Export Copy",
    "Cancel",
  );
  if (choice === "Reload Latest" && result.latest !== undefined) {
    session.current = {
      ...open,
      project: openRemotePayload({
        id: open.remote.id,
        title: open.remote.title,
        revision: result.actualRevision,
        project: result.latest,
      }),
      remote: { ...open.remote, revision: result.actualRevision },
    };
    resetProjectSessionState();
    refreshStudioViews();
    await openProjection(session.currentProjectionId);
  } else if (choice === "Export Copy") {
    await exportAgorixProject();
  }
  return result;
}

function openRemotePayload(payload: StudioRemoteProjectPayload): StudioProject {
  return parseProjectFile(serializeStoredProject(payload.project), `${payload.id}.json`);
}

async function createRemoteClient(
  context: vscode.ExtensionContext,
): Promise<StudioRemoteClient | undefined> {
  const serverUrl = vscode.workspace
    .getConfiguration("agorixStudio")
    .get<string>("serverUrl", "")
    .trim()
    .replace(/\/+$/, "");
  if (serverUrl.length === 0) {
    void vscode.window.showWarningMessage(
      "Configure agorixStudio.serverUrl before using accounts.",
    );
    return undefined;
  }
  const token = await context.secrets.get(SECRET_TOKEN_KEY);
  if (token === undefined || token.length === 0) {
    void vscode.window.showWarningMessage("Sign in to Agorix Studio before using server projects.");
    return undefined;
  }
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${serverUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const text = await response.text();
    const json = text.length === 0 ? undefined : JSON.parse(text);
    if (!response.ok && response.status !== 409) {
      throw new Error(`server ${response.status}: ${response.statusText}`);
    }
    return json as T;
  };
  return {
    listProjects: () => request<StudioRemoteProjectReference[]>("/projects"),
    getProject: (id) => request<StudioRemoteProjectPayload>(`/projects/${encodeURIComponent(id)}`),
    saveProject: (saveRequest) =>
      request<StudioRemoteSaveResult>(`/projects/${encodeURIComponent(saveRequest.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          expectedRevision: saveRequest.expectedRevision,
          project: saveRequest.project,
        }),
      }),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Agorix Studio");
  context.subscriptions.push(output);
  const agentStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  agentStatusItem.command = "agorixStudio.checkAgentHealth";
  context.subscriptions.push(agentStatusItem);
  const projectionProvider = new ProjectionDocumentProvider();
  const inspectorProvider = new ExecutionInspectorProvider();
  const companionProvider = new CompanionHistoryProvider(
    vscode.Uri.file(context.asAbsolutePath("media/agorix-agent-active.svg")),
  );
  const treeProviders = [
    new StudioTreeProvider("projects"),
    new StudioTreeProvider("missions"),
    new StudioTreeProvider("progress"),
    new StudioTreeProvider("worlds"),
    new StudioTreeProvider("companion"),
    new StudioTreeProvider("developer"),
  ];
  function refreshViews(): void {
    for (const provider of treeProviders) {
      provider.refresh();
    }
    projectionProvider.refresh(projectionUri(session.currentProjectionId));
  }
  refreshStudioViews = refreshViews;
  refreshExecutionViews = () => {
    updateExecutionContext();
    inspectorProvider.refresh();
    refreshWorldPreview(currentExecutionView());
  };
  refreshCompanionViews = () => {
    companionProvider.refresh();
  };
  try {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(PROJECTION_SCHEME, projectionProvider),
      ...treeProviders.map((provider) => {
        provider.view = vscode.window.createTreeView(`agorixStudio.${provider.sectionId}`, {
          treeDataProvider: provider,
        });
        return provider.view;
      }),
      (inspectorProvider.view = vscode.window.createTreeView("agorixStudio.inspector", {
        treeDataProvider: inspectorProvider,
      })),
      vscode.window.createTreeView("agorixStudio.companionHistory", {
        treeDataProvider: companionProvider,
      }),
      ...registerStudioCommands(output, {
        createProject,
        openProject,
        exportAgorixProject,
        checkAgentHealth: async () => {
          const status = await refreshAgentStatus(context, agentStatusItem);
          void vscode.window.showInformationMessage(status.message);
        },
        setAgentCredential: () => setAgentCredential(context),
        clearAgentCredential: () => clearAgentCredential(context),
        signIn: () => signIn(context),
        signOut: () => signOut(context),
        listRemoteProjects: () => listRemoteProjects(context),
        openRemoteProject: () => openRemoteProject(context),
        saveRemoteProject: () => saveRemoteProject(context),
        openProjection,
        switchProjection,
        revealCanonicalNode,
        openWorldPreview,
        runExecution,
        stepExecution,
        resetExecution,
        stopExecution,
        selectExecutionStep,
        companionExplain: () => companionCommand("explain"),
        companionChallenge: () => companionCommand("challenge"),
        companionDebug: () => companionCommand("debug"),
        companionReflect: () => companionCommand("reflect"),
        companionBuild: () => companionCommand("build"),
        suggestFirstStep: suggestFirstStepCommand,
        applyProposal: applyActiveProposal,
        rejectProposal: rejectActiveProposal,
        revealProposalAffectedNode,
        undoProposal,
        redoProposal,
        showEvidence: () => showEvidence(output),
        validateProject: () => validateProjectCommand(output),
        runChecks: runChecksCommand,
        openWorkbench: async () => {
          if (requireProject() === undefined) {
            return;
          }
          openWorkbenchPanel(context, workbenchPort(), agentPortFor());
          refreshWorkbench();
        },
        showDeveloperContext: () => showDeveloperContext(output),
        openScm,
        suggestRepeat: suggestRepeatCommand,
      }),
    );
    updateStudioContext();
    // Fire and forget: a slow or failing provider must never delay activation or editing.
    void refreshAgentStatus(context, agentStatusItem);
  } catch (error) {
    reportFailure(output, "activation failed", error);
    output.show(true);
    throw error;
  }
}

export function deactivate(): void {
  disposeWorkbench();
  disposeWorldPreview();
  clearStudioSession(session);
}

let refreshStudioViews: () => void = () => undefined;
let refreshExecutionViews: () => void = () => undefined;
let refreshCompanionViews: () => void = () => undefined;
