import * as vscode from "vscode";
import {
  parseProjectFile,
  serializeStoredProject,
  type StudioProject,
  type StudioProjectionId,
  type StudioRemoteProjectPayload,
  type StudioRemoteProjectReference,
  type StudioRemoteSaveResult,
} from "../studioCore.js";
import {
  SECRET_AGENT_CREDENTIAL_KEY,
  SECRET_TOKEN_KEY,
  REMOTE_SCHEME,
  type OpenProject,
  type StudioRemoteClient,
} from "../store/session.js";
import {
  createStudioProviderClient,
  normalizeStudioProviderSettings,
  type StudioAgentStatus,
  type StudioProviderClient,
} from "../studioProvider.js";

export interface StudioAccountCommandPort {
  readonly context: vscode.ExtensionContext;
  readonly agentStatusItem: vscode.StatusBarItem;
  requireProject(): OpenProject | undefined;
  getCurrentProject(): OpenProject | undefined;
  setCurrentProject(project: OpenProject | undefined): void;
  currentProjectionId(): StudioProjectionId;
  resetProjectSessionState(): void;
  refreshStudioViews(): void;
  refreshExecutionViews(): void;
  refreshCompanionViews(): void;
  updateStudioContext(): void;
  openProjection(id: StudioProjectionId): Promise<void>;
  exportAgorixProject(): Promise<vscode.Uri | undefined>;
}

export interface StudioAccountCommandHandlers {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  listRemoteProjects(): Promise<StudioRemoteProjectReference[]>;
  openRemoteProject(): Promise<void>;
  saveRemoteProject(): Promise<StudioRemoteSaveResult | undefined>;
  setAgentCredential(): Promise<void>;
  clearAgentCredential(): Promise<void>;
  checkAgentHealth(): Promise<void>;
}

export function createStudioAccountCommandHandlers(
  port: StudioAccountCommandPort,
): StudioAccountCommandHandlers {
  return {
    signIn: () => signIn(port.context),
    signOut: () => signOut(port),
    listRemoteProjects: () => listRemoteProjects(port.context),
    openRemoteProject: () => openRemoteProject(port),
    saveRemoteProject: () => saveRemoteProject(port),
    setAgentCredential: () => setAgentCredential(port.context),
    clearAgentCredential: () => clearAgentCredential(port.context),
    checkAgentHealth: () => checkAgentHealth(port.context, port.agentStatusItem),
  };
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

async function signOut(port: StudioAccountCommandPort): Promise<void> {
  await port.context.secrets.delete(SECRET_TOKEN_KEY);
  if (port.getCurrentProject()?.remote !== undefined) {
    port.setCurrentProject(undefined);
    port.resetProjectSessionState();
    port.refreshStudioViews();
    port.refreshExecutionViews();
    port.refreshCompanionViews();
    port.updateStudioContext();
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
  return client.listProjects();
}

async function openRemoteProject(port: StudioAccountCommandPort): Promise<void> {
  const client = await createRemoteClient(port.context);
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
  port.setCurrentProject({
    uri: vscode.Uri.parse(`${REMOTE_SCHEME}:/${encodeURIComponent(remote.id)}.agorix`),
    project: openRemotePayload(remote),
    remote: {
      id: remote.id,
      title: remote.title,
      revision: remote.revision,
    },
  });
  port.resetProjectSessionState();
  port.refreshStudioViews();
  port.refreshCompanionViews();
  port.updateStudioContext();
  await port.openProjection(port.currentProjectionId());
}

async function saveRemoteProject(
  port: StudioAccountCommandPort,
): Promise<StudioRemoteSaveResult | undefined> {
  const open = port.requireProject();
  if (open === undefined) {
    return undefined;
  }
  if (open.remote === undefined) {
    void vscode.window.showWarningMessage(
      "Open an authenticated Agorix project before saving to server.",
    );
    return undefined;
  }
  const client = await createRemoteClient(port.context);
  if (client === undefined) {
    return undefined;
  }
  const result = await client.saveProject({
    id: open.remote.id,
    expectedRevision: open.remote.revision,
    project: open.project.stored,
  });
  if (result.status === "saved") {
    port.setCurrentProject({
      ...open,
      project: openRemotePayload({
        id: open.remote.id,
        title: open.remote.title,
        revision: result.revision,
        project: result.project,
      }),
      remote: { ...open.remote, revision: result.revision },
    });
    port.refreshStudioViews();
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
    port.setCurrentProject({
      ...open,
      project: openRemotePayload({
        id: open.remote.id,
        title: open.remote.title,
        revision: result.actualRevision,
        project: result.latest,
      }),
      remote: { ...open.remote, revision: result.actualRevision },
    });
    port.resetProjectSessionState();
    port.refreshStudioViews();
    await port.openProjection(port.currentProjectionId());
  } else if (choice === "Export Copy") {
    await port.exportAgorixProject();
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
export async function refreshAgentStatus(
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

async function checkAgentHealth(
  context: vscode.ExtensionContext,
  item: vscode.StatusBarItem,
): Promise<void> {
  const status = await refreshAgentStatus(context, item);
  void vscode.window.showInformationMessage(status.message);
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
