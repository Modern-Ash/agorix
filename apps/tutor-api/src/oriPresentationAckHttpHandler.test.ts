import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { createOriPresentationAckHttpHandler } from "./oriPresentationAckHttpHandler.js";
import type { createOriTicketPresentationAcknowledgement } from "./oriTicketPresentationAcknowledgement.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
function request(body: unknown, headers: Record<string, string> = {}) {
  const stream = new PassThrough() as IncomingMessage & PassThrough;
  Object.assign(stream, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "x-agorix-request": "1",
      ...headers,
    },
  });
  stream.end(JSON.stringify(body));
  return stream;
}
function response() {
  let status = 0;
  return {
    value: {
      destroyed: false,
      writableEnded: false,
      headersSent: false,
      writeHead(code: number) {
        status = code;
      },
      end() {},
    } as unknown as ServerResponse,
    status: () => status,
  };
}
describe("Ori presentation acknowledgement HTTP boundary", () => {
  it("accepts authenticated project-scoped requests", async () => {
    let calls = 0;
    const service = {
      acknowledge: async () => {
        calls++;
        return "recorded";
      },
    } as unknown as ReturnType<typeof createOriTicketPresentationAcknowledgement>;
    const handler = createOriPresentationAckHttpHandler(
      async () => ({ ownerId: "student", projectId: "project" }),
      service,
    );
    const output = response();
    await handler(
      request({ ticketId, description: "Agregar movimiento de 2 paso(s)" }),
      output.value,
    );
    expect(output.status()).toBe(200);
    expect(calls).toBe(1);
  });
  it("blocks forged origin and identity before recording", async () => {
    let calls = 0;
    const service = {
      acknowledge: async () => {
        calls++;
        return "recorded";
      },
    } as unknown as ReturnType<typeof createOriTicketPresentationAcknowledgement>;
    const handler = createOriPresentationAckHttpHandler(async () => null, service);
    const forged = response();
    await handler(
      request(
        { ticketId, description: "Valid description" },
        { origin: "https://attacker.example" },
      ),
      forged.value,
    );
    expect(forged.status()).toBe(403);
    const guest = response();
    await handler(request({ ticketId, description: "Valid description" }), guest.value);
    expect(guest.status()).toBe(401);
    expect(calls).toBe(0);
  });
});
