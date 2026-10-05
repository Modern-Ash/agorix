import * as vscode from "vscode";
import {
  nodeIdsForProjectionLines,
  projectionRangeForNode,
  type StudioCompanionAction,
  type StudioExecutionViewState,
  type StudioProjectionDocument,
} from "../studioCore.js";
import { PROJECTION_SCHEME } from "../store/session.js";

export interface AmbientLensesOptions {
  readonly getProjection: (document: vscode.TextDocument) => StudioProjectionDocument | undefined;
  readonly getExecutionView: () => StudioExecutionViewState | undefined;
  /** Hides the actions the learner's assistance ceiling does not allow (ADR 0008). */
  readonly allowAction?: (action: StudioCompanionAction) => boolean;
}

interface AmbientLensAction {
  readonly action: StudioCompanionAction;
  readonly title: string;
  readonly command: string;
}

const ACTIONS: readonly AmbientLensAction[] = [
  { action: "explain", title: "$(comment) Explain", command: "agorixStudio.companionExplain" },
  { action: "debug", title: "$(debug-alt) Debug", command: "agorixStudio.companionDebug" },
  {
    action: "challenge",
    title: "$(beaker) Challenge",
    command: "agorixStudio.companionChallenge",
  },
  { action: "build", title: "$(lightbulb) Propose", command: "agorixStudio.companionBuild" },
  { action: "reflect", title: "$(eye) Reflect", command: "agorixStudio.companionReflect" },
];

function allowedActions(options: AmbientLensesOptions): readonly AmbientLensAction[] {
  const allow = options.allowAction;
  return allow === undefined ? ACTIONS : ACTIONS.filter((entry) => allow(entry.action));
}

export class AmbientCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly options: AmbientLensesOptions) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.uri.scheme !== PROJECTION_SCHEME) return [];
    const projection = this.options.getProjection(document);
    if (projection === undefined) return [];
    const editor = vscode.window.visibleTextEditors.find(
      (candidate) => candidate.document.uri.toString() === document.uri.toString(),
    );
    const selectedIds =
      editor === undefined
        ? []
        : editor.selections.flatMap((selection) =>
            nodeIdsForProjectionLines(projection, selection.start.line, selection.end.line),
          );
    const failed = this.options
      .getExecutionView()
      ?.inspectorSteps.find(
        (step) => step.outcome === "budget-exceeded" && step.nodeId !== undefined,
      )?.nodeId;
    const ids = unique([
      ...(selectedIds.length > 0 ? selectedIds : []),
      ...(failed ? [failed] : []),
    ]);
    return ids.flatMap((nodeId) => {
      const range = textRangeToVsCodeRange(
        projection.text,
        projectionRangeForNode(projection, nodeId),
      );
      return allowedActions(this.options).map(
        (action) =>
          new vscode.CodeLens(range, {
            title: action.title,
            command: action.command,
            arguments: [nodeId],
          }),
      );
    });
  }
}

export class AmbientCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private readonly options: AmbientLensesOptions) {}

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    if (document.uri.scheme !== PROJECTION_SCHEME) return [];
    const projection = this.options.getProjection(document);
    if (projection === undefined) return [];
    const selectedIds = nodeIdsForProjectionLines(projection, range.start.line, range.end.line);
    const failed = this.options
      .getExecutionView()
      ?.inspectorSteps.find(
        (step) => step.outcome === "budget-exceeded" && step.nodeId !== undefined,
      )?.nodeId;
    const ids = unique([
      ...(selectedIds.length > 0 ? selectedIds : []),
      ...(failed ? [failed] : []),
    ]);
    return ids.flatMap((nodeId) =>
      allowedActions(this.options).map((entry) => {
        const action = new vscode.CodeAction(entry.title, vscode.CodeActionKind.QuickFix);
        action.command = { title: entry.title, command: entry.command, arguments: [nodeId] };
        return action;
      }),
    );
  }
}

export function registerAmbientLenses(options: AmbientLensesOptions): vscode.Disposable[] {
  const selector: vscode.DocumentSelector = { scheme: PROJECTION_SCHEME };
  return [
    vscode.languages.registerCodeLensProvider(selector, new AmbientCodeLensProvider(options)),
    vscode.languages.registerCodeActionsProvider(selector, new AmbientCodeActionProvider(options)),
  ];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
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
