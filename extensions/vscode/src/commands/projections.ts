import * as vscode from "vscode";
import {
  isStudioProjectionId,
  listStudioProjections,
  openProjectionDocument,
  projectionRangeForNode,
  type StudioProjectionDocument,
  type StudioProjectionId,
} from "../studioCore.js";
import { PROJECTION_SCHEME, type OpenProject } from "../store/session.js";
import { StudioTreeItem } from "../views/providers.js";

export interface StudioProjectionCommandPort {
  requireProject(): OpenProject | undefined;
  getCurrentProject(): OpenProject | undefined;
  getCurrentProjectionId(): StudioProjectionId;
  setCurrentProjectionId(id: StudioProjectionId): void;
}

export interface StudioProjectionCommandHandlers {
  projectionUri(id: StudioProjectionId): vscode.Uri;
  projectionIdFromUri(uri: vscode.Uri): StudioProjectionId;
  openProjection(target?: unknown): Promise<void>;
  switchProjection(): Promise<void>;
  revealCanonicalNode(nodeId?: unknown): Promise<void>;
}

export function createStudioProjectionCommandHandlers(
  port: StudioProjectionCommandPort,
): StudioProjectionCommandHandlers {
  const currentProjection = (): StudioProjectionDocument | undefined => {
    const open = port.requireProject();
    return open === undefined
      ? undefined
      : openProjectionDocument(open.project, port.getCurrentProjectionId());
  };

  const projectionUri = (id: StudioProjectionId): vscode.Uri => {
    const projectName =
      port
        .getCurrentProject()
        ?.uri.fsPath.split(/[\\/]/)
        .pop()
        ?.replace(/[^A-Za-z0-9_.-]/g, "-") ?? "project";
    return vscode.Uri.parse(`${PROJECTION_SCHEME}:/${projectName}.${id}`);
  };

  const projectionIdFromUri = (uri: vscode.Uri): StudioProjectionId => {
    const match = uri.path.match(/\.([A-Za-z0-9-]+)$/);
    const id = match?.[1] ?? port.getCurrentProjectionId();
    return isStudioProjectionId(id) ? id : port.getCurrentProjectionId();
  };

  const openProjection = async (target?: unknown): Promise<void> => {
    const open = port.requireProject();
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
            : port.getCurrentProjectionId();
    port.setCurrentProjectionId(id);
    const projection = openProjectionDocument(open.project, id);
    const document = await vscode.workspace.openTextDocument(projectionUri(id));
    await vscode.window.showTextDocument(document, { preview: false });
    await vscode.languages.setTextDocumentLanguage(document, projection.languageId);
    void vscode.window.showInformationMessage(projection.readOnlyReason);
  };

  const switchProjection = async (): Promise<void> => {
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
  };

  const revealCanonicalNode = async (nodeId?: unknown): Promise<void> => {
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
  };

  return {
    projectionUri,
    projectionIdFromUri,
    openProjection,
    switchProjection,
    revealCanonicalNode,
  };
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
