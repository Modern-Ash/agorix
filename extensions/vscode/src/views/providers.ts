import * as vscode from "vscode";
import {
  createNavigationSections,
  openProjectionDocument,
  type StudioCompanionTurn,
  type StudioExecutionViewState,
  type StudioInspectorStep,
  type StudioProject,
  type StudioProjectionId,
} from "../studioCore.js";

export class StudioTreeItem extends vscode.TreeItem {
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
