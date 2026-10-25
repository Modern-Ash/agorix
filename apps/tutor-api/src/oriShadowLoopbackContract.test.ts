import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";
import { createOriExternalShadowDispatcher } from "./oriExternalShadow.js";

/**
 * Consumer-driven loopback test with a real HTTP server, mirroring Ori /v1/plan.
 * No live Ori process, child data, program AST, or model requests.
 */
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

const validPlan = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 2,
  steps: ["Predecir el resultado", "Revisar un paso", "Comparar con lo esperado"],
  hint: "¿Qué esperás que pase si ejecutás tu programa?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 1 },
};

async function startProducer(responseBody: unknown, status = 200) {
  const seen: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString("utf8");
    seen.push({ method: request.method, path: request.url, payload: JSON.parse(body) });
    response.writeHead(status, { "content-type": "application/json" });
    response.end(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/plan`,
    seen,
  };
}

describe("Ori plan shadow loopback contract", () => {
  const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };

  it("transmits only metadata and discards a valid pedagogical plan", async () => {
    const producer = await startProducer(validPlan);
    const shadow = createOriShadowTransport(producer.url);
    expect(await shadow(input)).toBeUndefined();
    expect(producer.seen).toEqual([{
      method: "POST", path: "/v1/plan", payload: input,
    }]);
  });

  it("discards invalid or privileged producer responses", async () => {
    for (const body of [
      { ...validPlan, proposal: { operation: "append" } },
      { ...validPlan, appliedChanges: true },
      "{broken-json",
      "x".repeat(5000),
    ]) {
      const producer = await startProducer(body);
      const shadow = createOriShadowTransport(producer.url);
      expect(await shadow(input)).toBeUndefined();
      expect(producer.seen).toHaveLength(1);
    }
  });

  it("does not invoke HTTP when disabled", async () => {
    const producer = await startProducer(validPlan);
    const shadow = createOriShadowTransport(producer.url);
    const dispatcher = createOriExternalShadowDispatcher(1);
    dispatcher.dispatch(false, shadow, input);
    await Promise.resolve();
    expect(producer.seen).toHaveLength(0);
  });

  it("isolates unavailable producer from the tutor path", async () => {
    const dispatcher = createOriExternalShadowDispatcher(1);
    const originalTutorResponse = { message: "Pista actual de Agorix" };
    dispatcher.dispatch(true, createOriShadowTransport("http://127.0.0.1:1/v1/plan"), input);
    expect(originalTutorResponse).toEqual({ message: "Pista actual de Agorix" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(originalTutorResponse).toEqual({ message: "Pista actual de Agorix" });
  });
});
