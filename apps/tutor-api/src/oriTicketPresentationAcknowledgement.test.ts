import { describe, expect, it } from "vitest";
import { createOriTicketPresentationAcknowledgement } from "./oriTicketPresentationAcknowledgement.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const ticket: OriReviewTicket = {
  id: ticketId,
  status: "pending",
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 2 }],
  },
  appliedChanges: false,
};
describe("Ori server-owned presentation acknowledgement", () => {
  it("records only an authenticated-scoped pending ticket hash", async () => {
    const entries: string[] = [];
    const service = createOriTicketPresentationAcknowledgement({
      resolveTicket: async () => ticket,
      record: async (entry) => {
        entries.push(entry.descriptionHash);
        return true;
      },
    });
    expect(
      await service.acknowledge("owner", "project", ticketId, "Agregar movimiento de 2 paso(s)"),
    ).toBe("recorded");
    expect(entries[0]).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects missing tickets and invalid descriptions without recording", async () => {
    let calls = 0;
    const service = createOriTicketPresentationAcknowledgement({
      resolveTicket: async () => null,
      record: async () => {
        calls++;
        return true;
      },
    });
    expect(
      await service.acknowledge("owner", "project", ticketId, "Agregar movimiento de 2 paso(s)"),
    ).toBe("invalid");
    expect(await service.acknowledge("owner", "project", ticketId, "bad")).toBe("invalid");
    expect(calls).toBe(0);
  });
  it("rejects client-forged description even for a valid server ticket", async () => {
    let calls = 0;
    const service = createOriTicketPresentationAcknowledgement({
      resolveTicket: async () => ticket,
      record: async () => {
        calls++;
        return true;
      },
    });
    expect(
      await service.acknowledge("owner", "project", ticketId, "Agregar movimiento de 5 paso(s)"),
    ).toBe("invalid");
    expect(calls).toBe(0);
  });
});
