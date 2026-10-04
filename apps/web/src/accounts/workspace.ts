import { semanticProjectHash, type StoredProject } from "@agorix/persistence";
import {
  ClientError,
  isClientError,
  type AccountBackend,
  type AccountSummary,
  type ConflictRecovery,
  type ProjectDto,
  type ProjectSummaryDto,
} from "./clients.js";

export type AuthStatus =
  "checking" | "unavailable" | "anonymous" | "authenticated" | "session-expired";

export type SaveState = "local" | "saved" | "saving" | "offline" | "conflict" | "session-expired";

export interface ProjectsState {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly items: readonly ProjectSummaryDto[];
  readonly error?: "transient" | "session" | "other";
}

export interface ActiveProject {
  readonly projectId: string;
  readonly title: string;
  readonly revision: number;
}

export type ImportOffer =
  | { readonly phase: "none" }
  | { readonly phase: "offered" }
  | { readonly phase: "importing" }
  | { readonly phase: "failed" }
  | { readonly phase: "imported"; readonly projectId: string };

export interface WorkspaceState {
  readonly authStatus: AuthStatus;
  readonly account?: AccountSummary | undefined;
  readonly projects: ProjectsState;
  readonly active?: ActiveProject | undefined;
  readonly saveState: SaveState;
  readonly conflict?: ConflictRecovery | undefined;
  readonly conflictDialogOpen: boolean;
  readonly importOffer: ImportOffer;
  /** False when the unsynced draft could not be written to this device (storage blocked/full). */
  readonly deviceDraftOk: boolean;
}

export type ConflictChoice = "reload" | "copy" | "cancel";

export interface DraftRecord {
  readonly alias: string;
  readonly projectId: string;
  readonly baseRevision: number;
  readonly title: string;
  readonly storedProject: StoredProject;
}

/** Storage keys. The anonymous project lives under `agorix:default-project` and is never touched here. */
export const DRAFT_KEY = "agorix:account-draft";
export const IMPORT_DECISIONS_KEY = "agorix:account-import-decisions";

export interface WorkspaceOptions {
  readonly backend: AccountBackend;
  readonly storage?: Storage | undefined;
  /** Reads the anonymous local project, if one is saved on this device. */
  readonly readLocalProject: () => StoredProject | undefined;
  /** Called after sign-out or an account switch so the editor can drop account content. */
  readonly onAccountContentCleared?: () => void;
  readonly retryDelayMs?: number;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

const INITIAL: WorkspaceState = {
  authStatus: "checking",
  projects: { status: "idle", items: [] },
  saveState: "local",
  conflictDialogOpen: false,
  importOffer: { phase: "none" },
  deviceDraftOk: true,
};

export class WorkspaceController {
  private state: WorkspaceState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private pending: StoredProject | undefined;
  private flushing = false;
  private retryHandle: unknown;
  private generation = 0;
  private listLoad = 0;

  constructor(private readonly options: WorkspaceOptions) {}

  getState = (): WorkspaceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<WorkspaceState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  // ---- session ---------------------------------------------------------

  async init(): Promise<void> {
    try {
      const account = await this.options.backend.account.restore();
      await this.becomeAuthenticated(account);
    } catch (error) {
      if (isClientError(error, "unauthenticated")) {
        this.set({ authStatus: "anonymous" });
      } else if (isClientError(error, "session-expired")) {
        this.set({ authStatus: "session-expired" });
      } else if (isClientError(error, "transient")) {
        // Cannot tell: stay usable anonymously and let the learner retry sign-in.
        this.set({ authStatus: "anonymous" });
      } else {
        this.set({ authStatus: "unavailable" });
      }
    }
  }

  async register(alias: string, password: string): Promise<void> {
    await this.options.backend.account.register(alias, password);
    await this.signIn(alias, password);
  }

  async signIn(alias: string, password: string): Promise<void> {
    const account = await this.options.backend.account.signIn(alias, password);
    await this.becomeAuthenticated(account);
  }

  async signOut(): Promise<void> {
    try {
      await this.options.backend.account.signOut();
    } catch {
      // Local state is cleared regardless; an unreachable server cannot keep the learner signed in here.
    }
    this.clearAccountContent();
    this.set({ authStatus: "anonymous" });
  }

  /** The server rejected the session mid-use: keep the draft, ask for sign-in. */
  private expireSession(): void {
    this.cancelRetry();
    this.set({
      authStatus: "session-expired",
      saveState: this.state.active === undefined ? "local" : "session-expired",
    });
  }

  private async becomeAuthenticated(account: AccountSummary): Promise<void> {
    const previous = this.state.account?.alias ?? this.readDraft()?.alias;
    const sameAccount =
      previous !== undefined && previous.toLowerCase() === account.alias.toLowerCase();
    if (!sameAccount && (this.state.account !== undefined || previous !== undefined)) {
      // Account B must never see A's cached content.
      this.clearAccountContent();
    }
    this.set({
      authStatus: "authenticated",
      account,
      saveState:
        this.state.active === undefined ? "local" : this.pending === undefined ? "saved" : "saving",
    });
    this.evaluateImportOffer(account.alias);
    await this.loadProjects();
    if (this.pending !== undefined) void this.flush();
  }

  /** Drops every piece of account-specific in-memory and device state. Anonymous local data stays. */
  clearAccountContent(): void {
    this.generation += 1;
    this.cancelRetry();
    this.pending = undefined;
    this.removeDraft();
    this.set({
      account: undefined,
      projects: { status: "idle", items: [] },
      active: undefined,
      saveState: "local",
      conflict: undefined,
      conflictDialogOpen: false,
      importOffer: { phase: "none" },
    });
    this.options.onAccountContentCleared?.();
  }

  // ---- projects --------------------------------------------------------

  async loadProjects(): Promise<void> {
    const load = ++this.listLoad;
    const generation = this.generation;
    this.set({ projects: { status: "loading", items: this.state.projects.items } });
    try {
      const items = await this.options.backend.projects.list();
      if (load !== this.listLoad || generation !== this.generation) return;
      this.set({ projects: { status: "ready", items } });
    } catch (error) {
      if (load !== this.listLoad || generation !== this.generation) return;
      if (isClientError(error, "session-expired") || isClientError(error, "unauthenticated")) {
        this.expireSession();
        this.set({ projects: { status: "error", items: [], error: "session" } });
        return;
      }
      this.set({
        projects: {
          status: "error",
          items: [],
          error: isClientError(error, "transient") ? "transient" : "other",
        },
      });
    }
  }

  async createProject(title: string, stored: StoredProject): Promise<ProjectDto> {
    const dto = await this.guard(() => this.options.backend.projects.create(title, stored));
    await this.afterListChange();
    this.activate(dto);
    return dto;
  }

  /** Opens a project. A device draft for the same project and account wins until it syncs. */
  async openProject(projectId: string): Promise<{ dto: ProjectDto; restoredDraft: boolean }> {
    const dto = await this.guard(() => this.options.backend.projects.get(projectId));
    const draft = this.readDraft();
    const alias = this.state.account?.alias;
    const useDraft =
      draft !== undefined &&
      alias !== undefined &&
      draft.projectId === projectId &&
      draft.alias.toLowerCase() === alias.toLowerCase() &&
      semanticProjectHash(draft.storedProject) !== dto.semanticHash;
    this.cancelRetry();
    this.pending = undefined;
    if (useDraft) {
      this.set({
        active: { projectId, title: dto.title, revision: draft.baseRevision },
        saveState: "saving",
        conflict: undefined,
        conflictDialogOpen: false,
      });
      this.queueSave(draft.storedProject);
      return { dto: { ...dto, storedProject: draft.storedProject }, restoredDraft: true };
    }
    this.removeDraft();
    this.activate(dto);
    return { dto, restoredDraft: false };
  }

  closeProject(): void {
    this.cancelRetry();
    this.pending = undefined;
    this.removeDraft();
    this.set({
      active: undefined,
      saveState: "local",
      conflict: undefined,
      conflictDialogOpen: false,
    });
    this.options.onAccountContentCleared?.();
  }

  async renameProject(projectId: string, title: string): Promise<void> {
    const revision = this.revisionOf(projectId);
    const dto = await this.guard(() =>
      this.options.backend.projects.rename(projectId, revision, title),
    );
    if (this.state.active?.projectId === projectId) {
      this.set({ active: { projectId, title: dto.title, revision: dto.revision } });
    }
    await this.afterListChange();
  }

  async duplicateProject(projectId: string, title?: string): Promise<ProjectDto> {
    const dto = await this.guard(() => this.options.backend.projects.duplicate(projectId, title));
    await this.afterListChange();
    return dto;
  }

  async deleteProject(projectId: string): Promise<void> {
    const revision = this.revisionOf(projectId);
    await this.guard(() => this.options.backend.projects.delete(projectId, revision));
    if (this.state.active?.projectId === projectId) this.closeProject();
    await this.afterListChange();
  }

  private revisionOf(projectId: string): number {
    if (this.state.active?.projectId === projectId) return this.state.active.revision;
    const item = this.state.projects.items.find((p) => p.projectId === projectId);
    if (item === undefined) throw new ClientError("not-found");
    return item.revision;
  }

  private activate(dto: ProjectDto): void {
    this.cancelRetry();
    this.pending = undefined;
    this.removeDraft();
    this.set({
      active: { projectId: dto.projectId, title: dto.title, revision: dto.revision },
      saveState: "saved",
      conflict: undefined,
      conflictDialogOpen: false,
    });
  }

  private async afterListChange(): Promise<void> {
    await this.loadProjects();
  }

  /** Runs an API call; session loss flips the whole workspace to session-expired. */
  private async guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isClientError(error, "session-expired") || isClientError(error, "unauthenticated")) {
        this.expireSession();
      }
      throw error;
    }
  }

  // ---- autosave --------------------------------------------------------

  /** Called (debounced by the UI) with the current canonical stored project. Never includes history. */
  queueSave(stored: StoredProject): void {
    if (this.state.active === undefined) return;
    this.pending = stored;
    this.writeDraft(stored);
    if (this.state.saveState === "conflict") return;
    if (this.state.authStatus !== "authenticated") {
      this.set({ saveState: "session-expired" });
      return;
    }
    void this.flush();
  }

  /** Retry after reconnect or an explicit learner request. */
  retrySave(): void {
    if (this.pending !== undefined && this.state.saveState !== "conflict") void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    const generation = this.generation;
    try {
      while (this.pending !== undefined) {
        const active = this.state.active;
        if (active === undefined || generation !== this.generation) return;
        const stored = this.pending;
        this.set({ saveState: "saving" });
        try {
          const dto = await this.options.backend.projects.update(
            active.projectId,
            active.revision,
            stored,
          );
          if (generation !== this.generation) return;
          if (this.pending === stored) {
            this.pending = undefined;
            this.removeDraft();
          }
          this.set({
            active: { projectId: dto.projectId, title: dto.title, revision: dto.revision },
            saveState: this.pending === undefined ? "saved" : "saving",
          });
          this.mirrorSummary(dto);
        } catch (error) {
          if (generation !== this.generation) return;
          this.handleSaveFailure(error);
          return;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private mirrorSummary(dto: ProjectDto): void {
    const items = this.state.projects.items.map((item) =>
      item.projectId === dto.projectId
        ? {
            projectId: dto.projectId,
            title: dto.title,
            revision: dto.revision,
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
            semanticHash: dto.semanticHash,
          }
        : item,
    );
    this.set({ projects: { ...this.state.projects, items } });
  }

  private handleSaveFailure(error: unknown): void {
    if (isClientError(error, "revision-conflict")) {
      this.set({
        saveState: "conflict",
        conflict: error.recovery,
        conflictDialogOpen: true,
      });
    } else if (isClientError(error, "session-expired") || isClientError(error, "unauthenticated")) {
      this.expireSession();
    } else if (isClientError(error, "transient")) {
      this.set({ saveState: "offline" });
      this.scheduleRetry();
    } else {
      // not-found / validation: the server will not accept this state; never claim it is saved.
      this.set({ saveState: "offline" });
    }
  }

  private scheduleRetry(): void {
    this.cancelRetry();
    const set = this.options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.retryHandle = set(() => {
      this.retryHandle = undefined;
      this.retrySave();
    }, this.options.retryDelayMs ?? 5000);
  }

  private cancelRetry(): void {
    if (this.retryHandle === undefined) return;
    (this.options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(
      this.retryHandle,
    );
    this.retryHandle = undefined;
  }

  // ---- conflict --------------------------------------------------------

  reopenConflictDialog(): void {
    if (this.state.saveState === "conflict") this.set({ conflictDialogOpen: true });
  }

  /**
   * Explicit recovery. Nothing is overwritten or merged without the learner choosing.
   * `reload` returns the server version for the editor to display (local edits are discarded by choice).
   * `copy` stores the local edits as a new project and leaves the server version untouched.
   */
  async resolveConflict(
    choice: ConflictChoice,
    copyTitle?: string,
  ): Promise<ProjectDto | undefined> {
    const active = this.state.active;
    if (choice === "cancel" || active === undefined) {
      this.set({ conflictDialogOpen: false });
      return undefined;
    }
    if (choice === "reload") {
      const dto = await this.guard(() => this.options.backend.projects.get(active.projectId));
      this.activate(dto);
      await this.afterListChange();
      return dto;
    }
    const stored = this.pending ?? this.readDraft()?.storedProject;
    if (stored === undefined) {
      this.set({ conflictDialogOpen: false });
      return undefined;
    }
    const dto = await this.guard(() =>
      this.options.backend.projects.create(copyTitle ?? active.title, stored),
    );
    this.activate(dto);
    await this.afterListChange();
    return dto;
  }

  // ---- local import ----------------------------------------------------

  private evaluateImportOffer(alias: string): void {
    if (this.state.importOffer.phase === "imported") return;
    const decided = this.readDecisions()[alias.toLowerCase()];
    const local = decided === undefined ? this.options.readLocalProject() : undefined;
    this.set({ importOffer: { phase: local === undefined ? "none" : "offered" } });
  }

  keepLocalOnly(): void {
    const alias = this.state.account?.alias;
    if (alias !== undefined) this.recordDecision(alias, "keep-local");
    this.set({ importOffer: { phase: "none" } });
  }

  dismissImportResult(): void {
    this.set({ importOffer: { phase: "none" } });
  }

  /** Explicit import. Creates a new owned project; the local copy is left untouched either way. */
  async importLocalProject(title: string): Promise<ProjectDto | undefined> {
    const local = this.options.readLocalProject();
    const alias = this.state.account?.alias;
    if (local === undefined || alias === undefined) {
      this.set({ importOffer: { phase: "none" } });
      return undefined;
    }
    this.set({ importOffer: { phase: "importing" } });
    try {
      const dto = await this.guard(() => this.options.backend.projects.create(title, local));
      if (dto.semanticHash !== semanticProjectHash(local)) {
        await this.options.backend.projects.delete(dto.projectId, dto.revision).catch(() => {});
        throw new ClientError("validation", "SEMANTIC_HASH_MISMATCH");
      }
      this.recordDecision(alias, "imported");
      this.set({ importOffer: { phase: "imported", projectId: dto.projectId } });
      await this.afterListChange();
      return dto;
    } catch {
      this.set({ importOffer: { phase: "failed" } });
      return undefined;
    }
  }

  // ---- device storage (account-scoped, cleared on sign-out) -------------

  private readDecisions(): Record<string, string> {
    try {
      const raw = this.options.storage?.getItem(IMPORT_DECISIONS_KEY);
      const parsed: unknown = raw === null || raw === undefined ? {} : JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, string>)
        : {};
    } catch {
      return {};
    }
  }

  private recordDecision(alias: string, decision: "keep-local" | "imported"): void {
    try {
      const decisions = { ...this.readDecisions(), [alias.toLowerCase()]: decision };
      this.options.storage?.setItem(IMPORT_DECISIONS_KEY, JSON.stringify(decisions));
    } catch {
      // A failed preference write only means the learner may be asked again.
    }
  }

  readDraft(): DraftRecord | undefined {
    try {
      const raw = this.options.storage?.getItem(DRAFT_KEY);
      if (raw === null || raw === undefined) return undefined;
      const parsed = JSON.parse(raw) as Partial<DraftRecord>;
      if (
        typeof parsed.alias === "string" &&
        typeof parsed.projectId === "string" &&
        typeof parsed.baseRevision === "number" &&
        typeof parsed.title === "string" &&
        typeof parsed.storedProject === "object" &&
        parsed.storedProject !== null
      ) {
        return parsed as DraftRecord;
      }
    } catch {
      // unreadable draft is treated as absent
    }
    return undefined;
  }

  private writeDraft(stored: StoredProject): void {
    const active = this.state.active;
    const alias = this.state.account?.alias ?? this.readDraft()?.alias;
    if (active === undefined || alias === undefined) return;
    try {
      const draft: DraftRecord = {
        alias,
        projectId: active.projectId,
        baseRevision: active.revision,
        title: active.title,
        storedProject: stored,
      };
      this.options.storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage full/blocked: the UI must then not claim the change is safe on this device.
      this.set({ deviceDraftOk: false });
      return;
    }
    if (!this.state.deviceDraftOk) this.set({ deviceDraftOk: true });
  }

  private removeDraft(): void {
    try {
      this.options.storage?.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }
}
