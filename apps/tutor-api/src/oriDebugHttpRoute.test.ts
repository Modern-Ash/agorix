import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { configFromEnv } from "./index.js";
import { createOriMig04RolloutController } from "./oriMig04RolloutController.js";
import { createTutorServer } from "./server.js";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

describe("Ori read-only debug HTTP gate", () => {
  it("requires adult identity, rollout, same origin and an empty request", async () => {
    const controller = createOriMig04RolloutController();
    let authenticated = true;
    let visible = true;
    let calls = 0;
    const server = createTutorServer({
      config: configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
      oriReviewEnabled: true,
      oriMig04RolloutDecide: controller.decide,
      oriMig04Visibility: async () => visible,
      oriReviewIdentity: async () =>
        authenticated ? { ownerId: "adult", projectId: "project" } : null,
      oriReviewDebug: async () => {
        calls++;
        return {
          schema: "agorix/ori-debug-guidance/v1",
          nextStep: "Revisar el paso 2 de la traza verificada por el host",
          question: "Preguntarse si ese paso produjo lo que esperabas",
          appliedChanges: false,
        };
      },
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (body = "{}", headers: Record<string, string> = {}) =>
      fetch(base + "/api/tutor/ori/review/debug", {
        method: "POST",
        body,
        headers: {
          origin: base,
          "content-type": "application/json",
          "x-agorix-request": "1",
          ...headers,
        },
      });
    expect((await post()).status).toBe(404);
    expect(calls).toBe(0);
    expect(
      controller.replaceFromHost({
        mode: "pilot",
        humanAuthorized: true,
        killSwitch: false,
        approvedProjectIds: ["project"],
      }),
    ).toBe(true);
    expect((await post('{"projectId":"other"}')).status).toBe(400);
    expect((await post("{}", { origin: "https://untrusted.example" })).status).toBe(403);
    expect((await post("{}", { "x-agorix-request": "0" })).status).toBe(403);
    expect(calls).toBe(0);
    authenticated = false;
    expect((await post()).status).toBe(401);
    authenticated = true;
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ appliedChanges: false });
    expect(calls).toBe(1);
    visible = false;
    expect((await post()).status).toBe(404);
    visible = true;
    controller.emergencyDisable();
    expect((await post()).status).toBe(404);
    expect(calls).toBe(2);
  });
});
