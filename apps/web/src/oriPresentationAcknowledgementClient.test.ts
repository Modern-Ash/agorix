import { describe, expect, it } from "vitest";
import { acknowledgeOriPresentation } from "./oriPresentationAcknowledgementClient.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
describe("Ori browser presentation acknowledgement", () => {
  it("uses same-origin credentials and bounded canonical ticket payload", async () => {
    let request: RequestInit | undefined;
    const fetchImpl = (async (_url: string, options?: RequestInit) => {
      request = options;
      return { ok: true };
    }) as typeof fetch;
    expect(
      await acknowledgeOriPresentation(ticketId, "Agregar movimiento de 2 paso(s)", fetchImpl),
    ).toBe(true);
    expect(request?.credentials).toBe("same-origin");
    expect(JSON.parse(String(request?.body))).toEqual({
      ticketId,
      description: "Agregar movimiento de 2 paso(s)",
    });
  });
  it("rejects invalid tickets and fails closed on unavailable route", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      throw Error("offline");
    }) as typeof fetch;
    expect(await acknowledgeOriPresentation("forged", "description", fetchImpl)).toBe(false);
    expect(calls).toBe(0);
    expect(
      await acknowledgeOriPresentation(ticketId, "Agregar movimiento de 2 paso(s)", fetchImpl),
    ).toBe(false);
  });
});
