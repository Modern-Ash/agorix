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

describe("MIG-04 TutorServer learner proposal gate", () => {
  it("rechecks durable visibility after asynchronous proposal work", async () => {
    let visible = true;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: "pilot" }),
      oriMig04Visibility: async (owner, projectId) =>
        visible && owner === "student" && projectId === "pilot",
      oriReviewPropose: async () => {
        visible = false;
        return null;
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const response = await fetch(base + "/api/tutor/ori/review/propose", {
      method: "POST",
      headers: { origin: base, "x-agorix-request": "1", "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(404);
  });
  it("blocks proposals by default, permits authorized pilot, and revokes immediately", async () => {
    const controller = createOriMig04RolloutController();
    let issued = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: "pilot" }),
      oriReviewPropose: async () => {
        issued++;
        return null;
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const propose = () =>
      fetch(base + "/api/tutor/ori/review/propose", {
        method: "POST",
        headers: {
          origin: base,
          "x-agorix-request": "1",
          "content-type": "application/json",
        },
        body: "{}",
      });
    expect((await propose()).status).toBe(404);
    expect(issued).toBe(0);
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["pilot"],
      }),
    ).toBe(true);
    expect((await propose()).status).toBe(409);
    expect(issued).toBe(1);
    controller.emergencyDisable();
    expect((await propose()).status).toBe(404);
    expect(issued).toBe(1);
  });
});
