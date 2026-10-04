import {
  ProjectStore,
  type StoredProject,
  type ProjectMetadata,
  type BrowserStorageAdapter,
  type PersistenceErrorCode,
} from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import { createEditorModelFromProgram, type EditorModel } from "./editorModel.js";

export const WEB_PROJECT_ID = "default-project";

const VERSION_MISMATCH_MESSAGE =
  "This project was made with a different version of Agorix and can't be opened here. Start a new project to keep going.";

const CORRUPTION_MESSAGE = "We couldn't open the saved project. Start a new project to keep going.";

const SAVE_FAILURE_MESSAGE =
  "We couldn't save this project on this device. You can keep working, but reload may lose changes.";

export class WebLocalStorageAdapter implements BrowserStorageAdapter {
  constructor(
    private readonly storage: Storage,
    private readonly prefix = "agorix:",
  ) {}

  get(key: string): string | null {
    return this.storage.getItem(this.prefix + key);
  }

  set(key: string, value: string): void {
    this.storage.setItem(this.prefix + key, value);
  }

  remove(key: string): void {
    this.storage.removeItem(this.prefix + key);
  }

  has(key: string): boolean {
    return this.storage.getItem(this.prefix + key) !== null;
  }
}

export interface ProjectPersistence {
  readonly store: ProjectStore;
  readonly projectId: string;
}

export interface LoadedEditorProject {
  readonly model: EditorModel | undefined;
  readonly metadata: ProjectMetadata | undefined;
  readonly message: string | undefined;
}

export function createBrowserProjectPersistence(
  storage: Storage | undefined = typeof window === "undefined" ? undefined : window.localStorage,
): ProjectPersistence | undefined {
  if (storage === undefined) {
    return undefined;
  }
  return {
    projectId: WEB_PROJECT_ID,
    store: new ProjectStore({ storage: new WebLocalStorageAdapter(storage) }),
  };
}

export function loadEditorProject(
  persistence: ProjectPersistence | undefined,
): LoadedEditorProject {
  if (persistence === undefined || !persistence.store.has(persistence.projectId)) {
    return { model: undefined, metadata: undefined, message: undefined };
  }

  try {
    const stored = persistence.store.load(persistence.projectId);
    return {
      model: createEditorModelFromProgram(stored.program),
      metadata: stored.metadata,
      message: undefined,
    };
  } catch (error) {
    return {
      model: undefined,
      metadata: undefined,
      message: messageForLoadFailure(error),
    };
  }
}

export function saveEditorProject(
  persistence: ProjectPersistence | undefined,
  program: ProjectProgram,
  metadata: ProjectMetadata,
): string | undefined {
  if (persistence === undefined) {
    return undefined;
  }

  try {
    persistence.store.save(persistence.projectId, program, metadata);
    return undefined;
  } catch {
    return SAVE_FAILURE_MESSAGE;
  }
}

function messageForLoadFailure(error: unknown): string {
  const code = persistenceErrorCode(error);
  if (code === "UNKNOWN_VERSION" || code === "SCHEMA_MISMATCH") {
    return VERSION_MISMATCH_MESSAGE;
  }
  return CORRUPTION_MESSAGE;
}

function persistenceErrorCode(error: unknown): PersistenceErrorCode | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = error.code;
  return typeof code === "string" ? (code as PersistenceErrorCode) : undefined;
}

/**
 * The anonymous local project as a stored project, or undefined when none is worth offering:
 * missing, unreadable, or an untouched starter (no blocks), which has nothing to import.
 */
export function readLocalStoredProject(
  persistence: ProjectPersistence | undefined,
): StoredProject | undefined {
  if (persistence === undefined || !persistence.store.has(persistence.projectId)) {
    return undefined;
  }
  try {
    const stored = persistence.store.load(persistence.projectId);
    const blocks = stored.program.scripts.reduce((n, script) => n + script.statements.length, 0);
    return blocks > 0 ? stored : undefined;
  } catch {
    return undefined;
  }
}

/** Explicit learner action only: removes the anonymous local project from this device. */
export function removeLocalStoredProject(persistence: ProjectPersistence | undefined): void {
  try {
    persistence?.store.remove(persistence.projectId);
  } catch {
    // Removal failing leaves the copy in place, which is the safe outcome.
  }
}
