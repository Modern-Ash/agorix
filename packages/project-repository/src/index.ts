import {
  AGORIX_PROJECT_MAX_BYTES,
  assertCrossSurfaceCompatibleProject,
  semanticProjectHash,
  type StoredProject,
} from "@agorix/persistence";
import { SCHEMA_VERSION } from "@agorix/program-model";

export const PACKAGE_NAME = "@agorix/project-repository";
export const PROJECT_REPOSITORY_CONTRACT_VERSION = "agorix/project-repository/v1";

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_MAX_TITLE_LENGTH = 120;
const DEFAULT_MAX_PAYLOAD_BYTES = AGORIX_PROJECT_MAX_BYTES;

export type ProjectRepositoryErrorCode =
  | "CONFLICT"
  | "INVALID_CURSOR"
  | "INVALID_OWNER"
  | "INVALID_PROJECT"
  | "INVALID_REVISION"
  | "INVALID_STORED_PROJECT"
  | "INVALID_TITLE"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "SQL_ERROR";

export class ProjectRepositoryError extends Error {
  readonly code: ProjectRepositoryErrorCode;
  readonly projectId?: string;

  constructor(
    code: ProjectRepositoryErrorCode,
    message: string,
    options: { projectId?: string } = {},
  ) {
    super(`${code}: ${message}`);
    this.name = "ProjectRepositoryError";
    this.code = code;
    if (options.projectId !== undefined) {
      this.projectId = options.projectId;
    }
  }
}

export interface ProjectRecord {
  readonly contractVersion: typeof PROJECT_REPOSITORY_CONTRACT_VERSION;
  readonly ownerId: string;
  readonly projectId: string;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly storedProject: StoredProject;
  readonly semanticHash: string;
}

export type ProjectSummary = Omit<ProjectRecord, "storedProject">;

export interface ProjectListPage {
  readonly items: readonly ProjectSummary[];
  readonly nextCursor?: string;
}

export interface ProjectRepository {
  create(ownerId: string, title: string, storedProject: StoredProject): Promise<ProjectRecord>;
  get(ownerId: string, projectId: string): Promise<ProjectRecord>;
  list(ownerId: string, cursor?: string): Promise<ProjectListPage>;
  update(
    ownerId: string,
    projectId: string,
    expectedRevision: number,
    update: ProjectUpdate,
  ): Promise<ProjectRecord>;
  duplicate(ownerId: string, projectId: string, title?: string): Promise<ProjectRecord>;
  delete(ownerId: string, projectId: string, expectedRevision?: number): Promise<void>;
}

export interface ProjectUpdate {
  readonly storedProject?: StoredProject;
  readonly title?: string;
}

export interface ProjectRepositoryOptions {
  readonly pageSize?: number;
  readonly now?: () => string;
  readonly idFactory?: () => string;
  readonly maxTitleLength?: number;
  readonly maxPayloadBytes?: number;
}

interface NormalizedOptions {
  readonly pageSize: number;
  readonly now: () => string;
  readonly idFactory: () => string;
  readonly maxTitleLength: number;
  readonly maxPayloadBytes: number;
}

interface PersistedRecord {
  readonly ownerId: string;
  readonly projectId: string;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly storedProject: StoredProject;
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly records = new Map<string, PersistedRecord>();
  private readonly options: NormalizedOptions;

  constructor(options: ProjectRepositoryOptions = {}) {
    this.options = normalizeOptions(options);
  }

  async create(
    ownerId: string,
    title: string,
    storedProject: StoredProject,
  ): Promise<ProjectRecord> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const normalizedTitle = validateTitle(title, this.options.maxTitleLength);
    const compatibleProject = validateStoredProject(storedProject, this.options.maxPayloadBytes);
    const projectId = this.nextUnusedProjectId(normalizedOwnerId);
    const now = this.options.now();
    const record: PersistedRecord = {
      ownerId: normalizedOwnerId,
      projectId,
      title: normalizedTitle,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      storedProject: cloneStoredProject(compatibleProject),
    };
    this.records.set(recordKey(normalizedOwnerId, projectId), record);
    return toProjectRecord(record);
  }

  async get(ownerId: string, projectId: string): Promise<ProjectRecord> {
    return toProjectRecord(this.readRecord(ownerId, projectId));
  }

  async list(ownerId: string, cursor?: string): Promise<ProjectListPage> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const offset = parseCursor(cursor);
    const ownerRecords = [...this.records.values()]
      .filter((record) => record.ownerId === normalizedOwnerId)
      .sort(compareRecords);
    const page = ownerRecords.slice(offset, offset + this.options.pageSize);
    const nextOffset = offset + page.length;
    return {
      items: page.map((record) => toProjectSummary(toProjectRecord(record))),
      ...(nextOffset < ownerRecords.length ? { nextCursor: formatCursor(nextOffset) } : {}),
    };
  }

  async update(
    ownerId: string,
    projectId: string,
    expectedRevision: number,
    update: ProjectUpdate,
  ): Promise<ProjectRecord> {
    const current = this.readRecord(ownerId, projectId);
    assertRevisionMatches(current, expectedRevision);
    if (update.title === undefined && update.storedProject === undefined) {
      throw new ProjectRepositoryError(
        "INVALID_PROJECT",
        "update requires a title or storedProject",
        {
          projectId,
        },
      );
    }
    const nextRecord: PersistedRecord = {
      ...current,
      title:
        update.title === undefined
          ? current.title
          : validateTitle(update.title, this.options.maxTitleLength),
      storedProject:
        update.storedProject === undefined
          ? current.storedProject
          : cloneStoredProject(
              validateStoredProject(update.storedProject, this.options.maxPayloadBytes),
            ),
      revision: current.revision + 1,
      updatedAt: this.options.now(),
    };
    this.records.set(recordKey(current.ownerId, current.projectId), nextRecord);
    return toProjectRecord(nextRecord);
  }

  async duplicate(ownerId: string, projectId: string, title?: string): Promise<ProjectRecord> {
    const current = this.readRecord(ownerId, projectId);
    return this.create(current.ownerId, title ?? `${current.title} Copy`, current.storedProject);
  }

  async delete(ownerId: string, projectId: string, expectedRevision?: number): Promise<void> {
    const current = this.readRecord(ownerId, projectId);
    if (expectedRevision !== undefined) {
      assertRevisionMatches(current, expectedRevision);
    }
    this.records.delete(recordKey(current.ownerId, current.projectId));
  }

  private readRecord(ownerId: string, projectId: string): PersistedRecord {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const normalizedProjectId = validateProjectId(projectId);
    const record = this.records.get(recordKey(normalizedOwnerId, normalizedProjectId));
    if (record === undefined) {
      throw new ProjectRepositoryError("NOT_FOUND", "project not found for owner", {
        projectId: normalizedProjectId,
      });
    }
    return record;
  }

  private nextUnusedProjectId(ownerId: string): string {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const projectId = validateProjectId(this.options.idFactory());
      if (!this.records.has(recordKey(ownerId, projectId))) {
        return projectId;
      }
    }
    throw new ProjectRepositoryError(
      "INVALID_PROJECT",
      "idFactory did not produce a unique project id",
    );
  }
}

export interface SqlExecutor {
  execute<R extends SqlRow = SqlRow>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<SqlResult<R>>;
}

export interface SqlResult<R extends SqlRow = SqlRow> {
  readonly rows: readonly R[];
  readonly rowCount?: number;
}

export type SqlValue = string | number | null;
export type SqlRow = Record<string, unknown>;
export type SqlDialect = "postgresql" | "sqlite";

export interface SqlProjectRepositoryOptions extends ProjectRepositoryOptions {
  readonly executor: SqlExecutor;
  readonly dialect: SqlDialect;
}

interface ProjectSqlRow extends SqlRow {
  owner_id: string;
  project_id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  stored_project_json: string;
  semantic_hash: string;
}

interface ProjectSummarySqlRow extends SqlRow {
  owner_id: string;
  project_id: string;
  title: string;
  revision: number;
  created_at: string;
  updated_at: string;
  semantic_hash: string;
}

export class SqlProjectRepository implements ProjectRepository {
  private readonly executor: SqlExecutor;
  private readonly dialect: SqlDialect;
  private readonly options: NormalizedOptions;

  constructor(options: SqlProjectRepositoryOptions) {
    this.executor = options.executor;
    this.dialect = options.dialect;
    this.options = normalizeOptions(options);
  }

  async create(
    ownerId: string,
    title: string,
    storedProject: StoredProject,
  ): Promise<ProjectRecord> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const normalizedTitle = validateTitle(title, this.options.maxTitleLength);
    const compatibleProject = validateStoredProject(storedProject, this.options.maxPayloadBytes);
    const serialized = serializeStoredProject(compatibleProject);
    const semanticHash = semanticProjectHash(compatibleProject);
    const now = this.options.now();

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const projectId = validateProjectId(this.options.idFactory());
      try {
        const result = await this.executor.execute<ProjectSqlRow>(
          sqlFor(
            this.dialect,
            `insert into agorix_projects
              (owner_id, project_id, title, revision, created_at, updated_at, stored_project_json, semantic_hash)
             values (?, ?, ?, ?, ?, ?, ?, ?)
             returning owner_id, project_id, title, revision, created_at, updated_at, stored_project_json, semantic_hash`,
          ),
          [normalizedOwnerId, projectId, normalizedTitle, 1, now, now, serialized, semanticHash],
        );
        return rowToProjectRecord(requireSingleRow(result, projectId));
      } catch (error) {
        if (isUniqueConflict(error)) {
          continue;
        }
        throw normalizeSqlError(error, projectId);
      }
    }

    throw new ProjectRepositoryError(
      "INVALID_PROJECT",
      "idFactory did not produce a unique project id",
    );
  }

  async get(ownerId: string, projectId: string): Promise<ProjectRecord> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const normalizedProjectId = validateProjectId(projectId);
    const result = await this.executor.execute<ProjectSqlRow>(
      sqlFor(
        this.dialect,
        `select owner_id, project_id, title, revision, created_at, updated_at, stored_project_json, semantic_hash
         from agorix_projects
         where owner_id = ? and project_id = ?`,
      ),
      [normalizedOwnerId, normalizedProjectId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new ProjectRepositoryError("NOT_FOUND", "project not found for owner", {
        projectId: normalizedProjectId,
      });
    }
    return rowToProjectRecord(row);
  }

  async list(ownerId: string, cursor?: string): Promise<ProjectListPage> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const offset = parseCursor(cursor);
    const result = await this.executor.execute<ProjectSummarySqlRow>(
      sqlFor(
        this.dialect,
        `select owner_id, project_id, title, revision, created_at, updated_at, semantic_hash
         from agorix_projects
         where owner_id = ?
         order by updated_at desc, project_id asc
         limit ? offset ?`,
      ),
      [normalizedOwnerId, this.options.pageSize + 1, offset],
    );
    const visibleRows = result.rows.slice(0, this.options.pageSize);
    const nextOffset = offset + visibleRows.length;
    return {
      items: visibleRows.map(rowToProjectSummary),
      ...(result.rows.length > this.options.pageSize
        ? { nextCursor: formatCursor(nextOffset) }
        : {}),
    };
  }

  async update(
    ownerId: string,
    projectId: string,
    expectedRevision: number,
    update: ProjectUpdate,
  ): Promise<ProjectRecord> {
    const current = await this.get(ownerId, projectId);
    assertRevisionMatches(current, expectedRevision);
    if (update.title === undefined && update.storedProject === undefined) {
      throw new ProjectRepositoryError(
        "INVALID_PROJECT",
        "update requires a title or storedProject",
        {
          projectId,
        },
      );
    }

    const nextProject =
      update.storedProject === undefined
        ? current.storedProject
        : validateStoredProject(update.storedProject, this.options.maxPayloadBytes);
    const nextTitle =
      update.title === undefined
        ? current.title
        : validateTitle(update.title, this.options.maxTitleLength);
    const serialized = serializeStoredProject(nextProject);
    const nextRevision = current.revision + 1;
    const updatedAt = this.options.now();
    const result = await this.executor.execute<ProjectSqlRow>(
      sqlFor(
        this.dialect,
        `update agorix_projects
         set title = ?, revision = ?, updated_at = ?, stored_project_json = ?, semantic_hash = ?
         where owner_id = ? and project_id = ? and revision = ?
         returning owner_id, project_id, title, revision, created_at, updated_at, stored_project_json, semantic_hash`,
      ),
      [
        nextTitle,
        nextRevision,
        updatedAt,
        serialized,
        semanticProjectHash(nextProject),
        current.ownerId,
        current.projectId,
        expectedRevision,
      ],
    );
    if (result.rows[0] === undefined) {
      throw new ProjectRepositoryError("CONFLICT", "project revision changed before update", {
        projectId: current.projectId,
      });
    }
    return rowToProjectRecord(result.rows[0]);
  }

  async duplicate(ownerId: string, projectId: string, title?: string): Promise<ProjectRecord> {
    const current = await this.get(ownerId, projectId);
    return this.create(current.ownerId, title ?? `${current.title} Copy`, current.storedProject);
  }

  async delete(ownerId: string, projectId: string, expectedRevision?: number): Promise<void> {
    const normalizedOwnerId = validateOwnerId(ownerId);
    const normalizedProjectId = validateProjectId(projectId);
    const params =
      expectedRevision === undefined
        ? [normalizedOwnerId, normalizedProjectId]
        : [normalizedOwnerId, normalizedProjectId, validateExpectedRevision(expectedRevision)];
    const result = await this.executor.execute(
      sqlFor(
        this.dialect,
        expectedRevision === undefined
          ? "delete from agorix_projects where owner_id = ? and project_id = ?"
          : "delete from agorix_projects where owner_id = ? and project_id = ? and revision = ?",
      ),
      params,
    );
    if ((result.rowCount ?? 0) === 0) {
      await assertDeleteMiss(this, normalizedOwnerId, normalizedProjectId, expectedRevision);
    }
  }
}

export const POSTGRESQL_SCHEMA_SQL = `
create table if not exists agorix_projects (
  owner_id text not null,
  project_id text not null,
  title text not null,
  revision integer not null check (revision >= 1),
  created_at text not null,
  updated_at text not null,
  stored_project_json text not null,
  semantic_hash text not null,
  primary key (owner_id, project_id)
);

create index if not exists agorix_projects_owner_created_idx
  on agorix_projects (owner_id, updated_at desc, project_id);
`;

export const SQLITE_SCHEMA_SQL = POSTGRESQL_SCHEMA_SQL;

export const PROJECT_REPOSITORY_MIGRATIONS = [
  {
    id: "001_create_agorix_projects",
    postgresql: POSTGRESQL_SCHEMA_SQL,
    sqlite: SQLITE_SCHEMA_SQL,
  },
] as const;

export function validateStoredProject(
  storedProject: StoredProject,
  maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES,
): StoredProject {
  if (typeof storedProject !== "object" || storedProject === null) {
    throw new ProjectRepositoryError("INVALID_STORED_PROJECT", "storedProject must be an object");
  }
  if (storedProject.schemaVersion !== SCHEMA_VERSION) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      `unsupported StoredProject schemaVersion ${storedProject.schemaVersion}`,
    );
  }
  const forbiddenProgramKey = findForbiddenCanonicalProgramKey(storedProject.program);
  if (forbiddenProgramKey !== undefined) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      `identity or ownership key "${forbiddenProgramKey.key}" is not allowed in ProjectProgram at ${forbiddenProgramKey.path}`,
    );
  }
  const compatibleProject = assertCrossSurfaceCompatibleProject(storedProject);
  validateMetadata(compatibleProject.metadata);
  const payloadBytes = utf8Bytes(serializeStoredProject(compatibleProject));
  if (payloadBytes > maxPayloadBytes) {
    throw new ProjectRepositoryError(
      "PAYLOAD_TOO_LARGE",
      `storedProject payload is ${payloadBytes} bytes; max is ${maxPayloadBytes}`,
    );
  }
  return compatibleProject;
}

function validateMetadata(metadata: StoredProject["metadata"]): void {
  if (typeof metadata !== "object" || metadata === null) {
    throw new ProjectRepositoryError("INVALID_STORED_PROJECT", "metadata must be an object");
  }
  validateIsoTimestamp(metadata.createdAt, "metadata.createdAt");
  validateIsoTimestamp(metadata.updatedAt, "metadata.updatedAt");
  if (!Number.isFinite(metadata.missionProgress) || metadata.missionProgress < 0) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      "missionProgress must be a non-negative number",
    );
  }
  if (!Number.isInteger(metadata.hintLevel) || metadata.hintLevel < 0) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      "hintLevel must be a non-negative integer",
    );
  }
}

function validateOwnerId(ownerId: string): string {
  if (!isStableIdentifier(ownerId)) {
    throw new ProjectRepositoryError("INVALID_OWNER", "ownerId must be a stable opaque identifier");
  }
  return ownerId;
}

function validateProjectId(projectId: string): string {
  if (!isStableIdentifier(projectId)) {
    throw new ProjectRepositoryError(
      "INVALID_PROJECT",
      "projectId must be a stable opaque identifier",
      {
        projectId,
      },
    );
  }
  return projectId;
}

function validateTitle(title: string, maxTitleLength: number): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > maxTitleLength) {
    throw new ProjectRepositoryError(
      "INVALID_TITLE",
      `title must be between 1 and ${maxTitleLength} characters`,
    );
  }
  return normalized;
}

function validateExpectedRevision(expectedRevision: number): number {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new ProjectRepositoryError(
      "INVALID_REVISION",
      "expectedRevision must be a positive integer",
    );
  }
  return expectedRevision;
}

function validateIsoTimestamp(value: string, fieldName: string): void {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      `${fieldName} must be an ISO timestamp`,
    );
  }
}

function assertRevisionMatches(
  record: Pick<ProjectRecord, "revision" | "projectId">,
  expectedRevision: number,
): void {
  const normalizedExpectedRevision = validateExpectedRevision(expectedRevision);
  if (record.revision !== normalizedExpectedRevision) {
    throw new ProjectRepositoryError(
      "CONFLICT",
      `expected revision ${normalizedExpectedRevision}, found ${record.revision}`,
      { projectId: record.projectId },
    );
  }
}

function normalizeOptions(options: ProjectRepositoryOptions): NormalizedOptions {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new ProjectRepositoryError("INVALID_CURSOR", "pageSize must be a positive integer");
  }
  return {
    pageSize,
    now: options.now ?? (() => new Date().toISOString()),
    idFactory: options.idFactory ?? createDeterministicIdFactory(),
    maxTitleLength: options.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH,
    maxPayloadBytes: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES,
  };
}

function createDeterministicIdFactory(): () => string {
  let nextId = 1;
  return () => `proj_${String(nextId++).padStart(6, "0")}`;
}

function toProjectRecord(record: PersistedRecord): ProjectRecord {
  const storedProject = cloneStoredProject(record.storedProject);
  return {
    contractVersion: PROJECT_REPOSITORY_CONTRACT_VERSION,
    ownerId: record.ownerId,
    projectId: record.projectId,
    title: record.title,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    storedProject,
    semanticHash: semanticProjectHash(storedProject),
  };
}

function toProjectSummary(
  record: Pick<ProjectRecord, Exclude<keyof ProjectRecord, "storedProject">>,
): ProjectSummary {
  return {
    contractVersion: record.contractVersion,
    ownerId: record.ownerId,
    projectId: record.projectId,
    title: record.title,
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    semanticHash: record.semanticHash,
  };
}

function rowToProjectRecord(row: ProjectSqlRow): ProjectRecord {
  const storedProject = parseStoredProject(row.stored_project_json, row.project_id);
  const record = toProjectRecord({
    ownerId: row.owner_id,
    projectId: row.project_id,
    title: row.title,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storedProject,
  });
  if (record.semanticHash !== row.semantic_hash) {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      "stored semantic hash does not match payload",
      {
        projectId: row.project_id,
      },
    );
  }
  return record;
}

function rowToProjectSummary(row: ProjectSummarySqlRow): ProjectSummary {
  return {
    contractVersion: PROJECT_REPOSITORY_CONTRACT_VERSION,
    ownerId: row.owner_id,
    projectId: row.project_id,
    title: row.title,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    semanticHash: row.semantic_hash,
  };
}

function parseStoredProject(raw: string, projectId: string): StoredProject {
  try {
    return JSON.parse(raw) as StoredProject;
  } catch {
    throw new ProjectRepositoryError(
      "INVALID_STORED_PROJECT",
      "storedProject JSON could not be parsed",
      {
        projectId,
      },
    );
  }
}

function serializeStoredProject(storedProject: StoredProject): string {
  return JSON.stringify(storedProject);
}

function cloneStoredProject(storedProject: StoredProject): StoredProject {
  return parseStoredProject(serializeStoredProject(storedProject), "clone");
}

function isStableIdentifier(value: string): boolean {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(value);
}

function recordKey(ownerId: string, projectId: string): string {
  return `${ownerId}\u0000${projectId}`;
}

function compareRecords(left: PersistedRecord, right: PersistedRecord): number {
  const updatedAt = right.updatedAt.localeCompare(left.updatedAt);
  return updatedAt === 0 ? left.projectId.localeCompare(right.projectId) : updatedAt;
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  const match = /^offset:(\d+)$/.exec(cursor);
  if (match === null) {
    throw new ProjectRepositoryError("INVALID_CURSOR", "cursor is not recognized");
  }
  return Number(match[1]);
}

function formatCursor(offset: number): string {
  return `offset:${offset}`;
}

function requireSingleRow<R extends SqlRow>(result: SqlResult<R>, projectId: string): R {
  const row = result.rows[0];
  if (row === undefined) {
    throw new ProjectRepositoryError("SQL_ERROR", "SQL statement did not return a project row", {
      projectId,
    });
  }
  return row;
}

function sqlFor(dialect: SqlDialect, sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (dialect === "sqlite") {
    return normalized;
  }
  let parameterIndex = 0;
  return normalized.replace(/\?/g, () => `$${++parameterIndex}`);
}

function isUniqueConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  return (
    maybeCode === "23505" ||
    maybeCode === "SQLITE_CONSTRAINT" ||
    maybeCode === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}

function normalizeSqlError(error: unknown, projectId?: string): ProjectRepositoryError {
  if (error instanceof ProjectRepositoryError) {
    return error;
  }
  const options = projectId === undefined ? {} : { projectId };
  return new ProjectRepositoryError(
    "SQL_ERROR",
    error instanceof Error ? error.message : String(error),
    options,
  );
}

async function assertDeleteMiss(
  repository: SqlProjectRepository,
  ownerId: string,
  projectId: string,
  expectedRevision: number | undefined,
): Promise<void> {
  if (expectedRevision === undefined) {
    throw new ProjectRepositoryError("NOT_FOUND", "project not found for owner", { projectId });
  }
  try {
    await repository.get(ownerId, projectId);
  } catch (error) {
    if (error instanceof ProjectRepositoryError && error.code === "NOT_FOUND") {
      throw error;
    }
    throw normalizeSqlError(error, projectId);
  }
  throw new ProjectRepositoryError("CONFLICT", "project revision changed before delete", {
    projectId,
  });
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function findForbiddenCanonicalProgramKey(
  value: unknown,
  path = "$.program",
): { key: string; path: string } | undefined {
  const forbiddenKeys = new Set([
    "accountId",
    "ownerAccountId",
    "ownerId",
    "sessionId",
    "username",
    "alias",
    "email",
    "recoveryContact",
    "projectId",
    "revision",
    "serverProjectRevision",
  ]);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = findForbiddenCanonicalProgramKey(value[index], `${path}[${index}]`);
      if (nested !== undefined) {
        return nested;
      }
    }
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) {
      return { key, path: `${path}.${key}` };
    }
    const nested = findForbiddenCanonicalProgramKey(nestedValue, `${path}.${key}`);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}
