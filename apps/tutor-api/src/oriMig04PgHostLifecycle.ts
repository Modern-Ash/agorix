import type { AddressInfo } from "node:net";
import { createOriMig04PgTutorServer } from "./oriMig04PgTutorServer.js";

/**
 * Explicit opt-in host entrypoint for infrastructure that already provides
 * authenticated sessions, canonical persistence, and a shared PostgreSQL pool.
 * Never constructs these from learner input or environment flags.
 */
export async function startOriMig04PgHost({
  tutor,
  ori,
  host = "127.0.0.1",
  port = 0,
}: Parameters<typeof createOriMig04PgTutorServer>[0] & {
  readonly host?: string;
  readonly port?: number;
}) {
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("Invalid Ori host port");
  }
  const { server, emergencyDisable } = createOriMig04PgTutorServer({ tutor, ori });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    server.close();
    throw error;
  }
  let closed = false;
  return Object.freeze({
    address: server.address() as AddressInfo,
    emergencyDisable,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  });
}
