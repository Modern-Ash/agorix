import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";

export const PACKAGE_NAME = "@agorix/persistence";

/** Stable error codes for persistence failures (issue #28). */
export type PersistenceErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "CORRUPTED_DATA"
  | "SCHEMA_MISMATCH"
  | "UNKNOWN_VERSION"
  | "MIGRATION_FAILED"
  | "SERIALIZATION_ERROR";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly projectId: string;

  constructor(code: PersistenceErrorCode, projectId: string, message: string) {
    super(`${code} [${projectId}]: ${message}`);
    this.name = "PersistenceError";
    this.code = code;
    this.projectId = projectId;
  }
}

export interface StoredProject {
  readonly schemaVersion: string;
  readonly program: ProjectProgram;
  readonly metadata: ProjectMetadata;
}

export interface ProjectMetadata {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly missionProgress: number;
  readonly hintLevel: number;
}

export interface BrowserStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  has(key: string): boolean;
}

export type MigrationFn = (program: ProjectProgram) => ProjectProgram;

export interface MigrationStep {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly migrate: MigrationFn;
}

export class BrowserLocalStorageAdapter implements BrowserStorageAdapter {
  private readonly prefix: string;

  constructor(prefix = "agorix:") {
    this.prefix = prefix;
  }

  get(key: string): string | null {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch {
      throw new PersistenceError("STORAGE_UNAVAILABLE", key, "localStorage is unavailable");
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      // silently ignore
    }
  }

  has(key: string): boolean {
    try {
      return localStorage.getItem(this.prefix + key) !== null;
    } catch {
      return false;
    }
  }
}

export class ProjectStore {
  private readonly storage: BrowserStorageAdapter;
  private readonly currentSchemaVersion: string;
  private readonly migrations: Map<string, MigrationStep>;

  constructor(
    options: {
      storage?: BrowserStorageAdapter;
      currentSchemaVersion?: string;
      migrations?: MigrationStep[];
    } = {},
  ) {
    this.storage = options.storage ?? new BrowserLocalStorageAdapter();
    this.currentSchemaVersion = options.currentSchemaVersion ?? SCHEMA_VERSION;
    this.migrations = new Map();
    for (const step of options.migrations ?? []) {
      this.migrations.set(`${step.fromVersion}→${step.toVersion}`, step);
    }
  }

  save(projectId: string, program: ProjectProgram, metadata: ProjectMetadata): void {
    const stored: StoredProject = {
      schemaVersion: this.currentSchemaVersion,
      program,
      metadata,
    };
    try {
      const json = JSON.stringify(stored);
      this.storage.set(projectId, json);
    } catch {
      throw new PersistenceError("SERIALIZATION_ERROR", projectId, "failed to serialize project");
    }
  }

  load(projectId: string): StoredProject {
    const raw = this.storage.get(projectId);
    if (raw === null) {
      throw new PersistenceError("STORAGE_UNAVAILABLE", projectId, "project not found in storage");
    }

    let parsed: StoredProject;
    try {
      parsed = JSON.parse(raw) as StoredProject;
    } catch {
      throw new PersistenceError("CORRUPTED_DATA", projectId, "cannot parse stored project data");
    }

    if (parsed.schemaVersion !== this.currentSchemaVersion) {
      const migrated = this.migrate(projectId, parsed);
      return migrated;
    }

    return parsed;
  }

  remove(projectId: string): void {
    this.storage.remove(projectId);
  }

  has(projectId: string): boolean {
    return this.storage.has(projectId);
  }

  private migrate(projectId: string, stored: StoredProject): StoredProject {
    const key = `${stored.schemaVersion}→${this.currentSchemaVersion}`;
    const step = this.migrations.get(key);
    if (!step) {
      throw new PersistenceError(
        "UNKNOWN_VERSION",
        projectId,
        `no migration path from ${stored.schemaVersion} to ${this.currentSchemaVersion}`,
      );
    }
    try {
      const migratedProgram = step.migrate(stored.program);
      return { ...stored, program: migratedProgram, schemaVersion: this.currentSchemaVersion };
    } catch (err) {
      throw new PersistenceError("MIGRATION_FAILED", projectId, `migration failed: ${err}`);
    }
  }
}
