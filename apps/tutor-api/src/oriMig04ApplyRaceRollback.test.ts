import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
describe("MIG-04 apply rollback after asynchronous identity refresh", () => {
  it("rejects apply if kill switch trips while identity refresh is pending", async () => {
    const controller = createOriMig04RolloutController();
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["pilot"],
      }),
    ).toBe(true);
    let resolveRefresh: (() => void) | undefined;
    let notifyRefresh: (() => void) | undefined;
    const enteredRefresh = new Promise<void>((resolve) => {
      notifyRefresh = resolve;
    });
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    let identityCalls = 0;
    let applies = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriReviewApplyEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriReviewIdentity: async () => {
        identityCalls++;
        if (identityCalls === 2) {
          notifyRefresh?.();
          await refreshGate;
        }
        return { ownerId: "student", projectId: "pilot" };
      },
      oriReviewApply: async () => {
        applies++;
        return "applied";
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const request = fetch(base + "/api/tutor/ori/review/apply", {
      method: "POST",
      headers: {
        origin: base,
        "x-agorix-request": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ticketId: "123e4567-e89b-42d3-a456-426614174000",
        scriptId: "main",
      }),
    });
    await enteredRefresh;
    controller.emergencyDisable();
    resolveRefresh?.();
    expect((await request).status).toBe(404);
    expect(applies).toBe(0);
  });
});
