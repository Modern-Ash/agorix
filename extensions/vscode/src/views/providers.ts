import * as vscode from "vscode";
import { t } from "../l10n.js";
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
    super(t(label), vscode.TreeItemCollapsibleState.None);
    if (description !== undefined) {
      this.description = t(description);
    }
    if (contextValue !== undefined) {
      this.contextValue = contextValue;
    }
    const themeIcon = iconFor(icon, state);
    if (themeIcon !== undefined) {
      this.iconPath = themeIcon;
    }
    if (command !== undefined) {
      this.command = { command, title: t(label) };
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
    super(t("Step {0}: {1}", step.runtimeStep, step.statementType ?? step.timing));
    this.description = step.nodeId ?? t("run");
    this.id = `step-${step.index}`;
    this.contextValue = "agorixRuntimeFact";
    this.tooltip = [
      step.provenance,
      step.summary,
      t("before ({0}, {1}) heading {2}", step.before.x, step.before.y, step.before.heading),
      t("after ({0}, {1}) heading {2}", step.after.x, step.after.y, step.after.heading),
    ].join("\n");
    this.command = {
      command: "agorixStudio.selectExecutionStep",
      title: t("Select Execution Step"),
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
    this.description = t(
      "{0} · {1} facts",
      turn.diagnostics.providerSelection,
      turn.diagnostics.runtimeFactCount,
    );
    this.accessibilityInformation = { label: `${turn.action}: ${turn.message}` };
    this.contextValue = turn.proposal === undefined ? "agorixCompanionTurn" : "agorixProposal";
    this.tooltip = [
      turn.message,
      t("provider: {0}", turn.diagnostics.providerSelection),
      t("decision: {0}", turn.diagnostics.decisionSource),
      t("context: {0}", turn.diagnostics.contextNeed),
      t("runtime facts: {0}", turn.diagnostics.runtimeFactCount),
      turn.proposal === undefined ? t("no proposal") : t("proposal: {0}", turn.proposal.purpose),
    ].join("\n");
    if (turn.selectedNodeIds[0] !== undefined) {
      this.command = {
        command: "agorixStudio.revealCanonicalNode",
        title: t("Reveal Companion Context"),
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
      return t("Explain");
    case "challenge":
      return t("Challenge");
    case "debug":
      return t("Debug");
    case "reflect":
      return t("Reflect");
    case "build":
      return t("Proposal");
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
