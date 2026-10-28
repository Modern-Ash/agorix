import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createTutorServer } from "./server.js";
import { configFromEnv } from "./index.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";
import { createOriMig04RolloutTelemetry } from "./oriMig04RolloutTelemetry.js";
import { createOriMig04CircuitBreaker } from "./oriMig04CircuitBreaker.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))),
  );
});
describe("MIG-04 live HTTP telemetry and automatic rollback", () => {
  it("trips circuit breaker during proposal and blocks response", async () => {
    const controller = createOriMig04RolloutController();
    const breaker = createOriMig04CircuitBreaker({
      controller,
      telemetry: createOriMig04RolloutTelemetry(),
      minimumSamples: 1,
      maxP95Ms: 1,
    });
    let issued = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriMig04Observe: breaker.observe,
      oriReviewIdentity: async () => ({ ownerId: "student", projectId: "pilot" }),
      oriReviewPropose: async () => {
        issued++;
        await new Promise<void>((done) => setTimeout(done, 15));
        return null;
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["pilot"],
      }),
    ).toBe(true);
    const response = await fetch(base + "/api/tutor/ori/review/propose", {
      method: "POST",
      headers: {
        origin: base,
        "x-agorix-request": "1",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(404);
    expect(issued).toBe(1);
    expect(breaker.snapshot().tripped).toBe(true);
    expect(controller.decide("pilot").learnerVisible).toBe(false);
  });
});
