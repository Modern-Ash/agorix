# Project Repository

The project repository is the durable multi-project boundary for authenticated
or account-scoped project storage. It keeps ownership and repository metadata
outside `ProjectProgram`, preserving the canonical `StoredProject` semantics used
by web, Studio, import/export, and cross-surface compatibility checks.

## Contract

The provider-neutral interface is exported from `@agorix/project-repository`:

- `create(ownerId, title, storedProject)`
- `get(ownerId, projectId)`
- `list(ownerId, cursor?)`
- `update(ownerId, projectId, expectedRevision, { storedProject?, title? })`
- `duplicate(ownerId, projectId, title?)`
- `delete(ownerId, projectId, expectedRevision?)`

`ownerId` is an opaque account identifier. The repository owns `projectId`,
`title`, `revision`, `createdAt`, `updatedAt`, and `semanticHash`. These fields
must not be copied into `StoredProject.program`.

Project lists sort by `updatedAt` descending with `projectId` as a deterministic
tie-breaker. SQL list queries return summary columns only and do not parse the
full `StoredProject` payload.

Before every write, the repository validates:

- current `StoredProject.schemaVersion`
- valid `ProjectProgram`
- cross-surface compatibility, including no identity or ownership fields inside
  canonical program state
- metadata timestamps and progress fields
- UTF-8 payload size
- non-empty bounded title

Revisions are optimistic-concurrency tokens. Updates and guarded deletes require
the caller's expected revision and fail with `CONFLICT` instead of overwriting a
newer version.

## SQL Boundary

The SQL adapter depends only on:

```ts
interface SqlExecutor {
  execute<R>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<{
    rows: readonly R[];
    rowCount?: number;
  }>;
}
```

Applications can bind this to PostgreSQL, SQLite, or another SQL runtime without
adding vendor-specific fields to the repository domain. The canonical table is:

```sql
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
```

The package exports the same schema as `POSTGRESQL_SCHEMA_SQL`,
`SQLITE_SCHEMA_SQL`, and `PROJECT_REPOSITORY_MIGRATIONS`.
