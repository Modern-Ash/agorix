import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriEducatorRouteDispatcher } from "./oriEducatorRouteDispatcher.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
async function start(enabled: boolean) {
  const calls: string[] = [];
  const handler = async (
    operation: string,
    id: string,
    _request: unknown,
    response: {
      writeHead: (code: number) => void;
      end: (body: string) => void;
    },
  ) => {
    calls.push(operation + "/" + id);
    response.writeHead(200);
    response.end(JSON.stringify({ status: "ready" }));
  };
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriEducatorAdminEnabled: enabled,
    oriEducatorAdminDispatch: createOriEducatorRouteDispatcher({ handler, enabled: true }),
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, calls };
}
describe("Ori adult educator TutorServer route opt-in", () => {
  it("returns 404 by default without invoking dispatcher", async () => {
    const { base, calls } = await start(false);
    expect(
      (
        await fetch(base + "/api/tutor/admin/ori-educator/pilot/snapshot", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
    expect(calls).toHaveLength(0);
  });
  it("dispatches only explicitly enabled adult review routes", async () => {
    const { base, calls } = await start(true);
    const response = await fetch(base + "/api/tutor/admin/ori-educator/pilot/snapshot", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(calls).toEqual(["snapshot/pilot"]);
    expect(
      (
        await fetch(base + "/api/tutor/admin/ori-educator/pilot/unknown", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
  });
});
