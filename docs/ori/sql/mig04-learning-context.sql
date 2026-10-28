-- Apply through the operator-managed MIG-04 migration process BEFORE startup.
-- No migration runs automatically from tutor-api.
create table if not exists agorix_ori_learning_context (
  owner_id text not null,
  project_id text not null,
  attempts integer not null check (attempts between 0 and 100),
  hints_used integer not null check (hints_used between 0 and 100),
  learning_stage text not null check (learning_stage in ('explore', 'connect', 'translate')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, project_id)
);
