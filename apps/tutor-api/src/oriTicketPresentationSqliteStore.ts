import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[a-f0-9]{64}$/;

/** Durable, server-owned ticket presentation acknowledgements. */
export function openOriTicketPresentationSqliteStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`CREATE TABLE IF NOT EXISTS ori_ticket_presentation(
    owner TEXT NOT NULL, project_id TEXT NOT NULL, ticket_id TEXT NOT NULL,
    description_hash TEXT NOT NULL, PRIMARY KEY(owner,project_id,ticket_id));`);
  const insert = db.prepare(`INSERT INTO ori_ticket_presentation
    (owner,project_id,ticket_id,description_hash) VALUES(?,?,?,?)
    ON CONFLICT DO NOTHING`);
  const select = db.prepare(`SELECT description_hash FROM ori_ticket_presentation
    WHERE owner=? AND project_id=? AND ticket_id=?`);
  return Object.freeze({
    async record(entry: {
      readonly owner: string;
      readonly projectId: string;
      readonly ticketId: string;
      readonly descriptionHash: string;
    }): Promise<boolean> {
      if (!ID.test(entry.owner) || !ID.test(entry.projectId) ||
          !UUID.test(entry.ticketId) || !HEX.test(entry.descriptionHash)) return false;
      return insert.run(entry.owner, entry.projectId, entry.ticketId,
        entry.descriptionHash).changes === 1;
    },
    read(owner: string, projectId: string, ticketId: string): string | null {
      if (!ID.test(owner) || !ID.test(projectId) || !UUID.test(ticketId)) return null;
      const row = select.get(owner, projectId, ticketId);
      return row ? String(row["description_hash"]) : null;
    },
    close: () => db.close(),
  });
}
