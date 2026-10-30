import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { Pool } from "pg";
import {
  AuthService,
  SqlAccountRepository,
  SqlSessionRepository,
  type AuthSqlExecutor,
  type AuthSqlRow,
  type AuthSqlValue,
} from "@agorix/auth-service";
import {
  SqlProjectRepository,
  type SqlExecutor,
  type SqlRow,
  type SqlValue,
} from "@agorix/project-repository";
import { createOriMig04PgAuthorizedOptions } from "./oriMig04PgAuthorizedOptions.js";
import { createOriSessionLearningJournal } from "./oriSessionLearningJournal.js";
import { oriHostProposalConfigFromEnv } from "./oriHostEvidenceAdapter.js";

type Value = AuthSqlValue & SqlValue;
type Row = AuthSqlRow & SqlRow;

/** Optional host bootstrap. It never creates policy or opens access by itself. */
export async function openOriMig04Pilot(env: NodeJS.ProcessEnv) {
  const url = env["AGORIX_TUTOR_POSTGRES_URL"];
  const deploymentId = env["AGORIX_ORI_DEPLOYMENT_ID"];
  const allowedAdultEmail = env["AGORIX_ALLOWED_ADULT_EMAIL"];
  const oriRoot = env["ORI_REPO_PATH"];
  if (
    !url ||
    !deploymentId ||
    !allowedAdultEmail ||
    !oriRoot ||
    !isAbsolute(oriRoot) ||
    !existsSync(oriRoot)
  ) {
    throw new Error("MIG-04 pilot configuration is incomplete");
  }
  const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000 });
  try {
    const schema = await pool.query<{ policy: string | null; audit: string | null }>(
      `select to_regclass('agorix_ori_rollout_policy')::text as policy,
              to_regclass('agorix_ori_commit_audit')::text as audit`,
    );
    if (!schema.rows[0]?.policy || !schema.rows[0]?.audit)
      throw new Error("MIG-04 PostgreSQL schema is not migrated");
    const executor: AuthSqlExecutor & SqlExecutor = {
      async execute<R extends Row = Row>(sql: string, params: readonly Value[] = []) {
        const result = await pool.query<R>(sql, [...params]);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
    };
    const auth = new AuthService({
      accounts: new SqlAccountRepository({ executor, dialect: "postgresql" }),
      sessions: new SqlSessionRepository({ executor, dialect: "postgresql" }),
    });
    const repository = new SqlProjectRepository({ executor, dialect: "postgresql" });
    const journal = createOriSessionLearningJournal();
    const proposalConfig = oriHostProposalConfigFromEnv(env);
    const authorized = createOriMig04PgAuthorizedOptions({
      pool,
      auth,
      repository,
      deploymentId,
      allowedAdultEmail,
      oriRoot,
      ...(proposalConfig ? { proposalConfig } : {}),
      world: {},
      sessionJournal: journal,
    });
    return {
      options: authorized.options,
      close: () => pool.end(),
      emergencyDisable: authorized.emergencyDisable,
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
