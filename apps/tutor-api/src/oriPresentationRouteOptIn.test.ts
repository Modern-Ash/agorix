import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
async function start(enabled: boolean, handler = true) {
  let calls = 0;
  const server = createTutorServer({
    config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    oriReviewEnabled: true,
    oriPresentationAckEnabled: enabled,
    ...(handler
      ? {
          oriPresentationAckHandler: async (
            _request: unknown,
            response: import("node:http").ServerResponse,
          ) => {
            calls++;
            response.writeHead(200);
            response.end("{}");
          },
        }
      : {}),
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tutor/ori/review/presented`,
    calls: () => calls,
  };
}
describe("Ori presentation route opt-in", () => {
  it("returns 404 without explicit opt-in or handler", async () => {
    const disabled = await start(false);
    expect((await fetch(disabled.url, { method: "POST" })).status).toBe(404);
    const absent = await start(true, false);
    expect((await fetch(absent.url, { method: "POST" })).status).toBe(404);
    expect(disabled.calls()).toBe(0);
    expect(absent.calls()).toBe(0);
  });
  it("dispatches only to explicitly injected handler", async () => {
    const active = await start(true);
    expect((await fetch(active.url, { method: "POST" })).status).toBe(200);
    expect(active.calls()).toBe(1);
  });
});
