import { chmodSync,mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OriActiveProjectPersistence,OriActiveProjectRecord } from "./oriExpiringActiveProjectStore.js";

export interface OriSqliteActiveProjectPersistence extends OriActiveProjectPersistence {
  close():void;
}
/** Local single-host persistence. Multi-instance deployments need a shared DB. */
export function openOriSqliteActiveProjectPersistence(path:string):OriSqliteActiveProjectPersistence {
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db=new DatabaseSync(path);
  if(path!==":memory:")chmodSync(path,0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_active_projects (
    account_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY(account_id,session_id)
  )`);
  const read=db.prepare("SELECT account_id,session_id,project_id,expires_at FROM ori_active_projects WHERE account_id=? AND session_id=?");
  const write=db.prepare(`INSERT INTO ori_active_projects(account_id,session_id,project_id,expires_at)
    VALUES(?,?,?,?) ON CONFLICT(account_id,session_id)
    DO UPDATE SET project_id=excluded.project_id,expires_at=excluded.expires_at`);
  const remove=db.prepare("DELETE FROM ori_active_projects WHERE account_id=? AND session_id=?");
  return Object.freeze({
    async read(accountId:string,sessionId:string):Promise<OriActiveProjectRecord|null>{
      const row=read.get(accountId,sessionId);
      if(!row)return null;
      return {accountId:String(row["account_id"]),sessionId:String(row["session_id"]),
        projectId:String(row["project_id"]),expiresAt:Number(row["expires_at"])};
    },
    async write(record:OriActiveProjectRecord):Promise<void>{
      write.run(record.accountId,record.sessionId,record.projectId,record.expiresAt);
    },
    async delete(accountId:string,sessionId:string):Promise<void>{
      remove.run(accountId,sessionId);
    },
    close(){db.close();}
  });
}
