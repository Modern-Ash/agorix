import * as vscode from "vscode";
import type {
  StudioCompanionTurn,
  StudioExecutionViewState,
  StudioProject,
  StudioProjectionId,
} from "../studioCore.js";
import { PROJECTION_SCHEME } from "../store/session.js";
import { refreshWorldPreview } from "../host/worldPreviewPanel.js";
import {
  CompanionHistoryProvider,
  ExecutionInspectorProvider,
  ProjectionDocumentProvider,
  StudioTreeProvider,
} from "./providers.js";

export interface StudioViewRegistrationOptions {
  readonly context: vscode.ExtensionContext;
  getProjectionProject(): StudioProject | undefined;
  getCurrentProject(): StudioProject | undefined;
  getCurrentProjectionId(): StudioProjectionId;
  projectionUri(id: StudioProjectionId): vscode.Uri;
  projectionIdFromUri(uri: vscode.Uri): StudioProjectionId;
  currentExecutionView(): StudioExecutionViewState | undefined;
  companionTurns(): readonly StudioCompanionTurn[];
}

export interface StudioViewRegistration {
  readonly disposables: vscode.Disposable[];
  refreshStudioViews(): void;
  refreshExecutionViews(): void;
  refreshCompanionViews(): void;
}

export function registerStudioViews(
  options: StudioViewRegistrationOptions,
): StudioViewRegistration {
  const projectionProvider = new ProjectionDocumentProvider(
    options.getProjectionProject,
    options.projectionIdFromUri,
  );
  const inspectorProvider = new ExecutionInspectorProvider(options.currentExecutionView);
  const companionProvider = new CompanionHistoryProvider(
    options.companionTurns,
    vscode.Uri.file(options.context.asAbsolutePath("media/agorix-agent-active.svg")),
  );
  const treeProviders = [
    new StudioTreeProvider("projects", options.getCurrentProject),
    new StudioTreeProvider("missions", options.getCurrentProject),
    new StudioTreeProvider("progress", options.getCurrentProject),
    new StudioTreeProvider("worlds", options.getCurrentProject),
    new StudioTreeProvider("companion", options.getCurrentProject),
    new StudioTreeProvider("developer", options.getCurrentProject),
  ];

  const refreshStudioViews = (): void => {
    for (const provider of treeProviders) {
      provider.refresh();
    }
    projectionProvider.refresh(options.projectionUri(options.getCurrentProjectionId()));
  };
  const refreshExecutionViews = (): void => {
    inspectorProvider.refresh();
    refreshWorldPreview(options.currentExecutionView());
  };
  const refreshCompanionViews = (): void => {
    companionProvider.refresh();
  };

  return {
    disposables: [
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
    ],
    refreshStudioViews,
    refreshExecutionViews,
    refreshCompanionViews,
  };
}
