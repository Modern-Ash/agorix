import { describe, expect, it } from "vitest";
import { parseOriApplyRequest } from "./oriApplyRequestContract.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";

describe("Ori apply request contract", () => {
  it("accepts only an opaque ticket and script identifier", () => {
    expect(parseOriApplyRequest({ ticketId, scriptId: "main" })).toEqual({
      ticketId,
      scriptId: "main",
    });
  });

  it.each([
    null,
    [],
    { ticketId, scriptId: "" },
    { ticketId: "not-a-uuid", scriptId: "main" },
    { ticketId, scriptId: "../main" },
    { ticketId, scriptId: "main", approved: true },
    { ticketId, scriptId: "main", owner: "student" },
    { ticketId, scriptId: "main", expectedRevision: 1 },
    { ticketId, scriptId: "main", proposal: { kind: "move" } },
    { ticketId, scriptId: "main", grants: ["inspectProgram"] },
  ])("rejects malformed or authority-bearing input", (raw) => {
    expect(parseOriApplyRequest(raw)).toBeNull();
  });
});
