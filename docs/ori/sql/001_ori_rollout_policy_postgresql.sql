-- MIG-04 shared rollout policy. Schema creation never enables rollout.
create table if not exists agorix_ori_rollout_policy (
  deployment_id text primary key,
  epoch bigint not null default 0 check (epoch >= 0),
  mode text not null default 'disabled' check (mode in ('disabled', 'shadow', 'pilot')),
  human_authorized boolean not null default false,
  kill_switch boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists agorix_ori_rollout_projects (
  deployment_id text not null references agorix_ori_rollout_policy(deployment_id) on delete cascade,
  project_id text not null,
  primary key (deployment_id, project_id)
);
