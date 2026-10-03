import * as vscode from "vscode";
import {
  applyProposalSession,
  createDeveloperContext,
  createExecutionViewState,
  createNavigationSections,
  createExecutionEvidence,
  createCompanionTurn,
  createStoredProjectWithProgram,
  createValidationReport,
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
  type StudioCompanionAction,
  type StudioCompanionTurn,
  type StudioExecutionEvidence,
  type StudioExecutionStatus,
  type StudioExecutionViewState,
  type StudioInspectorStep,
  type StudioProposalSession,
  type StudioProject,
  type StudioProjectionDocument,
  type StudioProjectionId,
  type StudioRemoteProjectPayload,
  type StudioRemoteProjectReference,
  type StudioRemoteSaveResult,
} from "./studioCore.js";

interface OpenProject {
  readonly uri: vscode.Uri;
  readonly project: StudioProject;
  readonly remote?: OpenRemoteProject;
}

interface OpenRemoteProject {
  readonly id: string;
  readonly title: string;
  readonly revision: string;
}

interface StudioRemoteClient {
  listProjects(): Promise<StudioRemoteProjectReference[]>;
  getProject(id: string): Promise<StudioRemoteProjectPayload>;
  saveProject(request: {
    readonly id: string;
    readonly expectedRevision: string;
    readonly project: StudioProject["stored"];
  }): Promise<StudioRemoteSaveResult>;
}

let current: OpenProject | undefined;
let currentProjectionId: StudioProjectionId = "typescript";
let executionEvidence: StudioExecutionEvidence | undefined;
let executionFrameIndex = 0;
let executionStatus: StudioExecutionStatus = "idle";
let worldPreviewPanel: vscode.WebviewPanel | undefined;
let activeProposal: StudioProposalSession | undefined;
const companionTurns: StudioCompanionTurn[] = [];
const undoStack: StoredSnapshot[] = [];
const redoStack: StoredSnapshot[] = [];

const PROJECTION_SCHEME = "agorix-studio";
const REMOTE_SCHEME = "agorix-remote";
const WORLD_PREVIEW_VIEW_TYPE = "agorixStudio.worldPreview";
const SECRET_TOKEN_KEY = "agorixStudio.accountToken";

interface StoredSnapshot {
  readonly uri: vscode.Uri;
  readonly raw: string;
}

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

class ExecutionInspectorItem extends vscode.TreeItem {
  constructor(readonly step: StudioInspectorStep) {
    super(`Step ${step.runtimeStep}: ${step.statementType ?? step.timing}`);
    this.description = step.nodeId ?? "run";
    this.contextValue = "agorixRuntimeFact";
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

  refresh(): void {
    this.#changed.fire();
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
  constructor(readonly turn: StudioCompanionTurn) {
    super(`${turn.action}: ${turn.message}`);
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
  readonly onDidChangeTreeData = this.#changed.event;

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: CompanionHistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CompanionHistoryItem[] {
    return companionTurns.map((turn) => new CompanionHistoryItem(turn));
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
    current = { uri, project: parseProjectFile(raw, uri.fsPath) };
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
  await openProjection(currentProjectionId);
}

function resetProjectSessionState(): void {
  executionEvidence = undefined;
  executionFrameIndex = 0;
  executionStatus = "idle";
  activeProposal = undefined;
  companionTurns.length = 0;
  undoStack.length = 0;
  redoStack.length = 0;
}

function requireProject(): OpenProject | undefined {
  if (current === undefined) {
    void vscode.window.showWarningMessage("Open an Agorix project first.");
  }
  return current;
}

function computeExecution(): StudioExecutionEvidence | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  executionEvidence ??= createExecutionEvidence(open.project.stored);
  return executionEvidence;
}

function currentExecutionView(): StudioExecutionViewState | undefined {
  return executionEvidence === undefined
    ? undefined
    : createExecutionViewState(executionEvidence, executionFrameIndex, executionStatus);
}

function setExecution(
  evidence: StudioExecutionEvidence,
  frameIndex: number,
  status: StudioExecutionStatus,
): StudioExecutionViewState {
  executionEvidence = evidence;
  executionStatus = status;
  const view = createExecutionViewState(evidence, frameIndex, status);
  executionFrameIndex = view.selectedFrameIndex;
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
    executionFrameIndex + 1,
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
  const step = createExecutionViewState(evidence, stepIndex, executionStatus).inspectorSteps[
    stepIndex
  ];
  const view = setExecution(evidence, step?.frameIndex ?? stepIndex, executionStatus);
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

function openWorldPreview(): StudioExecutionViewState | undefined {
  const view = currentExecutionView() ?? resetExecution();
  if (view === undefined) {
    return undefined;
  }
  if (worldPreviewPanel === undefined) {
    worldPreviewPanel = vscode.window.createWebviewPanel(
      WORLD_PREVIEW_VIEW_TYPE,
      "Agorix World Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true,
      },
    );
    worldPreviewPanel.onDidDispose(() => {
      worldPreviewPanel = undefined;
    });
  }
  updateWorldPreview(view);
  worldPreviewPanel.reveal(vscode.ViewColumn.Beside, true);
  return view;
}

function updateWorldPreview(view = currentExecutionView()): void {
  if (worldPreviewPanel === undefined || view === undefined) {
    return;
  }
  const nonce = nonceForWebview();
  worldPreviewPanel.webview.html = worldPreviewHtml(
    nonce,
    worldPreviewPanel.webview.cspSource,
    view,
  );
  void worldPreviewPanel.webview.postMessage({ type: "agorix-frame", view });
}

function nonceForWebview(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

function escapedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function worldPreviewHtml(
  nonce: string,
  cspSource: string,
  view: StudioExecutionViewState,
): string {
  const data = escapedJson(view);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agorix World Preview</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      --goal: var(--vscode-testing-iconPassed, #2e7d32);
      --sprite: var(--vscode-editorWarning-foreground, #c77700);
      --trail: var(--vscode-focusBorder, #007acc);
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }
    main {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
    }
    header,
    footer {
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    footer {
      border-top: 1px solid var(--vscode-panel-border);
      border-bottom: 0;
      color: var(--vscode-descriptionForeground);
    }
    .world {
      position: relative;
      width: min(92vmin, 760px);
      aspect-ratio: 1;
      place-self: center;
      border: 1px solid var(--vscode-panel-border);
      background:
        linear-gradient(var(--vscode-editorWidget-border, rgba(127,127,127,.18)) 1px, transparent 1px),
        linear-gradient(90deg, var(--vscode-editorWidget-border, rgba(127,127,127,.18)) 1px, transparent 1px),
        var(--vscode-editor-background);
      background-size: 12.5% 12.5%;
    }
    .goal,
    .sprite {
      position: absolute;
      width: 9%;
      height: 9%;
      translate: -50% 50%;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    .goal {
      color: var(--goal);
      border-radius: 50%;
      background: color-mix(in srgb, var(--goal), transparent 76%);
    }
    .sprite {
      color: var(--sprite);
      background: color-mix(in srgb, var(--sprite), transparent 64%);
      clip-path: polygon(50% 0, 100% 100%, 50% 78%, 0 100%);
      transition: left 180ms ease, bottom 180ms ease, rotate 180ms ease;
    }
    .node {
      color: var(--vscode-textLink-foreground);
      font-family: var(--vscode-editor-font-family);
    }
    @media (prefers-reduced-motion: reduce) {
      .sprite {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <strong id="status"></strong>
      <span id="step"></span>
      <span class="node" id="node"></span>
    </header>
    <section class="world" aria-label="Agorix shared runtime world preview">
      <div class="goal" id="goal" aria-label="goal"></div>
      <div class="sprite" id="sprite" aria-label="sprite"></div>
    </section>
    <footer id="provenance">Rendered from @agorix/stage frames produced by the canonical runtime.</footer>
  </main>
  <script nonce="${nonce}">
    const initialView = ${data};
    const vscode = acquireVsCodeApi();
    const status = document.getElementById("status");
    const step = document.getElementById("step");
    const node = document.getElementById("node");
    const goal = document.getElementById("goal");
    const sprite = document.getElementById("sprite");
    function place(element, point, viewport) {
      const x = (point.x / viewport.width) * 100;
      const y = (point.y / viewport.height) * 100;
      element.style.left = x + "%";
      element.style.bottom = y + "%";
    }
    function render(view) {
      const frame = view.currentFrame || view.previewFrames[0];
      if (!frame) return;
      status.textContent = view.status.toUpperCase() + " ";
      step.textContent = "frame " + (view.selectedFrameIndex + 1) + "/" + view.previewFrames.length;
      node.textContent = frame.highlightedNodeId ? " · " + frame.highlightedNodeId : " · run";
      place(goal, frame.state.goal, frame.state.viewport);
      place(sprite, frame.state.sprite, frame.state.viewport);
      sprite.style.rotate = (-frame.state.sprite.heading) + "deg";
      vscode.setState({ selectedFrameIndex: view.selectedFrameIndex });
    }
    render(initialView);
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "agorix-frame") render(event.data.view);
    });
  </script>
</body>
</html>`;
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
    ...(executionEvidence === undefined ? {} : { evidence: executionEvidence }),
  });
  companionTurns.unshift(turn);
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

async function reviewProposalSession(session: StudioProposalSession): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  activeProposal = session;
  refreshCompanionViews();
  const [before, after] = await Promise.all([
    vscode.workspace.openTextDocument({
      content: session.diff.acceptedCode,
      language: "javascript",
    }),
    vscode.workspace.openTextDocument({
      content: session.diff.proposedCode,
      language: "javascript",
    }),
  ]);
  await vscode.commands.executeCommand(
    "vscode.diff",
    before.uri,
    after.uri,
    `Agorix proposal: ${session.purpose}`,
  );
  if (session.affectedNodeIds[0] !== undefined) {
    await revealIfPresent(session.affectedNodeIds[0]);
  }
  const choice = await vscode.window.showInformationMessage(
    `${session.purpose}. ${session.rationale}`,
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
  if (activeProposal?.affectedNodeIds[0] !== undefined) {
    await revealIfPresent(activeProposal.affectedNodeIds[0]);
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
  if (open === undefined || activeProposal === undefined) {
    return;
  }
  const previousRaw = serializeStoredProject(open.project.stored);
  const decision = applyProposalSession(open.project.stored.program, activeProposal);
  const stored = createStoredProjectWithProgram(open.project.stored, decision.program);
  await writeCurrentProject(stored);
  undoStack.push({ uri: open.uri, raw: previousRaw });
  redoStack.length = 0;
  activeProposal = undefined;
  await vscode.window.showInformationMessage("Applied proposal. Use Undo Proposal to restore it.");
}

function rejectActiveProposal(): void {
  const open = requireProject();
  if (open === undefined || activeProposal === undefined) {
    return;
  }
  rejectProposalSession(open.project.stored.program, activeProposal);
  activeProposal = undefined;
  refreshCompanionViews();
  void vscode.window.showInformationMessage("Rejected proposal. Project unchanged.");
}

async function undoProposal(): Promise<void> {
  const open = requireProject();
  const previous = undoStack.pop();
  if (open === undefined || previous === undefined) {
    return;
  }
  redoStack.push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
  await restoreSnapshot(previous);
}

async function redoProposal(): Promise<void> {
  const open = requireProject();
  const next = redoStack.pop();
  if (open === undefined || next === undefined) {
    return;
  }
  undoStack.push({ uri: open.uri, raw: serializeStoredProject(open.project.stored) });
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
  current = {
    uri: open.uri,
    project: parseProjectFile(raw, open.uri.fsPath),
    ...(open.remote === undefined ? {} : { remote: open.remote }),
  };
  afterCanonicalProgramChange();
  await openProjection(currentProjectionId);
}

async function restoreSnapshot(snapshot: StoredSnapshot): Promise<void> {
  const remote = current?.remote;
  if (snapshot.uri.scheme !== REMOTE_SCHEME) {
    await vscode.workspace.fs.writeFile(snapshot.uri, new TextEncoder().encode(snapshot.raw));
  }
  current = {
    uri: snapshot.uri,
    project: parseProjectFile(snapshot.raw, snapshot.uri.fsPath),
    ...(remote === undefined ? {} : { remote }),
  };
  afterCanonicalProgramChange();
  await openProjection(currentProjectionId);
}

function afterCanonicalProgramChange(): void {
  executionEvidence = undefined;
  executionFrameIndex = 0;
  executionStatus = "idle";
  refreshStudioViews();
  refreshExecutionViews();
  refreshCompanionViews();
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

async function signOut(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_TOKEN_KEY);
  if (current?.remote !== undefined) {
    current = undefined;
    resetProjectSessionState();
    refreshStudioViews();
    refreshExecutionViews();
    refreshCompanionViews();
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
  current = {
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
  await openProjection(currentProjectionId);
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
    current = {
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
    current = {
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
    await openProjection(currentProjectionId);
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
  const inspectorProvider = new ExecutionInspectorProvider();
  const companionProvider = new CompanionHistoryProvider();
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
    projectionProvider.refresh(projectionUri(currentProjectionId));
  }
  refreshStudioViews = refreshViews;
  refreshExecutionViews = () => {
    inspectorProvider.refresh();
    updateWorldPreview();
  };
  refreshCompanionViews = () => {
    companionProvider.refresh();
  };
  try {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(PROJECTION_SCHEME, projectionProvider),
      ...treeProviders.map((provider) =>
        vscode.window.createTreeView(`agorixStudio.${provider.sectionId}`, {
          treeDataProvider: provider,
        }),
      ),
      vscode.window.createTreeView("agorixStudio.inspector", {
        treeDataProvider: inspectorProvider,
      }),
      vscode.window.createTreeView("agorixStudio.companionHistory", {
        treeDataProvider: companionProvider,
      }),
      vscode.commands.registerCommand(
        "agorixStudio.openProject",
        guarded(output, "Open Project", openProject),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.exportAgorix",
        guarded(output, "Export Agorix Project", exportAgorixProject),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.signIn",
        guarded(output, "Sign In", () => signIn(context)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.signOut",
        guarded(output, "Sign Out", () => signOut(context)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.listRemoteProjects",
        guarded(output, "List Remote Projects", () => listRemoteProjects(context)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.openRemoteProject",
        guarded(output, "Open Remote Project", () => openRemoteProject(context)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.saveRemoteProject",
        guarded(output, "Save Remote Project", () => saveRemoteProject(context)),
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
        "agorixStudio.openWorldPreview",
        guarded(output, "Open World Preview", openWorldPreview),
      ),
      vscode.commands.registerCommand("agorixStudio.run", guarded(output, "Run", runExecution)),
      vscode.commands.registerCommand("agorixStudio.step", guarded(output, "Step", stepExecution)),
      vscode.commands.registerCommand(
        "agorixStudio.reset",
        guarded(output, "Reset", resetExecution),
      ),
      vscode.commands.registerCommand("agorixStudio.stop", guarded(output, "Stop", stopExecution)),
      vscode.commands.registerCommand(
        "agorixStudio.selectExecutionStep",
        guarded(output, "Select Execution Step", selectExecutionStep),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.companionExplain",
        guarded(output, "Explain", () => companionCommand("explain")),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.companionChallenge",
        guarded(output, "Challenge", () => companionCommand("challenge")),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.companionDebug",
        guarded(output, "Debug", () => companionCommand("debug")),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.companionReflect",
        guarded(output, "Reflect", () => companionCommand("reflect")),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.companionBuild",
        guarded(output, "Build", () => companionCommand("build")),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.suggestFirstStep",
        guarded(output, "Suggest first step", suggestFirstStepCommand),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.applyProposal",
        guarded(output, "Apply Proposal", applyActiveProposal),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.rejectProposal",
        guarded(output, "Reject Proposal", rejectActiveProposal),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.revealProposalAffectedNode",
        guarded(output, "Reveal Proposal Affected Node", revealProposalAffectedNode),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.undoProposal",
        guarded(output, "Undo Proposal", undoProposal),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.redoProposal",
        guarded(output, "Redo Proposal", redoProposal),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.showEvidence",
        guarded(output, "Show Execution Evidence", () => showEvidence(output)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.validateProject",
        guarded(output, "Validate Project", () => validateProjectCommand(output)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.runChecks",
        guarded(output, "Run Checks", runChecksCommand),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.showDeveloperContext",
        guarded(output, "Show Developer Context", () => showDeveloperContext(output)),
      ),
      vscode.commands.registerCommand("agorixStudio.openScm", guarded(output, "Open SCM", openScm)),
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
  executionEvidence = undefined;
  worldPreviewPanel = undefined;
  activeProposal = undefined;
  companionTurns.length = 0;
  undoStack.length = 0;
  redoStack.length = 0;
}

let refreshStudioViews: () => void = () => undefined;
let refreshExecutionViews: () => void = () => undefined;
let refreshCompanionViews: () => void = () => undefined;
