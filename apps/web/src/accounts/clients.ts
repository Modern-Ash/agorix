import type { StoredProject } from "@agorix/persistence";

/**
 * Web-side seams for optional accounts and private projects (issue #190).
 *
 * The UI only depends on these interfaces. A real deployment must provide a
 * server that exposes the `agorix/project-api/v1` routes plus account routes;
 * until it exists the app discovers that accounts are unavailable and stays
 * fully anonymous/local.
 */
export type ClientErrorKind =
  | "unauthenticated"
  | "session-expired"
  | "not-found"
  | "validation"
  | "revision-conflict"
  | "transient"
  | "invalid-credentials"
  | "username-taken"
  | "rate-limited"
  | "unavailable";

export interface ConflictRecovery {
  readonly currentRevision: number;
  readonly currentUpdatedAt: string;
  readonly currentSemanticHash: string;
}

export class ClientError extends Error {
  readonly kind: ClientErrorKind;
  readonly reason?: string;
  readonly recovery?: ConflictRecovery;

  constructor(kind: ClientErrorKind, reason?: string, recovery?: ConflictRecovery) {
    // Fixed message: never echo server or user content (no sensitive logging).
    super(`client error: ${kind}`);
    this.name = "ClientError";
    this.kind = kind;
    if (reason !== undefined) this.reason = reason;
    if (recovery !== undefined) this.recovery = recovery;
  }
}

export function isClientError(error: unknown, kind?: ClientErrorKind): error is ClientError {
  return error instanceof ClientError && (kind === undefined || error.kind === kind);
}

export interface AccountSummary {
  readonly alias: string;
  readonly expiresAt: string;
}

export interface ProjectSummaryDto {
  readonly projectId: string;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly semanticHash: string;
}

export interface ProjectDto extends ProjectSummaryDto {
  readonly storedProject: StoredProject;
}

export interface AccountClient {
  /** Resolves the current session. Throws unauthenticated | session-expired | unavailable | transient. */
  restore(): Promise<AccountSummary>;
  register(alias: string, password: string): Promise<void>;
  signIn(alias: string, password: string): Promise<AccountSummary>;
  signOut(): Promise<void>;
}

export interface ProjectApiClient {
  list(): Promise<readonly ProjectSummaryDto[]>;
  create(title: string, storedProject: StoredProject): Promise<ProjectDto>;
  get(projectId: string): Promise<ProjectDto>;
  update(
    projectId: string,
    expectedRevision: number,
    storedProject: StoredProject,
  ): Promise<ProjectDto>;
  rename(projectId: string, expectedRevision: number, title: string): Promise<ProjectDto>;
  duplicate(projectId: string, title?: string): Promise<ProjectDto>;
  delete(projectId: string, expectedRevision: number): Promise<void>;
}

export interface AccountBackend {
  readonly account: AccountClient;
  readonly projects: ProjectApiClient;
}
