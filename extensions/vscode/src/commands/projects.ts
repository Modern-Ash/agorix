import * as vscode from "vscode";
import { t } from "../l10n.js";
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
  afterProjectOpened?(): void | Promise<void>;
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
    const uri = isUriLike(target)
      ? target
      : ((await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { [t("Agorix project")]: ["agorix", "json"] },
          openLabel: t("Open Agorix project"),
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
        t(
          "Agorix Studio could not open this project: {0}",
          error instanceof Error ? error.message : t("unknown error"),
        ),
      );
      return;
    }
    port.refreshStudioViews();
    port.refreshCompanionViews();
    port.updateStudioContext();
    await port.openProjection(port.getCurrentProjectionId());
    await port.afterProjectOpened?.();
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
    await port.afterProjectOpened?.();
    void vscode.window.showInformationMessage(t("Created Agorix project: {0}", picked.uri.fsPath));
    return picked.uri;
  };

  const exportAgorixProject = async (): Promise<vscode.Uri | undefined> => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const uri = await vscode.window.showSaveDialog({
      filters: { [t("Agorix portable project")]: ["agorix"] },
      saveLabel: t("Export Agorix project"),
      defaultUri: vscode.Uri.file("agorix-project.agorix"),
    });
    if (uri === undefined) {
      return undefined;
    }
    const raw = serializeProjectFile(open.project.stored, ".agorix");
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(raw));
    void vscode.window.showInformationMessage(t("Exported portable .agorix project."));
    return uri;
  };

  return { openProject, createProject, exportAgorixProject };
}

async function promptForCreateProjectOptions(): Promise<CreateProjectCommandOptions | undefined> {
  const name = await vscode.window.showInputBox({
    title: t("Agorix project name"),
    prompt: t("Choose a name for the local .agorix project."),
    value: "Agorix first mission",
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim().length === 0 ? t("Enter a project name before creating a file.") : undefined,
  });
  if (name === undefined) {
    return undefined;
  }

  const starterItems: IdQuickPickItem<StudioStarterId>[] = STUDIO_STARTER_OPTIONS.map((option) => ({
    label: t(option.label),
    description: t(option.description),
    id: option.id,
  }));
  const starter = await vscode.window.showQuickPick(starterItems, { title: t("Agorix starter") });
  if (starter === undefined) {
    return undefined;
  }

  const vscodeLocale = vscode.env.language.toLowerCase();
  const localeItems: IdQuickPickItem<"en" | "es">[] = [
    {
      label: "English",
      id: "en",
      ...(vscodeLocale.startsWith("en") ? { description: t("VS Code locale") } : {}),
    },
    {
      label: "Español",
      id: "es",
      ...(vscodeLocale.startsWith("es") ? { description: t("VS Code locale") } : {}),
    },
  ];
  const locale = await vscode.window.showQuickPick(localeItems, { title: t("Agorix language") });
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
    filters: { [t("Agorix portable project")]: ["agorix"] },
    saveLabel: t("Create Agorix project"),
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

function isUriLike(value: unknown): value is vscode.Uri {
  return (
    value instanceof vscode.Uri ||
    (typeof value === "object" &&
      value !== null &&
      "fsPath" in value &&
      typeof value.fsPath === "string" &&
      "scheme" in value &&
      typeof value.scheme === "string")
  );
}
