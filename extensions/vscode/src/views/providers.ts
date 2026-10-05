import * as vscode from "vscode";
import {
  createNavigationSections,
  openProjectionDocument,
  STUDIO_STATE_THEME_COLORS,
  type StudioCompanionTurn,
  type StudioExecutionViewState,
  type StudioInspectorStep,
  type StudioNavigationItem,
  type StudioProject,
  type StudioProjectionId,
} from "../studioCore.js";

export class StudioTreeItem extends vscode.TreeItem {
  constructor(
    readonly sectionId: string,
    readonly itemId: string,
    label: string,
    description: string | undefined,
    icon: string | undefined,
    state: StudioNavigationItem["state"] | undefined,
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
    const themeIcon = iconFor(icon, state);
    if (themeIcon !== undefined) {
      this.iconPath = themeIcon;
    }
    if (command !== undefined) {
      this.command = { command, title: label };
    }
  }
}

export class StudioTreeProvider implements vscode.TreeDataProvider<StudioTreeItem> {
  readonly #changed = new vscode.EventEmitter<StudioTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;

  constructor(
    readonly sectionId: ReturnType<typeof createNavigationSections>[number]["id"],
    private readonly getProject: () => StudioProject | undefined,
  ) {}

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: StudioTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): StudioTreeItem[] {
    const section = createNavigationSections(this.getProject()).find(
      (candidate) => candidate.id === this.sectionId,
    );
    return (section?.items ?? []).map(
      (item) =>
        new StudioTreeItem(
          this.sectionId,
          item.id,
          item.label,
          item.description,
          item.icon,
          item.state,
          item.command,
          item.contextValue,
        ),
    );
  }
}

export class ExecutionInspectorItem extends vscode.TreeItem {
  constructor(readonly step: StudioInspectorStep) {
    super(`Step ${step.runtimeStep}: ${step.statementType ?? step.timing}`);
    this.description = step.nodeId ?? "run";
    this.id = `step-${step.index}`;
    this.contextValue = "agorixRuntimeFact";
    this.tooltip = `${step.provenance}\n${step.summary}\nbefore (${step.before.x}, ${step.before.y}) heading ${step.before.heading}\nafter (${step.after.x}, ${step.after.y}) heading ${step.after.heading}`;
    this.command = {
      command: "agorixStudio.selectExecutionStep",
      title: "Select Execution Step",
      arguments: [step.index],
    };
  }
}

export class ExecutionInspectorProvider implements vscode.TreeDataProvider<ExecutionInspectorItem> {
  readonly #changed = new vscode.EventEmitter<ExecutionInspectorItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;

  constructor(
    private readonly getCurrentExecutionView: () => StudioExecutionViewState | undefined,
  ) {}

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: ExecutionInspectorItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ExecutionInspectorItem[] {
    return (this.getCurrentExecutionView()?.inspectorSteps ?? []).map(
      (step) => new ExecutionInspectorItem(step),
    );
  }
}

export class CompanionHistoryItem extends vscode.TreeItem {
  constructor(
    readonly turn: StudioCompanionTurn,
    agentIcon: vscode.Uri,
  ) {
    super(shortActionLabel(turn.action));
    this.iconPath = agentIcon;
    this.description = `${turn.diagnostics.providerSelection} · ${turn.diagnostics.runtimeFactCount} facts`;
    this.accessibilityInformation = { label: `${turn.action}: ${turn.message}` };
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

export class CompanionHistoryProvider implements vscode.TreeDataProvider<CompanionHistoryItem> {
  readonly #changed = new vscode.EventEmitter<CompanionHistoryItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.#changed.event;

  constructor(
    private readonly getTurns: () => readonly StudioCompanionTurn[],
    private readonly agentIcon: vscode.Uri,
  ) {}

  refresh(): void {
    this.#changed.fire();
  }

  getTreeItem(element: CompanionHistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): CompanionHistoryItem[] {
    return this.getTurns().map((turn) => new CompanionHistoryItem(turn, this.agentIcon));
  }
}

function iconFor(
  icon: string | undefined,
  state: StudioNavigationItem["state"] | undefined,
): vscode.ThemeIcon | undefined {
  if (icon === undefined) return undefined;
  const color = state === undefined ? undefined : STUDIO_STATE_THEME_COLORS[state];
  return color === undefined
    ? new vscode.ThemeIcon(icon)
    : new vscode.ThemeIcon(icon, new vscode.ThemeColor(color));
}

function shortActionLabel(action: StudioCompanionTurn["action"]): string {
  switch (action) {
    case "explain":
      return "Explain";
    case "challenge":
      return "Challenge";
    case "debug":
      return "Debug";
    case "reflect":
      return "Reflect";
    case "build":
      return "Proposal";
  }
}

export class ProjectionDocumentProvider implements vscode.TextDocumentContentProvider {
  readonly #changed = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.#changed.event;

  constructor(
    private readonly getProject: () => StudioProject | undefined,
    private readonly projectionIdFromUri: (uri: vscode.Uri) => StudioProjectionId,
  ) {}

  provideTextDocumentContent(uri: vscode.Uri): string {
    const id = this.projectionIdFromUri(uri);
    const project = this.getProject();
    return project === undefined ? "" : openProjectionDocument(project, id).text;
  }

  refresh(uri: vscode.Uri): void {
    this.#changed.fire(uri);
  }
}
