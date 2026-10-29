import { describe, expect, it } from "vitest";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriTicketPresentationAcknowledgement } from "./oriTicketPresentationAcknowledgement.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const description = "Agregar movimiento de 2 paso(s)";
const ticket: OriReviewTicket = {
  id: ticketId,
  status: "pending",
  appliedChanges: false,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 2 }],
  },
};
describe("Ori durable presentation acknowledgement", () => {
  it("records only canonical server-validated description once", async () => {
    const store = openOriTicketPresentationSqliteStore(":memory:");
    const service = createOriTicketPresentationAcknowledgement({
      resolveTicket: async () => ticket,
      record: store.record,
    });
    expect(await service.acknowledge("owner", "project", ticketId, description)).toBe("recorded");
    expect(store.read("owner", "project", ticketId)).toMatch(/^[a-f0-9]{64}$/);
    expect(await service.acknowledge("owner", "project", ticketId, description)).toBe(
      "unavailable",
    );
    expect(store.read("other", "project", ticketId)).toBeNull();
    store.close();
  });
  it("rejects forged descriptions before storage", async () => {
    const store = openOriTicketPresentationSqliteStore(":memory:");
    const service = createOriTicketPresentationAcknowledgement({
      resolveTicket: async () => ticket,
      record: store.record,
    });
    expect(
      await service.acknowledge("owner", "project", ticketId, "Agregar movimiento de 5 paso(s)"),
    ).toBe("invalid");
    expect(store.read("owner", "project", ticketId)).toBeNull();
    store.close();
  });
});
