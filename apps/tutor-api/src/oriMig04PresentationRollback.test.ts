import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((done) => server.close(() => done())),
    ),
  );
});
describe("MIG-04 presentation receipt rollback", () => {
  it("blocks presentation receipts after kill switch without invoking handler", async () => {
    const controller = createOriMig04RolloutController();
    let calls = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriPresentationAckEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: "pilot" }),
      oriPresentationAckHandler: async (_request, response) => {
        calls++;
        response.writeHead(200);
        response.end("{}");
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = () =>
      fetch(base + "/api/tutor/ori/review/presented", {
        method: "POST",
        headers: {
          origin: base,
          "x-agorix-request": "1",
          "content-type": "application/json",
        },
        body: "{}",
      });
    expect((await post()).status).toBe(404);
    expect(calls).toBe(0);
    expect(controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["pilot"],
    })).toBe(true);
    expect((await post()).status).toBe(200);
    expect(calls).toBe(1);
    controller.emergencyDisable();
    expect((await post()).status).toBe(404);
    expect(calls).toBe(1);
  });
});
