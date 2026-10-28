import { describe, expect, it } from "vitest";
import { createOriMig04PgSessionProjectInfrastructure } from "./oriMig04PgSessionProjectInfrastructure.js";
import { ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL } from "./oriMig04PgSessionProjectStore.js";

const databaseUrl = process.env["ORI_MIG04_TEST_DATABASE_URL"];
const run = databaseUrl ? describe : describe.skip;

run("MIG-04 real PostgreSQL session project mapping", () => {
  it("isolates project selection by authenticated account and session", async () => {
    if (!databaseUrl) throw Error("Missing test database URL");
    const infrastructure = createOriMig04PgSessionProjectInfrastructure(databaseUrl);
    const accountId = `ori_owner_${Date.now()}`;
    const sessionId = `ori_session_${Date.now()}`;
    try {
      await infrastructure.sqlPool.query(ORI_MIG04_SESSION_PROJECT_SCHEMA_SQL);
      await infrastructure.sqlPool.query(
        "insert into agorix_ori_session_projects (account_id, session_id, project_id) values ($1, $2, $3)",
        [accountId, sessionId, "project_1"],
      );
      // A mapping alone must not grant access to a missing canonical project.
      expect(await infrastructure.projectStore.getActiveProject(accountId, sessionId)).toBeNull();
      expect(await infrastructure.projectStore.getActiveProject("other", sessionId)).toBeNull();
      expect(await infrastructure.projectStore.getActiveProject(accountId, "other")).toBeNull();
      await infrastructure.projectLifecycle.rotate(accountId, sessionId, "rotated");
      expect(await infrastructure.projectStore.getActiveProject(accountId, sessionId)).toBeNull();
      expect(await infrastructure.projectStore.getActiveProject(accountId, "rotated")).toBeNull();
      await infrastructure.projectLifecycle.revokeAll(accountId);
      expect(await infrastructure.projectStore.getActiveProject(accountId, "rotated")).toBeNull();
    } finally {
      await infrastructure.sqlPool.query(
        "delete from agorix_ori_session_projects where account_id = $1 and session_id = $2",
        [accountId, sessionId],
      );
      await infrastructure.close();
    }
  });
});
