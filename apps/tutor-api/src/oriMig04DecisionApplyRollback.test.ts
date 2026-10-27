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

describe("MIG-04 rollback blocks outstanding decision and apply requests", () => {
  it("rejects both routes after kill switch without invoking mutations", async () => {
    const controller = createOriMig04RolloutController();
    let decisions = 0;
    let applies = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriReviewApplyEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: "pilot" }),
      oriReviewDecision: async () => {
        decisions++;
        return null;
      },
      oriReviewApply: async () => {
        applies++;
        return "rejected";
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (route: string) => fetch(base + route, {
      method: "POST",
      headers: {
        origin: base,
        "x-agorix-request": "1",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(controller.replaceFromHost({
      mode: "pilot",
      humanAuthorized: true,
      killSwitch: false,
      approvedProjectIds: ["pilot"],
    })).toBe(true);
    controller.emergencyDisable();
    expect((await post("/api/tutor/ori/review/decision")).status).toBe(404);
    expect((await post("/api/tutor/ori/review/apply")).status).toBe(404);
    expect(decisions).toBe(0);
    expect(applies).toBe(0);
  });
});
