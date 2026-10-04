import * as vscode from "vscode";
import {
  createStudioStarterProject,
  defaultStudioProjectFilename,
  parseProjectFile,
  serializeProjectFile,
  STUDIO_STARTER_OPTIONS,
  type StudioStarterId,
} from "../studioCore.js";
import type { OpenProject } from "../store/session.js";

interface IdQuickPickItem<Id extends string> extends vscode.QuickPickItem {
  readonly id: Id;
}

interface CreateProjectCommandOptions {
  readonly name: string;
  readonly starter: StudioStarterId;
  readonly locale: "en" | "es";
  readonly uri: vscode.Uri;
}

export interface StudioProjectCommandPort {
  getCurrentProjectionId(): string;
  setCurrentProject(project: OpenProject): void;
  resetProjectSessionState(): void;
  refreshStudioViews(): void;
  refreshExecutionViews(): void;
  refreshCompanionViews(): void;
  updateStudioContext(): void;
  requireProject(): OpenProject | undefined;
  openProjection(id: string): Promise<void>;
}

export interface StudioProjectCommandHandlers {
  openProject(target?: unknown): Promise<void>;
  createProject(target?: unknown): Promise<vscode.Uri | undefined>;
  exportAgorixProject(): Promise<vscode.Uri | undefined>;
}

export function createStudioProjectCommandHandlers(
  port: StudioProjectCommandPort,
): StudioProjectCommandHandlers {
  const openProject = async (target?: unknown): Promise<void> => {
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
      port.setCurrentProject({ uri, project: parseProjectFile(raw, uri.fsPath) });
      port.resetProjectSessionState();
    } catch (error) {
      // Do not await: a toast resolves only when dismissed and would hang the command.
      void vscode.window.showErrorMessage(
        `Agorix Studio could not open this project: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      return;
    }
    port.refreshStudioViews();
    port.refreshCompanionViews();
    port.updateStudioContext();
    await port.openProjection(port.getCurrentProjectionId());
  };

  const createProject = async (target?: unknown): Promise<vscode.Uri | undefined> => {
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
    port.setCurrentProject({
      uri: picked.uri,
      project: parseProjectFile(raw, picked.uri.fsPath),
    });
    port.resetProjectSessionState();
    port.refreshStudioViews();
    port.refreshExecutionViews();
    port.refreshCompanionViews();
    port.updateStudioContext();
    await port.openProjection(port.getCurrentProjectionId());
    void vscode.window.showInformationMessage(`Created Agorix project: ${picked.uri.fsPath}`);
    return picked.uri;
  };

  const exportAgorixProject = async (): Promise<vscode.Uri | undefined> => {
    const open = port.requireProject();
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
  };

  return { openProject, createProject, exportAgorixProject };
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
  const defaultUri =
    workspace === undefined
      ? vscode.Uri.file(filename)
      : vscode.Uri.file(`${workspace.uri.fsPath.replace(/[\\/]$/, "")}/${filename}`);
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
